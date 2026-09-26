import { PluginUiDefinition } from "@/types/plugins/ui";
import { ecmUi } from "./ecm/ui";
import { liveRankingUi } from "./live-ranking/ui";
import { liveRoundUi } from "./live-round/ui";
import { mapInfoUi } from "./map-info/ui";
import { matchUi } from "./match/ui";
import { notifyAdminUi } from "./notify-admin/ui";
import { playerInfoUi } from "./player-info/ui";
import { recordsInfoUi } from "./records-info/ui";
import { taActiveRunsUi } from "./ta-active-runs/ui";
import { taLeaderboardUi } from "./ta-leaderboard/ui";

/**
 * Customizable in-game UI of every plugin, keyed by plugin id.
 * Kept free of server-only imports so the web panel can build its forms from it.
 */
export const pluginUiDefinitions: Record<string, PluginUiDefinition> = {
  admin: notifyAdminUi,
  ecm: ecmUi,
  "live-ranking": liveRankingUi,
  "live-round": liveRoundUi,
  "map-info": mapInfoUi,
  match: matchUi,
  "player-info": playerInfoUi,
  "records-info": recordsInfoUi,
  "ta-active-runs": taActiveRunsUi,
  "ta-leaderboard": taLeaderboardUi,
};

export function getPluginUiDefinition(
  pluginId: string,
): PluginUiDefinition | undefined {
  return Object.prototype.hasOwnProperty.call(pluginUiDefinitions, pluginId)
    ? pluginUiDefinitions[pluginId]
    : undefined;
}
