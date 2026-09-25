import {
  colorField,
  fontField,
  hideWhileDrivingField,
  numberField,
  opacityField,
  positionFields,
  scaleField,
  textField,
  textSizeField,
} from "@/lib/plugin-ui";
import { PluginUiDefinition } from "@/types/plugins/ui";

export const notifyAdminUi: PluginUiDefinition = {
  name: "Admin",
  description: "Button that players can click to notify the admins.",
  sections: {
    layout: {
      ...positionFields(119, -70),
      ...scaleField(),
      width: numberField("Width", 36, 10, 200, 0.5),
      height: numberField("Height", 8, 3, 30, 0.25),
      ...hideWhileDrivingField(true),
    },
    colors: {
      rowBackground: colorField("Button background", "DDD"),
      rowOpacity: opacityField("Button opacity"),
      rowText: colorField("Button text", "222"),
      accentBackground: colorField("Underline", "222"),
    },
    fonts: {
      label: fontField("Button text", "GameFontSemiBold"),
    },
    textSizes: {
      label: textSizeField("Button text", 2),
    },
    texts: {
      label: textField("Button text", "Notify Admin"),
    },
  },
};
