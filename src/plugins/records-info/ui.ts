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

export const recordsInfoUi: PluginUiDefinition = {
  name: "Records Info",
  description: "World record and local record of the current map.",
  sections: {
    layout: {
      ...positionFields(100, 73.5),
      ...scaleField(),
      width: numberField("Width", 55, 45, 200, 0.5),
      ...hideWhileDrivingField(true),
    },
    spacing: {
      rowHeight: numberField("Row height", 5, 3, 15, 0.25),
      rowGap: numberField("Row gap", 0.25, 0, 5, 0.05),
    },
    colors: {
      accentBackground: colorField("Label background", "222"),
      accentOpacity: opacityField("Label opacity"),
      accentText: colorField("Label text", "DDD"),
      rowBackground: colorField("Row background", "DDD"),
      rowOpacity: opacityField("Row opacity"),
      rowText: colorField("Row text", "222"),
    },
    fonts: {
      accent: fontField("Label", "GameFontSemiBold"),
      name: fontField("Name", "GameFontRegular"),
      time: fontField("Time", "GameFontSemiBold"),
    },
    textSizes: {
      accent: textSizeField("Label", 1),
      name: textSizeField("Name", 1),
      time: textSizeField("Time", 1),
    },
  },
};
