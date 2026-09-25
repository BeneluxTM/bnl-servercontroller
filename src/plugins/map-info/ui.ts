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
      accentBackground: colorField("Icon background", "222"),
      accentOpacity: opacityField("Icon background opacity"),
      accentText: colorField("Icon", "DDD"),
      rowBackground: colorField("Background", "DDD"),
      rowOpacity: opacityField("Background opacity"),
      rowText: colorField("Map name", "222"),
      authorText: colorField("Author", "222"),
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
