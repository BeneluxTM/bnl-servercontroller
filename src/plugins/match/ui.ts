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
      headerBackground: colorField("Status bar background", "222"),
      headerOpacity: opacityField("Status bar opacity"),
      headerText: colorField("Status bar text", "DDD"),
      progressBar: colorField("Timer bar", "DDD"),
      accentBackground: colorField("Position background", "222"),
      accentOpacity: opacityField("Position opacity"),
      accentText: colorField("Position text", "DDD"),
      rowBackground: colorField("Map background", "DDD"),
      rowOpacity: opacityField(
        "Map opacity",
        1,
        "Banned maps are shown at 70% of this opacity.",
      ),
      rowText: colorField("Map text", "222"),
      highlightBackground: colorField(
        "Selected map background",
        "999",
        "Background of the map selected with the keyboard or a controller.",
      ),
      backdrop: colorField("Backdrop", "222"),
      backdropOpacity: opacityField("Backdrop opacity", 0.75),
      windowHeaderBackground: colorField("Window header background", "222"),
      windowHeaderText: colorField("Window header text", "FFF"),
      windowBackground: colorField("Window background", "DDD"),
    },
    fonts: {
      header: fontField("Status text", "GameFontSemiBold"),
      accent: fontField("Position", "GameFontBlack"),
      name: fontField("Map name", "GameFontSemiBold"),
      author: fontField("Author", "GameFontRegular"),
      status: fontField("Pick and ban status", "GameFontSemiBold"),
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
