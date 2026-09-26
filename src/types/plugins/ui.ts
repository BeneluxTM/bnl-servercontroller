export const PLUGIN_UI_SECTIONS = [
  "layout",
  "spacing",
  "colors",
  "fonts",
  "textSizes",
  "texts",
] as const;

export type PluginUiSection = (typeof PLUGIN_UI_SECTIONS)[number];

/** Fonts that can be used for the textfont attribute of manialink labels. */
export const PLUGIN_UI_FONTS = [
  "GameFontRegular",
  "GameFontSemiBold",
  "GameFontBlack",
  "Oswald",
  "OswaldMono",
  "RajdhaniMono",
  "RobotoCondensed",
  "RobotoCondensedBold",
  "Nadeo/Trackmania/BebasNeueRegular",
] as const;

export type PluginUiFont = (typeof PLUGIN_UI_FONTS)[number];

type PluginUiFieldBase = {
  label: string;
  description?: string;
};

export type PluginUiNumberField = PluginUiFieldBase & {
  type: "number";
  default: number;
  min: number;
  max: number;
  step: number;
  integer?: boolean;
};

/** A 3 or 6 digit hex color without leading #, e.g. "222" or "1A2B3C". */
export type PluginUiColorField = PluginUiFieldBase & {
  type: "color";
  default: string;
};

export type PluginUiFontField = PluginUiFieldBase & {
  type: "font";
  default: PluginUiFont;
};

export type PluginUiTextField = PluginUiFieldBase & {
  type: "text";
  default: string;
  maxLength: number;
};

export type PluginUiBooleanField = PluginUiFieldBase & {
  type: "boolean";
  default: boolean;
};

export type PluginUiField =
  | PluginUiNumberField
  | PluginUiColorField
  | PluginUiFontField
  | PluginUiTextField
  | PluginUiBooleanField;

export type PluginUiFields = Record<string, PluginUiField>;

/**
 * Describes which parts of a plugin's in-game UI can be customized.
 * The defaults are the BNL look ("Signal", as on beneluxtm.com): near-black
 * panels, light text, grey rank and label columns, blue highlights,
 * Bebas for titles and numbers and RajdhaniMono for times and labels.
 */
export type PluginUiDefinition = {
  name: string;
  description: string;
  sections: Partial<Record<PluginUiSection, PluginUiFields>>;
};

export type PluginUiValue = string | number | boolean;

/**
 * UI values grouped by section. Stored per server plugin as a sparse set of
 * overrides, and passed to the manialink templates fully resolved as `ui`.
 */
export type PluginUiValues = Partial<
  Record<PluginUiSection, Record<string, PluginUiValue>>
>;
