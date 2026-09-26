import {
  colorField,
  fontField,
  opacityField,
  positionFields,
  scaleField,
  textField,
  textSizeField,
} from "@/lib/plugin-ui";
import { PluginUiDefinition } from "@/types/plugins/ui";

export const matchUi: PluginUiDefinition = {
  name: "Match",
  description:
    "Pick and ban widget, and the window to choose the position of a picked map.",
  sections: {
    layout: {
      ...positionFields(-60, 67),
      ...scaleField(),
    },
    colors: {
      headerBackground: colorField("Status bar background", "08080A"),
      headerOpacity: opacityField("Status bar opacity", 0.95),
      headerText: colorField("Status bar text", "F4F4F5"),
      progressBar: colorField("Timer bar", "F12020"),
      accentBackground: colorField("Position background", "16161A"),
      accentOpacity: opacityField("Position opacity", 0.95),
      accentText: colorField("Position text", "F4F4F5"),
      rowBackground: colorField("Map background", "08080A"),
      rowOpacity: opacityField(
        "Map opacity",
        0.88,
        "Banned maps are shown at 70% of this opacity.",
      ),
      rowText: colorField("Map text", "F4F4F5"),
      highlightBackground: colorField(
        "Selected map background",
        "3A3A42",
        "Background of the map selected with the keyboard or a controller.",
      ),
      backdrop: colorField("Backdrop", "08080A"),
      backdropOpacity: opacityField("Backdrop opacity", 0.75),
      windowHeaderBackground: colorField("Window header background", "08080A"),
      windowHeaderText: colorField("Window header text", "F4F4F5"),
      windowBackground: colorField("Window background", "0F0F12"),
    },
    fonts: {
      header: fontField("Status text", "Nadeo/Trackmania/BebasNeueRegular"),
      accent: fontField("Position", "Nadeo/Trackmania/BebasNeueRegular"),
      name: fontField("Map name", "GameFontSemiBold"),
      author: fontField("Author", "GameFontRegular"),
      status: fontField("Pick and ban status", "Nadeo/Trackmania/BebasNeueRegular"),
    },
    textSizes: {
      icon: textSizeField("Status icon", 2.5),
      header: textSizeField("Status text", 1.75),
      accent: textSizeField("Position", 3),
      name: textSizeField("Map name", 1.75),
      author: textSizeField("Author", 1),
      status: textSizeField("Pick and ban status", 1.75),
    },
    texts: {
      picking: textField(
        "Picking",
        "is picking a map",
        64,
        "Shown after the name of the player or team.",
      ),
      banning: textField(
        "Banning",
        "is banning a map",
        64,
        "Shown after the name of the player or team.",
      ),
      randomPicking: textField("Random pick", "Random map is being picked"),
      completed: textField("Completed", "Pick and ban completed"),
      pickedBy: textField("Picked by", "Picked by"),
      bannedBy: textField("Banned by", "Banned by"),
      random: textField("Randomly picked", "Random"),
      windowTitle: textField("Position window title", "Choose Position"),
    },
  },
};
