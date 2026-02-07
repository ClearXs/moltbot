/**
 * ThemeSwitcher Component
 *
 * Provides a dropdown menu for switching between available themes.
 * Positioned in the Header, left of the user avatar.
 */

"use client";

import { Palette, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { THEMES } from "@/config/themes";
import { useThemeStore } from "@/stores/themeStore";

export function ThemeSwitcher() {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="w-9 h-9" aria-label="切换主题">
          <Palette className="w-5 h-5" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>选择主题</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {THEMES.map((t) => (
          <DropdownMenuItem
            key={t.value}
            onClick={() => setTheme(t.value)}
            className="cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                {/* 色块预览 - 3个圆点 */}
                <div className="flex gap-1">
                  <div
                    className="w-4 h-4 rounded-full border border-border"
                    style={{ backgroundColor: t.colors.primary }}
                  />
                  <div
                    className="w-4 h-4 rounded-full border border-border"
                    style={{ backgroundColor: t.colors.secondary }}
                  />
                  {t.colors.accent && (
                    <div
                      className="w-4 h-4 rounded-full border border-border"
                      style={{ backgroundColor: t.colors.accent }}
                    />
                  )}
                </div>

                {/* 主题名称 */}
                <div>
                  <div className="font-medium">{t.label}</div>
                  <div className="text-xs text-text-tertiary">{t.description}</div>
                </div>
              </div>

              {/* 选中标记 */}
              {theme === t.value && <Check className="w-4 h-4 text-primary" />}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
