import { IconSettings } from "@tabler/icons-react";
import { createContext, useMemo, useState } from "react";
import React from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { GatewayConnectionNotifier } from "@/components/layout/gateway-connection-notifier";
import { Button } from "@/components/ui/button";
import { SidebarProvider } from "@/components/ui/sidebar";
import SettingsDialog from "@/features/settings/settings-dialog";
import { useConnectionStore } from "@/store/connection";
import useSettingsStore from "@/store/settings";

type LayoutContextType = {
  display: boolean;
  show: () => void;
  hide: () => void;
};

const LayoutContext = createContext<LayoutContextType>(null);

interface Props {
  children: React.ReactNode;
}

export const LayoutProvider = ({ children }: Props) => {
  const [hasLayout, setHasLayout] = useState<boolean>(true);

  const { setOpen } = useSettingsStore();
  const { status } = useConnectionStore();

  const statusColor =
    status === "connected"
      ? "bg-green-500"
      : status === "connecting"
        ? "bg-yellow-500"
        : status === "error"
          ? "bg-red-500"
          : "bg-gray-400";

  const value = useMemo<LayoutContextType>(() => {
    return {
      display: hasLayout,
      show() {
        setHasLayout(true);
      },
      hide() {
        setHasLayout(false);
      },
    };
  }, [hasLayout]);

  return (
    <LayoutContext.Provider value={value}>
      {hasLayout ? (
        <div className="flex h-[100dvh] w-full overflow-hidden">
          <SidebarProvider open={false}>
            <AppSidebar
              footer={
                <div className="relative w-full">
                  <Button size="icon" className="w-full" onClick={() => setOpen(true)}>
                    <IconSettings />
                  </Button>
                  <span
                    className={`absolute top-1 right-1 h-2 w-2 rounded-full ${statusColor}`}
                    title="Gateway 连接状态"
                  />
                </div>
              }
            />
            <main className="flex flex-col flex-1 min-w-0">
              <div className="flex-1 overflow-hidden">{children}</div>
            </main>
            <SettingsDialog />
            <GatewayConnectionNotifier />
          </SidebarProvider>
        </div>
      ) : (
        <div className="h-[100dvh] w-full overflow-hidden">{children}</div>
      )}
    </LayoutContext.Provider>
  );
};

export const useLayout = () => {
  const layoutContext = React.useContext(LayoutContext);

  if (!layoutContext) {
    throw new Error("useSearch has to be used within <LayoutContext.Provider>");
  }

  return layoutContext;
};
