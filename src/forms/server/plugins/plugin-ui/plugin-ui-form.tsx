"use client";

import { updateServerPluginUi } from "@/actions/database/server-plugins";
import FormElement from "@/components/form/form-element";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createPluginUiSchema,
  getPluginUiDefaults,
  getPluginUiOverrides,
  isPluginUiValueEqual,
  PLUGIN_UI_SECTION_LABELS,
  resolvePluginUi,
  sanitizePluginUiValue,
} from "@/lib/plugin-ui";
import { getErrorMessage } from "@/lib/utils";
import {
  PLUGIN_UI_FONTS,
  PLUGIN_UI_SECTIONS,
  PluginUiDefinition,
  PluginUiField,
  PluginUiSection,
  PluginUiValue,
  PluginUiValues,
} from "@/types/plugins/ui";
import { ServerError } from "@/types/responses";
import { zodResolver } from "@hookform/resolvers/zod";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import {
  IconArrowBackUp,
  IconDeviceFloppy,
  IconFileExport,
  IconFileImport,
  IconRestore,
  IconX,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import {
  FieldErrors,
  Path,
  useForm,
  useFormContext,
  useWatch,
} from "react-hook-form";
import { toast } from "sonner";
import PluginUiPreview from "./plugin-ui-preview";

const FONT_OPTIONS = PLUGIN_UI_FONTS.map((font) => ({
  label: font,
  value: font,
}));

function formatDefault(field: PluginUiField): string {
  switch (field.type) {
    case "color":
      return `#${field.default}`;
    case "boolean":
      return field.default ? "on" : "off";
    case "text":
      return `"${field.default}"`;
    default:
      return String(field.default);
  }
}

function inputType(field: PluginUiField): string {
  switch (field.type) {
    case "font":
      return "select";
    case "boolean":
      return "checkbox";
    default:
      return field.type;
  }
}

function PluginUiFieldElement({
  name,
  field,
}: {
  name: Path<PluginUiValues>;
  field: PluginUiField;
}) {
  const { control, setValue } = useFormContext<PluginUiValues>();
  const value = useWatch({ control, name }) as PluginUiValue | undefined;

  const isDefault =
    value !== undefined && isPluginUiValueEqual(field, value, field.default);

  return (
    <FormElement<PluginUiValues>
      // The select input only reads its value when it's mounted
      key={field.type === "font" ? `${name}-${value}` : name}
      name={name}
      label={field.label}
      description={[field.description, `Default: ${formatDefault(field)}`]
        .filter(Boolean)
        .join(" ")}
      type={inputType(field)}
      options={field.type === "font" ? FONT_OPTIONS : undefined}
      min={field.type === "number" ? field.min : undefined}
      max={field.type === "number" ? field.max : undefined}
      step={field.type === "number" ? field.step : undefined}
      placeholder={field.type === "boolean" ? "Enabled" : undefined}
      rootClassName="max-w-full"
      className={field.type === "number" ? "w-28" : undefined}
    >
      {!isDefault && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title={`Reset to default (${formatDefault(field)})`}
          aria-label={`Reset ${field.label} to default`}
          onClick={() =>
            setValue(name, field.default as never, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
        >
          <IconArrowBackUp />
        </Button>
      )}
    </FormElement>
  );
}

export default function PluginUiForm({
  serverId,
  pluginId,
  pluginName,
  definition,
  ui,
  onSubmit,
  onClose,
}: {
  serverId: string;
  pluginId: string;
  pluginName: string;
  definition: PluginUiDefinition;
  ui?: unknown;
  onSubmit?: (ui: PluginUiValues) => void;
  onClose?: () => void;
}) {
  const schema = useMemo(() => createPluginUiSchema(definition), [definition]);
  const sections = PLUGIN_UI_SECTIONS.filter(
    (section) => definition.sections[section],
  );
  const [activeSection, setActiveSection] = useState<string>(sections[0]);

  const form = useForm<PluginUiValues>({
    resolver: zodResolver(schema),
    defaultValues: resolvePluginUi(definition, ui),
  });

  const values = useWatch({ control: form.control }) as PluginUiValues;
  const errors = form.formState.errors;

  async function handleSubmit(values: PluginUiValues) {
    try {
      const { data, error } = await updateServerPluginUi(
        serverId,
        pluginId,
        values,
      );
      if (error) {
        throw new ServerError(error, "UpdateServerPluginUiError");
      }
      form.reset(values);
      toast.success("UI successfully saved");
      onSubmit?.(data);
    } catch (error) {
      toast.error("Failed to save UI", {
        description: getErrorMessage(error),
      });
    }
  }

  function handleInvalid(errors: FieldErrors<PluginUiValues>) {
    const section = sections.find((section) => errors[section]);
    if (section) {
      setActiveSection(section);
    }
    toast.error("Some values are invalid");
  }

  function handleMove(x: number, y: number) {
    const layout = definition.sections.layout;
    for (const [key, value] of [
      ["x", x],
      ["y", y],
    ] as const) {
      const field = layout?.[key];
      if (!field) continue;
      form.setValue(
        `layout.${key}` as Path<PluginUiValues>,
        sanitizePluginUiValue(field, value) as never,
        { shouldDirty: true, shouldValidate: true },
      );
    }
  }

  function handleResetAll() {
    form.reset(getPluginUiDefaults(definition), { keepDefaultValues: true });
  }

  function handleExport() {
    const overrides = getPluginUiOverrides(definition, form.getValues());
    const blob = new Blob([JSON.stringify(overrides, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${pluginName}-plugin-ui-${serverId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      const result = schema
        .deepPartial()
        .safeParse(JSON.parse(await file.text()));
      if (!result.success) {
        throw new Error(
          result.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join(", "),
        );
      }
      form.reset(resolvePluginUi(definition, result.data), {
        keepDefaultValues: true,
      });
      toast.success("UI imported, save to apply it");
    } catch (error) {
      toast.error("Failed to import UI", {
        description: getErrorMessage(error),
      });
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit, handleInvalid)}
        className="flex flex-col gap-4"
      >
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
          <div>
            <div className="bg-card lg:sticky lg:top-0">
              <PluginUiPreview
                pluginName={pluginName}
                ui={values}
                onMove={definition.sections.layout?.x ? handleMove : undefined}
              />
            </div>
          </div>

          <TabsPrimitive.Root
            value={activeSection}
            onValueChange={setActiveSection}
            className="flex flex-col gap-4"
          >
            <TabsList className="w-full">
              {sections.map((section) => (
                <TabsTrigger key={section} value={section}>
                  {PLUGIN_UI_SECTION_LABELS[section]}
                  {errors[section] && (
                    <span
                      className="bg-destructive size-1.5 rounded-full"
                      aria-label="Contains invalid values"
                    />
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {sections.map((section: PluginUiSection) => (
              <TabsContent
                key={section}
                value={section}
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1"
              >
                {Object.entries(definition.sections[section] ?? {}).map(
                  ([key, field]) => (
                    <PluginUiFieldElement
                      key={key}
                      name={`${section}.${key}` as Path<PluginUiValues>}
                      field={field}
                    />
                  ),
                )}
              </TabsContent>
            ))}
          </TabsPrimitive.Root>
        </div>

        <div className="bg-card sticky bottom-[-1.5rem] -mx-6 -mb-6 flex flex-wrap justify-between gap-2 border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            <IconX />
            Close
          </Button>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleResetAll}
              disabled={form.formState.isSubmitting}
            >
              <IconRestore />
              Reset all
            </Button>

            <Button type="button" variant="outline" onClick={handleExport}>
              <IconFileExport />
              Export
            </Button>

            <Button asChild variant="outline">
              <label htmlFor="plugin-ui-import">
                <IconFileImport />
                Import
                <input
                  id="plugin-ui-import"
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleImport}
                />
              </label>
            </Button>

            <Button type="submit" disabled={form.formState.isSubmitting}>
              <IconDeviceFloppy />
              Save
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
