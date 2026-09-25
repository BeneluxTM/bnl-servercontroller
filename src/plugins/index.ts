import { GbxClientManager } from "@/lib/managers/gbxclient-manager";
import ManialinkManager from "@/lib/managers/manialink-manager";
import Manialink from "@/lib/manialink/components/manialink";
import { resolvePluginUi } from "@/lib/plugin-ui";
import { PluginUiValues } from "@/types/plugins/ui";
import { getPluginUiDefinition } from "./ui";

export default abstract class Plugin<ConfigType = unknown> {
  static pluginId: string;
  static gamemodes: string[] = [];
  static helpText: string = "No help text provided for this plugin.";
  protected clientManager: GbxClientManager;
  protected manialinkManager: ManialinkManager;
  private loaded: boolean = false;
  protected dbPluginId: string = "";
  protected config: ConfigType | null = null;
  /** Customized UI of the plugin, see ./ui.ts for the values every plugin supports. */
  protected ui: PluginUiValues;
  private uiConfigKey: string = "null";

  constructor(
    clientManager: GbxClientManager,
    manialinkManager: ManialinkManager,
  ) {
    this.clientManager = clientManager;
    this.manialinkManager = manialinkManager;
    this.ui = this.resolveUi(null);
  }

  abstract onLoad(): Promise<void>;
  abstract onUnload(): Promise<void>;
  abstract onStart(): Promise<void>;

  async onConfigUpdate(): Promise<void> {}

  async onUiConfigUpdate(): Promise<void> {}

  setConfig(config: ConfigType) {
    this.config = config;
    this.onConfigUpdate();
  }

  /** Sets the stored UI overrides of the plugin, the plugin is only notified when they changed. */
  setUiConfig(uiConfig: unknown) {
    const key = JSON.stringify(uiConfig ?? null);
    if (key === this.uiConfigKey) return;

    this.uiConfigKey = key;
    this.ui = this.resolveUi(uiConfig);
    this.onUiConfigUpdate();
  }

  setDbPluginId(dbPluginId: string) {
    this.dbPluginId = dbPluginId;
  }

  getPluginId(): string {
    return (this.constructor as typeof Plugin).pluginId;
  }

  getSupportedGamemodes(): string[] {
    return (this.constructor as typeof Plugin).gamemodes;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  getHelpText(): string {
    return (this.constructor as typeof Plugin).helpText;
  }

  public setLoaded(loaded: boolean) {
    this.loaded = loaded;
  }

  /**
   * Applies the customized UI to one of the plugin's manialinks. With `layout`, the position and
   * hide while driving setting are applied too. With `refresh`, a displayed manialink is sent again.
   */
  protected applyUi(
    manialink: Manialink,
    {
      refresh = false,
      layout = true,
    }: { refresh?: boolean; layout?: boolean } = {},
  ) {
    manialink.setUi(this.ui);

    if (layout) {
      const { x, y, hideWhileDriving } = this.ui.layout ?? {};
      if (typeof x === "number" && typeof y === "number") {
        manialink.setPosition({ x, y });
      }
      if (typeof hideWhileDriving === "boolean") {
        manialink.setHideWhileDriving(hideWhileDriving);
      }
    }

    if (refresh && manialink.isDisplayed()) {
      manialink.display();
    }
  }

  private resolveUi(uiConfig: unknown): PluginUiValues {
    const definition = getPluginUiDefinition(this.getPluginId());
    return definition ? resolvePluginUi(definition, uiConfig) : {};
  }
}
