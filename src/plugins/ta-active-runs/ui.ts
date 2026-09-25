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

export const taActiveRunsUi: PluginUiDefinition = {
  name: "TA Active Runs",
  description:
    "List of the players that are currently driving, with their checkpoint and time.",
  sections: {
    layout: {
      ...positionFields(-156, 73.5),
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
      name: fontField("Name", "GameFontRegular"),
      checkpoint: fontField("Checkpoint", "GameFontRegular"),
      time: fontField("Time", "GameFontSemiBold"),
    },
    textSizes: {
      title: textSizeField("Title", 1),
      name: textSizeField("Name", 1.2),
      checkpoint: textSizeField("Checkpoint", 1),
      time: textSizeField("Time", 1),
    },
    texts: {
      title: textField("Title", "Active Runs"),
    },
  },
};
