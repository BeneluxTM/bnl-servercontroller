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
      headerBackground: colorField("Header background", "08080A"),
      headerOpacity: opacityField("Header opacity", 0.95),
      headerText: colorField("Header text", "F4F4F5"),
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
      name: fontField("Name", "GameFontSemiBold"),
      checkpoint: fontField("Checkpoint", "RajdhaniMono"),
      time: fontField("Time", "RajdhaniMono"),
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
