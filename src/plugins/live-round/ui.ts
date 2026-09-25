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
      headerBackground: colorField("Header background", "222"),
      headerOpacity: opacityField("Header opacity"),
      headerText: colorField("Header text", "FFF"),
      accentBackground: colorField(
        "Rank background",
        "222",
        "Also used for the points and record badges next to a finished player.",
      ),
      accentOpacity: opacityField("Rank opacity"),
      accentText: colorField("Rank text", "DDD"),
      rowBackground: colorField("Row background", "DDD"),
      rowOpacity: opacityField(
        "Row opacity",
        1,
        "Opacity of the row and time column backgrounds.",
      ),
      rowText: colorField("Row text", "222"),
      secondaryBackground: colorField("Time column background", "BBB"),
      secondaryText: colorField("Time column text", "222"),
    },
    fonts: {
      title: fontField("Title", "GameFontSemiBold"),
      accent: fontField("Rank and badges", "GameFontSemiBold"),
      name: fontField("Name", "GameFontRegular"),
      points: fontField("Points", "GameFontSemiBold"),
      time: fontField("Time", "GameFontSemiBold"),
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
