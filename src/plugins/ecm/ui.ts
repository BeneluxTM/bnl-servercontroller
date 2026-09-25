import { colorField, fontField, textSizeField } from "@/lib/plugin-ui";
import { PluginUiDefinition } from "@/types/plugins/ui";

export const ecmUi: PluginUiDefinition = {
  name: "eCircuitMania",
  description:
    "The eCircuitMania window, opened with /ecm or the action button.",
  sections: {
    colors: {
      windowHeaderBackground: colorField("Window header background", "222"),
      windowHeaderText: colorField("Window header text", "FFF"),
      windowBackground: colorField("Window background", "DDD"),
      text: colorField("Text", "222"),
      buttonBackground: colorField(
        "Button background",
        "CCC",
        "Also used as the background of the API key input.",
      ),
      buttonAccent: colorField("Button underline", "222"),
      success: colorField("Recording", "2D2"),
      error: colorField("Not recording and errors", "D22"),
    },
    fonts: {
      text: fontField("Text", "GameFontRegular"),
      label: fontField("Section labels", "GameFontSemiBold"),
    },
    textSizes: {
      text: textSizeField("Text", 1),
      label: textSizeField("Section labels", 0.6),
    },
  },
};
