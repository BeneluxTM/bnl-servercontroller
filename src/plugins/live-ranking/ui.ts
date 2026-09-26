import {
  colorField,
  fontField,
  hideWhileDrivingField,
  integerField,
  numberField,
  opacityField,
  positionFields,
  scaleField,
  textField,
  textSizeField,
} from "@/lib/plugin-ui";
import { PluginUiDefinition } from "@/types/plugins/ui";

export const liveRankingUi: PluginUiDefinition = {
  name: "Live Ranking",
  description:
    "Ranking with the match points of every player. In team modes the rows use the team colors.",
  sections: {
    layout: {
      ...positionFields(100, 55),
      ...scaleField(),
      width: numberField("Width", 55, 45, 200, 0.5),
      visibleRows: integerField(
        "Visible rows",
        8,
        1,
        30,
        "Number of rows shown before the list starts scrolling.",
      ),
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
      accentBackground: colorField("Rank background", "16161A"),
      accentOpacity: opacityField("Rank opacity", 0.95),
      accentText: colorField("Rank text", "A6A6AD"),
      rowBackground: colorField("Row background", "08080A"),
      rowOpacity: opacityField("Row opacity", 0.88),
      rowText: colorField("Row text", "F4F4F5"),
    },
    fonts: {
      title: fontField("Title", "Nadeo/Trackmania/BebasNeueRegular"),
      accent: fontField("Rank", "Nadeo/Trackmania/BebasNeueRegular"),
      name: fontField("Name", "GameFontSemiBold"),
      points: fontField("Points", "Nadeo/Trackmania/BebasNeueRegular"),
    },
    textSizes: {
      title: textSizeField("Title", 1),
      accent: textSizeField("Rank", 1.25),
      name: textSizeField("Name", 1.2),
      points: textSizeField("Points", 1),
    },
    texts: {
      title: textField("Title", "Live Ranking"),
    },
  },
};
