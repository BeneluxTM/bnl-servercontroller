"use client";

import { ServerPluginsWithPlugin } from "@/actions/database/server-only/gbx";
import {
  reloadServerPlugins,
  updateServerPlugins,
} from "@/actions/database/server-plugins";
import FormElement from "@/components/form/form-element";
import Modal from "@/components/modals/modal";
import EcircuitmaniaPluginModal from "@/components/modals/plugins/plugins/ecircuitmania-plugin-modal";
import LiveRoundPluginModal from "@/components/modals/plugins/plugins/live-round-plugin-modal";
import MatchPluginModal from "@/components/modals/plugins/plugins/match-plugin-modal";
import PlayerInfoPluginModal from "@/components/modals/plugins/plugins/player-info-plugin-modal";
import PluginUiModal from "@/components/modals/plugins/plugins/plugin-ui-modal";
import RecordsInfoPluginModal from "@/components/modals/plugins/plugins/records-info-plugin-modal";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Plugins } from "@/lib/prisma/generated";
import { getErrorMessage } from "@/lib/utils";
import { getPluginUiDefinition } from "@/plugins/ui";
import { ECMPluginConfig } from "@/types/plugins/ecm";
import { MatchPluginConfig } from "@/types/plugins/match";
import { PlayerInfoPluginConfig } from "@/types/plugins/player-info";
import { RecordsInfoPluginConfig } from "@/types/plugins/records-info";
import { PluginUiValues } from "@/types/plugins/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  IconDeviceFloppy,
  IconPalette,
  IconReload,
  IconSettings,
} from "@tabler/icons-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { PluginsSchema, PluginsSchemaType } from "./plugins-schema";
import { ServerError } from "@/types/responses";

export default function PluginsForm({
  serverId,
  serverPlugins,
  plugins,
}: {
  serverId: string;
  serverPlugins: ServerPluginsWithPlugin[];
  plugins: Plugins[];
}) {
  const [configModalOpen, setConfigModalOpen] = useState<
    keyof PluginsSchemaType | undefined
  >();

  const [uiModalOpen, setUiModalOpen] = useState<string | undefined>();

  const [serverPluginsState, setServerPluginsState] = useState(serverPlugins);

  const defaultValues: PluginsSchemaType = plugins.reduce((acc, plg) => {
    const sp = serverPlugins.find((sp) => sp.pluginId === plg.id);

    return {
      ...acc,
      [plg.name]: sp?.enabled,
    };
  }, {} as PluginsSchemaType);

  const form = useForm<PluginsSchemaType>({
    resolver: zodResolver(PluginsSchema),
    defaultValues,
  });

  async function onSubmit(values: PluginsSchemaType) {
    try {
      const { error } = await updateServerPlugins(
        serverId,
        plugins.map((p) => ({
          pluginId: p.id,
          enabled: values[p.name as keyof PluginsSchemaType] || false,
        })),
      );
      if (error) {
        throw new ServerError(error, "UpdateServerPluginsError");
      }
      toast.success("Plugins successfully saved");
    } catch (error) {
      toast.error("Failed to save plugins", {
        description: getErrorMessage(error),
      });
    }
  }

  const handleConfigUpdate = (name: string, config?: any) => {
    setServerPluginsState((prev) => {
      return prev.map((sp) => {
        if (sp.plugin.name === name) {
          return { ...sp, config };
        }
        return sp;
      });
    });
  };

  const handleUiUpdate = (name: string, ui?: PluginUiValues) => {
    const plugin = plugins.find((p) => p.name === name);
    if (!plugin) return;

    setServerPluginsState((prev) => {
      if (prev.some((sp) => sp.plugin.name === name)) {
        return prev.map((sp) =>
          sp.plugin.name === name ? { ...sp, ui: ui ?? null } : sp,
        );
      }

      // The server plugin is created when its UI is saved for the first time
      return [
        ...prev,
        {
          serverId,
          pluginId: plugin.id,
          enabled: false,
          config: null,
          ui: ui ?? null,
          plugin,
        },
      ];
    });
  };

  const customizeUiButton = (name: string) =>
    getPluginUiDefinition(name) && (
      <Button
        variant={"outline"}
        type="button"
        collapse="sm"
        title="Customize the in-game UI"
        aria-label="Customize the in-game UI"
        onClick={() => setUiModalOpen(name)}
      >
        <IconPalette />
        UI
      </Button>
    );

  const handleReloadPlugins = async () => {
    try {
      const { error } = await reloadServerPlugins(serverId);

      if (error) {
        throw new ServerError(error, "ReloadServerPluginsError");
      }

      toast.success("Plugins reloaded successfully");
    } catch (error) {
      toast.error("Failed to reload plugins", {
        description: getErrorMessage(error),
      });
    }
  };

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-6"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            <FormElement
              name="admin"
              label="Admin Plugin"
              type="checkbox"
              description={
                plugins.find((p) => p.name === "admin")?.description || ""
              }
            >
              {customizeUiButton("admin")}
            </FormElement>

            <FormElement
              name="ecm"
              label="eCircuitMania Plugin"
              type="checkbox"
              description={
                plugins.find((p) => p.name === "ecm")?.description || ""
              }
            >
              <Button
                variant={"outline"}
                type="button"
                collapse="sm"
                onClick={() => setConfigModalOpen("ecm")}
              >
                <IconSettings />
                Configure
              </Button>
              {customizeUiButton("ecm")}
            </FormElement>

            <FormElement
              name="map-info"
              label="Map Info Plugin"
              type="checkbox"
              description={
                plugins.find((p) => p.name === "map-info")?.description || ""
              }
            >
              {customizeUiButton("map-info")}
            </FormElement>

            <FormElement
              name="records-info"
              label="Records Info Plugin"
              type="checkbox"
              description={
                plugins.find((p) => p.name === "records-info")?.description ||
                ""
              }
            >
              <Button
                variant={"outline"}
                type="button"
                collapse="sm"
                onClick={() => setConfigModalOpen("records-info")}
              >
                <IconSettings />
                Configure
              </Button>
              {customizeUiButton("records-info")}
            </FormElement>

            <FormElement
              name="live-ranking"
              label="Live Ranking Plugin"
              type="checkbox"
              description={
                plugins.find((p) => p.name === "live-ranking")?.description ||
                ""
              }
            >
              {customizeUiButton("live-ranking")}
            </FormElement>

            <FormElement
              name="live-round"
              label="Live Round Plugin"
              type="checkbox"
              description={
                plugins.find((p) => p.name === "live-round")?.description || ""
              }
            >
              <Button
                variant={"outline"}
                type="button"
                collapse="sm"
                onClick={() => setConfigModalOpen("live-round")}
              >
                <IconSettings />
                Configure
              </Button>
              {customizeUiButton("live-round")}
            </FormElement>

            <FormElement
              name="ta-leaderboard"
              label="TA Leaderboard Plugin"
              type="checkbox"
              description={
                plugins.find((p) => p.name === "ta-leaderboard")?.description ||
                ""
              }
            >
              {customizeUiButton("ta-leaderboard")}
            </FormElement>

            <FormElement
              name="ta-active-runs"
              label="TA Active Runs Plugin"
              type="checkbox"
              description={
                plugins.find((p) => p.name === "ta-active-runs")?.description ||
                ""
              }
            >
              {customizeUiButton("ta-active-runs")}
            </FormElement>

            <FormElement
              name="player-info"
              label="Player Info Plugin"
              type="checkbox"
              description={
                plugins.find((p) => p.name === "player-info")?.description || ""
              }
            >
              <Button
                variant={"outline"}
                type="button"
                collapse="sm"
                onClick={() => setConfigModalOpen("player-info")}
              >
                <IconSettings />
                Configure
              </Button>
              {customizeUiButton("player-info")}
            </FormElement>

            <FormElement
              name="match"
              label="Match Plugin"
              type="checkbox"
              description={
                plugins.find((p) => p.name === "match")?.description || ""
              }
            >
              <Button
                variant={"outline"}
                type="button"
                collapse="sm"
                onClick={() => setConfigModalOpen("match")}
              >
                <IconSettings />
                Configure
              </Button>
              {customizeUiButton("match")}
            </FormElement>
          </div>

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="max-w-24"
            >
              <IconDeviceFloppy />
              Save
            </Button>

            <Button
              variant={"outline"}
              type="button"
              onClick={handleReloadPlugins}
              disabled={form.formState.isSubmitting}
            >
              <IconReload />
              Reload Plugins
            </Button>
          </div>
        </form>
      </Form>

      <Modal
        isOpen={!!uiModalOpen}
        setIsOpen={() => setUiModalOpen(undefined)}
        closeOnBackdropClick={false}
      >
        <PluginUiModal
          serverId={serverId}
          data={
            uiModalOpen
              ? {
                  pluginId:
                    plugins.find((p) => p.name === uiModalOpen)?.id || "",
                  pluginName: uiModalOpen,
                  ui: serverPluginsState.find(
                    (sp) => sp.plugin.name === uiModalOpen,
                  )?.ui,
                }
              : undefined
          }
          onSubmit={(ui) => {
            if (uiModalOpen) handleUiUpdate(uiModalOpen, ui);
          }}
        />
      </Modal>

      <Modal
        isOpen={configModalOpen === "ecm"}
        setIsOpen={() => setConfigModalOpen(undefined)}
        closeOnBackdropClick={false}
      >
        <EcircuitmaniaPluginModal
          serverId={serverId}
          data={{
            pluginId: plugins.find((p) => p.name === "ecm")?.id || "",
            config: serverPluginsState.find((sp) => sp.plugin.name === "ecm")
              ?.config as ECMPluginConfig,
          }}
          onSubmit={(config) => {
            handleConfigUpdate("ecm", config);
          }}
        />
      </Modal>

      <Modal
        isOpen={configModalOpen === "player-info"}
        setIsOpen={() => setConfigModalOpen(undefined)}
        closeOnBackdropClick={false}
      >
        <PlayerInfoPluginModal
          serverId={serverId}
          data={{
            pluginId: plugins.find((p) => p.name === "player-info")?.id || "",
            config: serverPluginsState.find(
              (sp) => sp.plugin.name === "player-info",
            )?.config as PlayerInfoPluginConfig,
          }}
          onSubmit={(config) => {
            handleConfigUpdate("player-info", config);
          }}
        />
      </Modal>

      <Modal
        isOpen={configModalOpen === "records-info"}
        setIsOpen={() => setConfigModalOpen(undefined)}
        closeOnBackdropClick={false}
      >
        <RecordsInfoPluginModal
          serverId={serverId}
          data={{
            pluginId: plugins.find((p) => p.name === "records-info")?.id || "",
            config: serverPluginsState.find(
              (sp) => sp.plugin.name === "records-info",
            )?.config as RecordsInfoPluginConfig,
          }}
          onSubmit={(config) => {
            handleConfigUpdate("records-info", config);
          }}
        />
      </Modal>

      <Modal
        isOpen={configModalOpen === "match"}
        setIsOpen={() => setConfigModalOpen(undefined)}
        closeOnBackdropClick={false}
      >
        <MatchPluginModal
          serverId={serverId}
          data={{
            pluginId: plugins.find((p) => p.name === "match")?.id || "",
            config: serverPluginsState.find((sp) => sp.plugin.name === "match")
              ?.config as MatchPluginConfig,
          }}
          onSubmit={(config) => {
            handleConfigUpdate("match", config);
          }}
        />
      </Modal>

      <Modal
        isOpen={configModalOpen === "live-round"}
        setIsOpen={() => setConfigModalOpen(undefined)}
        closeOnBackdropClick={false}
      >
        <LiveRoundPluginModal
          serverId={serverId}
          data={{
            pluginId: plugins.find((p) => p.name === "live-round")?.id || "",
            config: serverPluginsState.find(
              (sp) => sp.plugin.name === "live-round",
            )?.config as any,
          }}
          onSubmit={(config) => {
            handleConfigUpdate("live-round", config);
          }}
        />
      </Modal>
    </>
  );
}
