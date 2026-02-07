"use client";

import { Edit, Trash2, Plus, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useLayout } from "@/context/layout-context";
import { callGateway } from "@/services/gateway";
import usePersonaApi, { Persona } from "@/services/personas";

export type SettingsProfileProps = {};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const NoImageSkeleton = () => (
  <div className="w-full h-48 bg-gray-100 rounded-t-lg flex flex-col items-center justify-center space-y-2">
    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center animate-pulse">
      <User className="w-8 h-8 text-gray-400" />
    </div>
    <span className="text-gray-400 text-sm font-medium">No Avatar</span>
  </div>
);

const PersonaCard = ({
  persona,
  onEdit,
  onDelete,
}: {
  persona: Persona;
  onEdit: (persona: Persona) => void;
  onDelete: (id: string) => void;
}) => {
  const router = useRouter();
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const layout = useLayout();

  return (
    <>
      <Card
        className={`group overflow-hidden transition-all duration-300 hover:scale-105 py-0 gap-2`}
        onClick={() => {
          layout.hide();
          setTimeout(() => {
            router.push(`/personas/${persona.id}`);
          }, 100);
        }}
      >
        <div className="relative">
          {!persona.avatarUrl || imageError ? (
            <NoImageSkeleton />
          ) : (
            <div className="relative w-full h-48 overflow-hidden">
              {imageLoading && <Skeleton className="absolute inset-0 w-full h-full" />}
              <img
                src={persona.avatarUrl}
                alt={persona.name}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
                  imageLoading ? "opacity-0" : "opacity-100"
                }`}
                onLoad={() => setImageLoading(false)}
                onError={() => {
                  setImageError(true);
                  setImageLoading(false);
                }}
              />
            </div>
          )}

          {/* Status Badge */}
          <Badge
            className={`absolute top-3 left-3 border-none ${
              persona.isDefault ? "bg-green-500 text-white" : "bg-blue-500 text-white"
            }`}
          >
            {persona.isDefault ? "Default" : "Agent"}
          </Badge>

          {/* Action Buttons */}
          <div className="absolute top-3 right-3 flex space-x-1">
            <Button
              size="sm"
              variant="secondary"
              className="p-2 bg-white/80 backdrop-blur-sm hover:bg-white"
              onClick={() => onEdit(persona)}
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="p-2 bg-white/80 backdrop-blur-sm hover:bg-white"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </div>
        </div>

        <CardContent className="p-4">
          <h3 className={`font-semibold line-clamp-2 mb-3 transition-colors`}>{persona.name}</h3>
          <div className="flex space-x-2" />
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Persona</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete '{persona.name}'? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (persona.id) {
                  onDelete(persona.id);
                }
                setShowDeleteDialog(false);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default function SettingsPersonas({ config: _config }: SettingsProfileProps) {
  const personaApi = usePersonaApi();

  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createId, setCreateId] = useState("");
  const [idTouched, setIdTouched] = useState(false);

  // Load personas and active persona
  const loadPersonas = async () => {
    try {
      setLoading(true);
      const personasList = await personaApi.listPersonas();
      setPersonas(personasList);
    } catch (error) {
      toast.error(`Failed to load personas. ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPersonas();
  }, []);

  const handleEdit = (persona: Persona) => {
    // TODO: Open edit dialog/modal
    toast.info(`Edit functionality for "${persona.name}" coming soon.`);
  };

  const normalizeAgentId = (value: string) => {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+/, "")
      .replace(/-+$/, "")
      .slice(0, 64);
  };

  const openCreateDialog = () => {
    setCreateOpen(true);
    setCreateName("");
    setCreateId("");
    setIdTouched(false);
  };

  const handleCreatePersona = async () => {
    const name = createName.trim();
    const id = normalizeAgentId(createId || name);
    if (!name || !id) {
      toast.error("名称和 ID 不能为空");
      return;
    }
    try {
      const snapshot = await callGateway<{
        hash?: string;
        exists?: boolean;
        config?: { agents?: { list?: Array<{ id: string }> } };
      }>("config.get");
      if (snapshot.exists && !snapshot.hash) {
        toast.error("配置版本缺失，请重试");
        return;
      }
      const existing = snapshot.config?.agents?.list ?? [];
      const normalizedExisting = new Set(existing.map((entry) => normalizeAgentId(entry.id)));
      if (normalizedExisting.has(id)) {
        toast.error("ID 已存在，请换一个");
        return;
      }
      const nextList = [
        ...existing,
        {
          id,
          identity: { name },
          memorySearch: {},
        },
      ];
      await callGateway("config.patch", {
        raw: JSON.stringify({ agents: { list: nextList } }),
        baseHash: snapshot.hash,
        note: `add agent ${id}`,
      });
      await loadPersonas();
      setCreateOpen(false);
      toast.success(`Persona 已创建：${name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建 Persona 失败");
    }
  };

  const handleDelete = async (id: string) => {
    toast.info("Persona deletion is not wired to Gateway yet.");
    void id;
  };

  if (loading) {
    return (
      <ScrollArea className="flex-1 -mx-1 px-3">
        <div className="min-h-screen p-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="w-full h-48" />
                  <CardContent className="p-4">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="flex-1 -mx-1 px-3">
      <div className="min-h-screen p-2">
        <div className="mx-auto">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Personas</h1>
              <p className="text-gray-600">Manage your AI personas • {personas.length} total</p>
            </div>

            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Create Persona
            </Button>
          </div>

          {personas.length === 0 ? (
            <div className="text-center py-12">
              <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Personas Found</h3>
              <p className="text-gray-600 mb-4">Create your first persona to get started.</p>
              <Button onClick={openCreateDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Create First Persona
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {personas.map((persona) => (
                <PersonaCard
                  key={persona.id}
                  persona={persona}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <Dialog open={createOpen} onOpenChange={(open) => setCreateOpen(open)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>创建 Persona</DialogTitle>
            <DialogDescription>填写名称与 ID（仅支持字母、数字、-、_）。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">名称</label>
              <Input
                value={createName}
                onChange={(event) => {
                  const value = event.target.value;
                  setCreateName(value);
                  if (!idTouched) {
                    setCreateId(normalizeAgentId(value));
                  }
                }}
                placeholder="Persona 名称"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">ID</label>
              <Input
                value={createId}
                onChange={(event) => {
                  setCreateId(event.target.value);
                  setIdTouched(true);
                }}
                placeholder="persona-id"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreatePersona}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}
