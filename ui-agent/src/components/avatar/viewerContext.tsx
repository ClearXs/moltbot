"use client";

import type { VRM } from "@pixiv/three-vrm";
import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface ViewerContextValue {
  viewer: VRM | null;
  setViewer: (vrm: VRM | null) => void;
  isLoaded: boolean;
}

const ViewerContext = createContext<ViewerContextValue>({
  viewer: null,
  setViewer: () => {},
  isLoaded: false,
});

export function useViewer() {
  return useContext(ViewerContext);
}

interface ViewerProviderProps {
  children: ReactNode;
}

export function ViewerProvider({ children }: ViewerProviderProps) {
  const [viewer, setViewer] = useState<VRM | null>(null);

  const handleSetViewer = useCallback((vrm: VRM | null) => {
    setViewer(vrm);
  }, []);

  return (
    <ViewerContext.Provider
      value={{
        viewer,
        setViewer: handleSetViewer,
        isLoaded: viewer !== null,
      }}
    >
      {children}
    </ViewerContext.Provider>
  );
}
