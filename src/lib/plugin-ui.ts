import {
  PLUGIN_UI_FONTS,
  PLUGIN_UI_SECTIONS,
  PluginUiBooleanField,
  PluginUiColorField,
  PluginUiDefinition,
  PluginUiField,
  PluginUiFields,
  PluginUiFont,
  PluginUiFontField,
  PluginUiNumberField,
  PluginUiSection,
  PluginUiTextField,
  PluginUiValue,
  PluginUiValues,
} from "@/types/plugins/ui";
import z from "zod";

export const PLUGIN_UI_SECTION_LABELS: Record<PluginUiSection, string> = {
  layout: "Layout",
  spacing: "Spacing",
  colors: "Colors",
  fonts: "Fonts",
  textSizes: "Text sizes",
  texts: "Texts",
};

const HEX_COLOR_REGEX = /^([0-9A-F]{3}|[0-9A-F]{6})$/i;

// Characters that could break out of a manialink attribute or a ManiaScript string.
const FORBIDDEN_TEXT_CHARACTERS = ["<", ">", '"', "\\"];

function isAllowedTextCharacter(character: string): boolean {
  const code = character.codePointAt(0) ?? 0;
  return (
    code >= 32 && code !== 127 && !FORBIDDEN_TEXT_CHARACTERS.includes(character)
  );
}

/** Rounds to 4 decimals, so templates never print float artifacts or exponents. */
export function roundUiNumber(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function normalizeUiColor(value: string): string {
  return value.trim().replace(/^#/, "").toUpperCase();
}

/** Expands a 3 digit hex color to 6 digits, e.g. "2A2" -> "22AA22". */
export function expandUiColor(value: string): string {
  const color = normalizeUiColor(value);
  if (color.length !== 3) return color;
  return color
    .split("")
    .map((c) => c + c)
    .join("");
}

export function isUiColor(value: string): boolean {
  return HEX_COLOR_REGEX.test(normalizeUiColor(value));
}

/**
 * Returns the value as a valid value for the field, or undefined when it can't be used.
 * Numbers are clamped to the field's range.
 */
export function sanitizePluginUiValue(
  field: PluginUiField,
  value: unknown,
): PluginUiValue | undefined {
  switch (field.type) {
    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value))
        return undefined;
      const clamped = Math.min(field.max, Math.max(field.min, value));
      return field.integer ? Math.round(clamped) : roundUiNumber(clamped);
    }
    case "color": {
      if (typeof value !== "string") return undefined;
      const color = normalizeUiColor(value);
      return HEX_COLOR_REGEX.test(color) ? color : undefined;
    }
    case "font":
      return typeof value === "string" &&
        (PLUGIN_UI_FONTS as readonly string[]).includes(value)
        ? value
        : undefined;
    case "text":
      if (typeof value !== "string") return undefined;
      return Array.from(value)
        .filter(isAllowedTextCharacter)
        .slice(0, field.maxLength)
        .join("");
    case "boolean":
      return typeof value === "boolean" ? value : undefined;
  }
}

export function isPluginUiValueEqual(
  field: PluginUiField,
  a: PluginUiValue,
  b: PluginUiValue,
): boolean {
  if (
    field.type === "color" &&
    typeof a === "string" &&
    typeof b === "string"
  ) {
    return expandUiColor(a) === expandUiColor(b);
  }
  return a === b;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function definitionSections(
  definition: PluginUiDefinition,
): [PluginUiSection, PluginUiFields][] {
  return PLUGIN_UI_SECTIONS.flatMap((section) => {
    const fields = definition.sections[section];
    return fields
      ? [[section, fields] as [PluginUiSection, PluginUiFields]]
      : [];
  });
}

export function getPluginUiDefaults(
  definition: PluginUiDefinition,
): PluginUiValues {
  return resolvePluginUi(definition, null);
}

/**
 * Merges the stored overrides with the defaults of the definition.
 * Every field of the definition is present in the result, invalid or unknown values are ignored.
 */
export function resolvePluginUi(
  definition: PluginUiDefinition,
  overrides: unknown,
): PluginUiValues {
  const values = asRecord(overrides);
  const resolved: PluginUiValues = {};

  for (const [section, fields] of definitionSections(definition)) {
    const sectionValues = asRecord(values?.[section]);
    resolved[section] = Object.fromEntries(
      Object.entries(fields).map(([key, field]) => [
        key,
        sanitizePluginUiValue(field, sectionValues?.[key]) ?? field.default,
      ]),
    );
  }

  return resolved;
}

/** Returns only the valid values that differ from the defaults, which is what gets stored. */
export function getPluginUiOverrides(
  definition: PluginUiDefinition,
  values: unknown,
): PluginUiValues {
  const input = asRecord(values);
  const overrides: PluginUiValues = {};

  for (const [section, fields] of definitionSections(definition)) {
    const sectionValues = asRecord(input?.[section]);
    if (!sectionValues) continue;

    const sectionOverrides: Record<string, PluginUiValue> = {};
    for (const [key, field] of Object.entries(fields)) {
      const value = sanitizePluginUiValue(field, sectionValues[key]);
      if (
        value !== undefined &&
        !isPluginUiValueEqual(field, value, field.default)
      ) {
        sectionOverrides[key] = value;
      }
    }

    if (Object.keys(sectionOverrides).length > 0) {
      overrides[section] = sectionOverrides;
    }
  }

  return overrides;
}

export function getPluginUiValue(
  ui: PluginUiValues | null | undefined,
  section: PluginUiSection,
  key: string,
): PluginUiValue | undefined {
  return ui?.[section]?.[key];
}

function createFieldSchema(field: PluginUiField): z.ZodTypeAny {
  switch (field.type) {
    case "number": {
      let schema = z
        .number({
          required_error: "Enter a number",
          invalid_type_error: "Enter a number",
        })
        .min(field.min, `Must be at least ${field.min}`)
        .max(field.max, `Must be at most ${field.max}`);
      if (field.integer) {
        schema = schema.int("Must be a whole number");
      }
      return schema;
    }
    case "color":
      return z
        .string()
        .regex(
          HEX_COLOR_REGEX,
          "Use a 3 or 6 digit hex color, e.g. 222 or 1A2B3C",
        );
    case "font":
      return z.enum(PLUGIN_UI_FONTS);
    case "text":
      return z
        .string()
        .max(field.maxLength, `Must be at most ${field.maxLength} characters`)
        .refine(
          (value) => Array.from(value).every(isAllowedTextCharacter),
          'Cannot contain < > " or \\',
        );
    case "boolean":
      return z.boolean();
  }
}

/** Schema for a complete set of UI values of the definition, used to validate the form and imports. */
export function createPluginUiSchema(definition: PluginUiDefinition) {
  return z.object(
    Object.fromEntries(
      definitionSections(definition).map(([section, fields]) => [
        section,
        z.object(
          Object.fromEntries(
            Object.entries(fields).map(([key, field]) => [
              key,
              createFieldSchema(field),
            ]),
          ),
        ),
      ]),
    ),
  );
}

// Field factories used by the plugin UI definitions.

export function numberField(
  label: string,
  defaultValue: number,
  min: number,
  max: number,
  step: number,
  description?: string,
): PluginUiNumberField {
  return {
    type: "number",
    label,
    default: defaultValue,
    min,
    max,
    step,
    description,
  };
}

export function integerField(
  label: string,
  defaultValue: number,
  min: number,
  max: number,
  description?: string,
): PluginUiNumberField {
  return {
    type: "number",
    label,
    default: defaultValue,
    min,
    max,
    step: 1,
    integer: true,
    description,
  };
}

export function colorField(
  label: string,
  defaultValue: string,
  description?: string,
): PluginUiColorField {
  return { type: "color", label, default: defaultValue, description };
}

export function opacityField(
  label: string,
  defaultValue: number = 1,
  description?: string,
): PluginUiNumberField {
  return numberField(label, defaultValue, 0, 1, 0.05, description);
}

export function fontField(
  label: string,
  defaultValue: PluginUiFont,
  description?: string,
): PluginUiFontField {
  return { type: "font", label, default: defaultValue, description };
}

export function textSizeField(
  label: string,
  defaultValue: number,
  description?: string,
): PluginUiNumberField {
  return numberField(label, defaultValue, 0.25, 10, 0.05, description);
}

export function textField(
  label: string,
  defaultValue: string,
  maxLength: number = 64,
  description?: string,
): PluginUiTextField {
  return { type: "text", label, default: defaultValue, maxLength, description };
}

export function booleanField(
  label: string,
  defaultValue: boolean,
  description?: string,
): PluginUiBooleanField {
  return { type: "boolean", label, default: defaultValue, description };
}

export function positionFields(x: number, y: number): PluginUiFields {
  return {
    x: numberField(
      "X position",
      x,
      -320,
      320,
      0.5,
      "Horizontal position of the top left corner. The screen goes from -160 (left) to 160 (right).",
    ),
    y: numberField(
      "Y position",
      y,
      -180,
      180,
      0.5,
      "Vertical position of the top left corner. The screen goes from 90 (top) to -90 (bottom).",
    ),
  };
}

export function scaleField(): PluginUiFields {
  return {
    scale: numberField(
      "Scale",
      1,
      0.25,
      4,
      0.05,
      "Scales the whole element including its text, 1 is the original size.",
    ),
  };
}

export function hideWhileDrivingField(defaultValue: boolean): PluginUiFields {
  return {
    hideWhileDriving: booleanField(
      "Hide while driving",
      defaultValue,
      "Slide the widget out of the screen while the player is driving.",
    ),
  };
}
