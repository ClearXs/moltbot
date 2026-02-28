"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ContextMenuProps {
  children: React.ReactNode;
}

interface ContextMenuTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
  onClick?: () => void;
}

interface ContextMenuContentProps {
  children: React.ReactNode;
  className?: string;
}

interface ContextMenuItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

interface ContextMenuSeparatorProps {
  className?: string;
}

const ContextMenuContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
  position: { x: number; y: number };
  setPosition: (pos: { x: number; y: number }) => void;
}>({
  open: false,
  setOpen: () => {},
  position: { x: 0, y: 0 },
  setPosition: () => {},
});

export function ContextMenu({ children }: ContextMenuProps) {
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });

  return (
    <ContextMenuContext.Provider value={{ open, setOpen, position, setPosition }}>
      {children}
    </ContextMenuContext.Provider>
  );
}

export function ContextMenuTrigger({ children, onClick }: ContextMenuTriggerProps) {
  const { setOpen, setPosition } = React.useContext(ContextMenuContext);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setPosition({ x: e.clientX, y: e.clientY });
    setOpen(true);
  };

  const handleClick = (e: React.MouseEvent) => {
    // 透传点击事件
    onClick?.();
  };

  return (
    <div onContextMenu={handleContextMenu} onClick={handleClick}>
      {children}
    </div>
  );
}

export function ContextMenuContent({ children, className }: ContextMenuContentProps) {
  const { open, setOpen, position } = React.useContext(ContextMenuContext);

  React.useEffect(() => {
    const handleClick = () => setOpen(false);
    if (open) {
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed z-50 min-w-[160px] overflow-hidden rounded-md border bg-white py-1 shadow-md",
        className,
      )}
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {children}
    </div>
  );
}

export function ContextMenuItem({ children, onClick, className, disabled }: ContextMenuItemProps) {
  const { setOpen } = React.useContext(ContextMenuContext);

  const handleClick = () => {
    onClick?.();
    setOpen(false);
  };

  return (
    <button
      className={cn(
        "flex w-full items-center gap-2 px-2 py-1.5 text-sm outline-none hover:bg-gray-100 disabled:opacity-50",
        className,
      )}
      onClick={handleClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function ContextMenuSeparator({ className }: ContextMenuSeparatorProps) {
  return <div className={cn("h-px bg-gray-200 my-1", className)} />;
}
