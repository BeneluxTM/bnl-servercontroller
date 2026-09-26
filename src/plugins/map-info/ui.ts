import {
  colorField,
  fontField,
  hideWhileDrivingField,
  numberField,
  opacityField,
  positionFields,
  scaleField,
  textSizeField,
} from "@/lib/plugin-ui";
import { PluginUiDefinition } from "@/types/plugins/ui";

export const mapInfoUi: PluginUiDefinition = {
  name: "Map Info",
  description: "Name and author of the current map.",
  sections: {
    layout: {
      ...positionFields(100, 85),
      ...scaleField(),
      width: numberField("Width", 55, 45, 200, 0.5),
      height: numberField("Height", 10, 5, 30, 0.25),
      ...hideWhileDrivingField(true),
    },
    colors: {
      accentBackground: colorField("Icon background", "16161A"),
      accentOpacity: opacityField("Icon background opacity", 0.95),
      accentText: colorField("Icon", "20A0F1"),
      rowBackground: colorField("Background", "08080A"),
      rowOpacity: opacityField("Background opacity", 0.88),
      rowText: colorField("Map name", "F4F4F5"),
      authorText: colorField("Author", "A6A6AD"),
    },
    fonts: {
      name: fontField("Map name", "GameFontSemiBold"),
      author: fontField("Author", "GameFontRegular"),
    },
    textSizes: {
      icon: textSizeField("Icon", 2.5),
      name: textSizeField("Map name", 1.75),
      author: textSizeField("Author", 1),
    },
  },
};
