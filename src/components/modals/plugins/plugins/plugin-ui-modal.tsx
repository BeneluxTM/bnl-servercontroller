"use client";

import { Card } from "@/components/ui/card";
import PluginUiForm from "@/forms/server/plugins/plugin-ui/plugin-ui-form";
import { getPluginUiDefinition } from "@/plugins/ui";
import { PluginUiValues } from "@/types/plugins/ui";
import { IconX } from "@tabler/icons-react";
import { DefaultModalProps } from "../../default-props";

export default function PluginUiModal({
  serverId,
  data,
  closeModal,
  onSubmit,
}: DefaultModalProps<
  {
    pluginId: string;
    pluginName: string;
    ui: unknown;
  },
  PluginUiValues
>) {
  const definition = data ? getPluginUiDefinition(data.pluginName) : undefined;

  if (!serverId || !data || !data.pluginId || !definition) {
    return null;
  }

  const stopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <Card
      onClick={stopPropagation}
      className="p-6 gap-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto"
    >
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold">{definition.name} UI</h1>
          <p className="text-sm text-muted-foreground">
            {definition.description} Changes are shown in game as soon as they
            are saved.
          </p>
        </div>

        <IconX
          className="h-6 w-6 shrink-0 cursor-pointer text-muted-foreground ml-2"
          onClick={closeModal}
        />
      </div>

      <PluginUiForm
        serverId={serverId}
        pluginId={data.pluginId}
        pluginName={data.pluginName}
        definition={definition}
        ui={data.ui}
        onSubmit={onSubmit}
        onClose={closeModal}
      />
    </Card>
  );
}
