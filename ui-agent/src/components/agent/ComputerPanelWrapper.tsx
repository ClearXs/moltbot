"use client";

import { FileItemProps } from "@/components/files/FileList";
import { Accordion, AccordionContent, AccordionItem } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { ComputerPanel } from "./ComputerPanel";
import { ComputerTriggerBar } from "./ComputerTriggerBar";

interface ComputerPanelWrapperProps {
  files: FileItemProps[];
  isOpen: boolean;
  onToggle: () => void;
  compact?: boolean;
}

export function ComputerPanelWrapper({
  files,
  isOpen,
  onToggle,
  compact = false,
}: ComputerPanelWrapperProps) {
  // 如果没有文件，不渲染任何内容
  if (files.length === 0) return null;

  // 使用 Accordion 组件，value 控制展开/收起状态
  const accordionValue = isOpen ? "computer-panel" : "";

  const handleValueChange = (value: string) => {
    // 当 accordion 值改变时，切换状态
    if ((value === "computer-panel") !== isOpen) {
      onToggle();
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="w-full md:max-w-[800px] lg:max-w-[1000px] px-md md:px-xl lg:px-2xl pb-0">
        <Accordion
          type="single"
          collapsible
          value={accordionValue}
          onValueChange={handleValueChange}
        >
          <AccordionItem value="computer-panel" className="border-none">
            {/* 触发按钮容器 - 不需要边框背景,只在展开时整体容器有边框 */}
            <div className="flex justify-start mb-1">
              <ComputerTriggerBar
                fileCount={files.length}
                isOpen={isOpen}
                compact={compact}
                onClick={onToggle}
              />
            </div>

            {/* 展开的内容区域 - 带边框和背景 */}
            {isOpen && (
              <div
                className={cn(
                  "border border-primary transition-all",
                  compact
                    ? "bg-background-secondary rounded-xl"
                    : "bg-background-secondary rounded-2xl shadow-sm",
                )}
              >
                <AccordionContent className="px-0 pb-0 pt-0">
                  <ComputerPanel
                    files={files}
                    isOpen={isOpen}
                    onClose={onToggle}
                    fullscreen={false}
                  />
                </AccordionContent>
              </div>
            )}
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
