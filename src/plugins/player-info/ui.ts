import {
  colorField,
  fontField,
  numberField,
  opacityField,
  positionFields,
  scaleField,
  textField,
  textSizeField,
} from "@/lib/plugin-ui";
import { PluginUiDefinition } from "@/types/plugins/ui";

export const playerInfoUi: PluginUiDefinition = {
  name: "Player Info",
  description:
    "Information about the spectated player: records, device and camera.",
  sections: {
    layout: {
      ...positionFields(-156, -49),
      ...scaleField(),
      width: numberField("Width", 55, 45, 200, 0.5),
    },
    spacing: {
      nameHeight: numberField("Name height", 7, 3, 15, 0.25),
      sectionGap: numberField(
        "Name gap",
        1,
        0,
        5,
        0.05,
        "Space between the player name and the header.",
      ),
      headerHeight: numberField("Header height", 5, 3, 15, 0.25),
      rowHeight: numberField("Row height", 8, 3, 15, 0.25),
      rowGap: numberField(
        "Row gap",
        0.25,
        0,
        5,
        0.05,
        "Space below the header and between the rows.",
      ),
    },
    colors: {
      headerBackground: colorField("Header background", "08080A"),
      headerOpacity: opacityField("Header opacity", 0.95),
      headerText: colorField("Header text", "F4F4F5"),
      accentBackground: colorField("Label background", "16161A"),
      accentOpacity: opacityField("Label opacity", 0.95),
      accentText: colorField("Label text", "A6A6AD"),
      rowBackground: colorField("Row background", "08080A"),
      rowOpacity: opacityField("Row opacity", 0.88),
      rowText: colorField("Row text", "F4F4F5"),
    },
    fonts: {
      title: fontField("Title", "Nadeo/Trackmania/BebasNeueRegular"),
      name: fontField("Player name", "GameFontSemiBold"),
      accent: fontField("Label", "RajdhaniMono"),
      value: fontField("Value", "GameFontSemiBold"),
    },
    textSizes: {
      title: textSizeField("Title", 1),
      name: textSizeField("Player name", 2),
      accent: textSizeField("Label", 1.5),
      value: textSizeField("Value", 1.5),
    },
    texts: {
      title: textField("Title", "Player Info"),
    },
  },
};
