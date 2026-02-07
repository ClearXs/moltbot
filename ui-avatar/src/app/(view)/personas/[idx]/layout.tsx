"use client";

import { useEffect } from "react";
import { useLayout } from "@/context/layout-context";

export default function PersonaStageLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const layout = useLayout();

  useEffect(() => {
    layout.hide();
  }, []);

  return <>{children}</>;
}
