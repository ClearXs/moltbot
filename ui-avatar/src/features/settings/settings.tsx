"use client";

import SidebarNav from "@/components/sidebar-nav";
import useSettingsStore from "@/store/settings";
import SettingsEmbedding from "./embedding";
import SettingsGateway from "./gateway";
import SettingsModel from "./model";
import SettingsSystem from "./system";
import SettingsTTS from "./tts";
import SettingsWhisper from "./whisper";

export type SettingsProps = {};

export default function Settings(props: SettingsProps) {
  const settingStore = useSettingsStore();

  return (
    <div className="flex flex-row space-y-2 overflow-hidden md:space-y-2 lg:flex-row lg:space-y-0 h-full">
      <aside className="top-0 lg:sticky lg:w-1/5">
        <SidebarNav
          items={settingStore.settingItems}
          selectKey={settingStore.selectKey}
          onSelectKey={settingStore.setSelectKey}
        />
      </aside>
      <div className="w-full h-full p-4">
        {settingStore.selectKey === "model" && <SettingsModel {...props} />}
        {settingStore.selectKey === "embedding" && <SettingsEmbedding {...props} />}
        {settingStore.selectKey === "tts" && <SettingsTTS {...props} />}
        {settingStore.selectKey === "whisper" && <SettingsWhisper {...props} />}
        {settingStore.selectKey === "system" && <SettingsSystem {...props} />}
        {settingStore.selectKey === "gateway" && <SettingsGateway {...props} />}
      </div>
    </div>
  );
}
