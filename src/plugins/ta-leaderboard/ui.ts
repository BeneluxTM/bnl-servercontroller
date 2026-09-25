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

export const taLeaderboardUi: PluginUiDefinition = {
  name: "TA Leaderboard",
  description: "Leaderboard with the best time of every player on the map.",
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
      headerBackground: colorField("Header background", "222"),
      headerOpacity: opacityField("Header opacity"),
      headerText: colorField("Header text", "FFF"),
      accentBackground: colorField("Rank background", "222"),
      accentOpacity: opacityField("Rank opacity"),
      accentText: colorField("Rank text", "DDD"),
      rowBackground: colorField("Row background", "DDD"),
      rowOpacity: opacityField("Row opacity"),
      rowText: colorField("Row text", "222"),
      highlightBackground: colorField(
        "Improvement background",
        "22D",
        "Background of the improvement that slides in when a player sets a better time.",
      ),
      highlightText: colorField("Improvement text", "DDD"),
    },
    fonts: {
      title: fontField("Title", "GameFontSemiBold"),
      accent: fontField("Rank", "GameFontSemiBold"),
      name: fontField("Name", "GameFontRegular"),
      time: fontField("Time", "GameFontSemiBold"),
    },
    textSizes: {
      title: textSizeField("Title", 1),
      accent: textSizeField("Rank", 1.25),
      name: textSizeField("Name", 1.2),
      time: textSizeField("Time", 1),
    },
    texts: {
      title: textField("Title", "Leaderboard"),
    },
  },
};
