import { colorField, fontField, textSizeField } from "@/lib/plugin-ui";
import { PluginUiDefinition } from "@/types/plugins/ui";

export const ecmUi: PluginUiDefinition = {
  name: "eCircuitMania",
  description:
    "The eCircuitMania window, opened with /ecm or the action button.",
  sections: {
    colors: {
      windowHeaderBackground: colorField("Window header background", "08080A"),
      windowHeaderText: colorField("Window header text", "F4F4F5"),
      windowBackground: colorField("Window background", "0F0F12"),
      text: colorField("Text", "F4F4F5"),
      buttonBackground: colorField(
        "Button background",
        "16161A",
        "Also used as the background of the API key input.",
      ),
      buttonAccent: colorField("Button underline", "20A0F1"),
      success: colorField("Recording", "3FB950"),
      error: colorField("Not recording and errors", "FF5050"),
    },
    fonts: {
      text: fontField("Text", "GameFontRegular"),
      label: fontField("Section labels", "RajdhaniMono"),
    },
    textSizes: {
      text: textSizeField("Text", 1),
      label: textSizeField("Section labels", 0.6),
    },
  },
};
