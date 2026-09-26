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

export const liveRoundUi: PluginUiDefinition = {
  name: "Live Round",
  description:
    "Live overview of the current round. The number of visible rows is set in the plugin configuration.",
  sections: {
    layout: {
      ...positionFields(-156, 73.5),
      ...scaleField(),
      width: numberField("Width", 55, 50, 200, 0.5),
      ...hideWhileDrivingField(false),
    },
    spacing: {
      headerHeight: numberField("Header height", 5, 3, 15, 0.25),
      rowHeight: numberField("Row height", 5, 3, 15, 0.25),
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
      accentBackground: colorField(
        "Rank background",
        "16161A",
        "Also used for the points and record badges next to a finished player.",
      ),
      accentOpacity: opacityField("Rank opacity", 0.95),
      accentText: colorField("Rank text", "A6A6AD"),
      rowBackground: colorField("Row background", "08080A"),
      rowOpacity: opacityField(
        "Row opacity",
        0.88,
        "Opacity of the row and time column backgrounds.",
      ),
      rowText: colorField("Row text", "F4F4F5"),
      secondaryBackground: colorField("Time column background", "0F0F12"),
      secondaryText: colorField("Time column text", "A6A6AD"),
    },
    fonts: {
      title: fontField("Title", "Nadeo/Trackmania/BebasNeueRegular"),
      accent: fontField("Rank and badges", "Nadeo/Trackmania/BebasNeueRegular"),
      name: fontField("Name", "GameFontSemiBold"),
      points: fontField("Points", "Nadeo/Trackmania/BebasNeueRegular"),
      time: fontField("Time", "RajdhaniMono"),
    },
    textSizes: {
      title: textSizeField("Title", 1),
      accent: textSizeField("Rank and badges", 1.25),
      name: textSizeField("Name", 1.2),
      points: textSizeField("Points", 1),
      time: textSizeField("Time", 1),
    },
    texts: {
      title: textField("Title", "Live Round"),
    },
  },
};
