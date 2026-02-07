"use client";

import { ChevronDown, Maximize, Minimize } from "lucide-react";
import { use, useEffect, useState } from "react";
import DraggableWrapper from "@/components/dragble-wrapper";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import usePersonaApi, { Personas } from "@/services/personas";

export default function PersonaDetails({ params }: { params: Promise<{ idx: string }> }) {
  const { idx } = use(params);
  const personaApi = usePersonaApi();
  const [persona, setPersona] = useState<Personas | undefined>();
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    void personaApi
      .getPersona(idx)
      .then((data) => {
        setPersona(data);
      })
      .catch((error) => {
        console.error("Failed to load persona", error);
      });
  }, [idx]);

  return (
    <div className="h-full w-full">
      {/* <header className='absolute w-full h-12 top-0 flex flex-row justify-center items-center gap-1 p-3 bg-[var(--sidebar-primary-foreground)]'>
        <Button
          size='icon'
          onClick={() => {
            layout.show();
            router.back();
          }}
        >
          <IconArrowLeft />
        </Button>

        <Button className='ml-auto'>
          <SaveIcon /> Apply
        </Button>
      </header> */}

      <DraggableWrapper
        title={persona?.name}
        width="min-w-96"
        className="z-[100]"
        fullScreenWidth="60%"
        fullScreenHeight="auto"
        defaultPosition={{ x: 0, y: 50 }}
        onFullScreenChange={setIsFullScreen}
        maximizeButton={
          <Button variant="ghost" size="sm" className="rounded-md p-2">
            {isFullScreen ? (
              <Minimize strokeWidth={3} className="size-4" />
            ) : (
              <Maximize strokeWidth={3} className="size-4" />
            )}
          </Button>
        }
        minimizeButton={
          <Button variant="ghost" size="sm" className="rounded-md p-2">
            <ChevronDown strokeWidth={3} className="size-4" />
          </Button>
        }
      >
        <ScrollArea className="flex-1 px-4 h-[400px]">
          {persona && (
            <div className="space-y-4 py-2">
              <div>
                <div className="text-xs text-muted-foreground">Agent ID</div>
                <div className="text-sm font-medium">{persona.id}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Name</div>
                <div className="text-sm font-medium">{persona.name}</div>
              </div>
              {persona.identity?.emoji && (
                <div>
                  <div className="text-xs text-muted-foreground">Emoji</div>
                  <div className="text-sm font-medium">{persona.identity.emoji}</div>
                </div>
              )}
              {persona.identity?.theme && (
                <div>
                  <div className="text-xs text-muted-foreground">Theme</div>
                  <div className="text-sm font-medium">{persona.identity.theme}</div>
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                Persona config editing is not wired to Gateway yet.
              </div>
            </div>
          )}
        </ScrollArea>
      </DraggableWrapper>
    </div>
  );
}
