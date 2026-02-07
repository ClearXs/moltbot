"use client";

import { Edit, Trash2, Plus, FileText, Eye, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { buildFileUrl } from "@/services/gateway";
import { getDefaultAgentId } from "@/services/personas";
import useSceneApi, { Scene, buildSceneThumbUrl } from "@/services/scene";

export type SettingsSceneProps = {};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const NoImageSkeleton = () => (
  <div className="w-full h-48 bg-gray-100 rounded-t-lg flex flex-col items-center justify-center space-y-2">
    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center animate-pulse">
      <FileText className="w-8 h-8 text-gray-400" />
    </div>
    <span className="text-gray-400 text-sm font-medium">No Preview</span>
  </div>
);

const SceneCard = ({
  scene,
  onEdit,
  onDelete,
  onView,
  onSetActive,
  agentId,
}: {
  scene: Scene;
  onEdit: (scene: Scene) => void;
  onDelete: (id: string) => void;
  onView: (scene: Scene) => void;
  onSetActive: (scene: Scene) => void;
  agentId: string | null;
}) => {
  const router = useRouter();
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  // Get file extension for badge
  const getFileExtension = (filename: string) => {
    const extension = filename.split(".").pop()?.toUpperCase();
    return extension || "FILE";
  };

  return (
    <>
      <Card
        className={`group overflow-hidden transition-all duration-300 hover:scale-105 py-0 gap-2 cursor-pointer`}
        onClick={(e) => {
          // Prevent card click when clicking action buttons
          if (!(e.target as HTMLElement).closest("button")) {
            onView(scene);
          }
        }}
      >
        <div className="relative">
          {!scene.thumb || imageError ? (
            <NoImageSkeleton />
          ) : (
            <div className="relative w-full h-48 overflow-hidden">
              {imageLoading && <Skeleton className="absolute inset-0 w-full h-full" />}
              {agentId && (
                <img
                  src={buildSceneThumbUrl(agentId, scene) ?? ""}
                  alt={scene.name}
                  className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
                    imageLoading ? "opacity-0" : "opacity-100"
                  }`}
                  onLoad={() => setImageLoading(false)}
                  onError={() => {
                    setImageError(true);
                    setImageLoading(false);
                  }}
                />
              )}
            </div>
          )}

          {/* File Type Badge */}
          <Badge className={`absolute top-3 left-3 border-none bg-blue-500 text-white`}>
            {getFileExtension(scene.main_file)}
          </Badge>

          {/* Action Buttons */}
          <div className="absolute top-3 right-3 flex space-x-1">
            <Button
              size="sm"
              variant="secondary"
              className="p-2 bg-white/80 backdrop-blur-sm hover:bg-white"
              onClick={(e) => {
                e.stopPropagation();
                onSetActive(scene);
              }}
              disabled={scene.active}
            >
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="p-2 bg-white/80 backdrop-blur-sm hover:bg-white"
              onClick={(e) => {
                e.stopPropagation();
                onView(scene);
              }}
            >
              <Eye className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="p-2 bg-white/80 backdrop-blur-sm hover:bg-white"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(scene);
              }}
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="p-2 bg-white/80 backdrop-blur-sm hover:bg-white"
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteDialog(true);
              }}
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </div>
        </div>

        <CardContent className="p-4">
          <h3 className={`font-semibold line-clamp-2 mb-2 transition-colors`}>{scene.name}</h3>

          {scene.active && (
            <Badge className="mb-2 border-none bg-emerald-500 text-white">当前场景</Badge>
          )}

          {scene.description && (
            <p className="text-sm text-gray-600 line-clamp-2 mb-3">{scene.description}</p>
          )}

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span className="truncate">{scene.main_file}</span>
            {scene.updated_at && <span>{new Date(scene.updated_at).toLocaleDateString()}</span>}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Scene</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete '{scene.name}'? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (scene.id) {
                  onDelete(scene.id);
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

export default function SettingsScenes({ config: _config }: SettingsSceneProps) {
  const sceneApi = useSceneApi();

  const router = useRouter();

  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentId, setAgentId] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [editScene, setEditScene] = useState<Scene | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createMainFile, setCreateMainFile] = useState("");
  const [createRPath, setCreateRPath] = useState("");
  const [createThumb, setCreateThumb] = useState<string | undefined>(undefined);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editMainFile, setEditMainFile] = useState("");
  const [editThumb, setEditThumb] = useState<string | undefined>(undefined);
  const editMainUploadRef = useRef<HTMLInputElement>(null);
  const editThumbUploadRef = useRef<HTMLInputElement>(null);
  const createMainUploadRef = useRef<HTMLInputElement>(null);
  const createThumbUploadRef = useRef<HTMLInputElement>(null);
  const [uploadedMainFiles, setUploadedMainFiles] = useState<
    Array<{ filename: string; path: string }>
  >([]);
  const [uploadedThumbs, setUploadedThumbs] = useState<Array<{ filename: string; path: string }>>(
    [],
  );

  // Load scenes
  const loadScenes = async () => {
    try {
      setLoading(true);
      const resolvedAgentId = await getDefaultAgentId();
      const scenesList = await sceneApi.listScenes(resolvedAgentId);
      setScenes(scenesList);
      setAgentId(resolvedAgentId);
    } catch (error) {
      toast.error(`Failed to load scenes. ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadScenes();
  }, []);

  const handleView = (scene: Scene) => {
    router.push(`/scenes/${scene.id}`);
  };

  const handleEdit = (scene: Scene) => {
    setEditScene(scene);
    setEditName(scene.name);
    setEditDescription(scene.description || "");
    setEditMainFile(scene.main_file);
    setEditThumb(scene.thumb ?? undefined);
  };

  const handleDelete = async (id: string) => {
    try {
      await sceneApi.deleteScene(id);
      setScenes(scenes.filter((s) => s.id !== id));
      toast.success("Scene deleted successfully.");
    } catch (error) {
      toast.error(`Failed to delete scene. ${getErrorMessage(error)}`);
    }
  };

  const handleCreateScene = () => {
    setCreateOpen(true);
    setCreateName("");
    setCreateDescription("");
    setCreateMainFile("");
    setCreateRPath("");
    setCreateThumb(undefined);
  };

  const handleSetActive = async (scene: Scene) => {
    try {
      await sceneApi.setActiveScene(scene.id);
      await loadScenes();
      toast.success(`已切换为当前场景：${scene.name}`);
    } catch (error) {
      toast.error(`切换场景失败：${getErrorMessage(error)}`);
    }
  };

  const addUploadedMainFiles = (files: Array<{ filename: string; path: string }>) => {
    setUploadedMainFiles((prev) => {
      const next = new Map(prev.map((item) => [item.filename, item]));
      files.forEach((file) => {
        const ext = file.filename.toLowerCase().split(".").pop() || "";
        if (["json", "glb", "gltf"].includes(ext)) {
          next.set(file.filename, file);
        }
      });
      return Array.from(next.values());
    });
  };

  const addUploadedThumbs = (files: Array<{ filename: string; path: string }>) => {
    setUploadedThumbs((prev) => {
      const next = new Map(prev.map((item) => [item.path, item]));
      files.forEach((file) => {
        if (!file.path.includes("custom/scenes/thumbs/")) {
          return;
        }
        next.set(file.path, file);
      });
      return Array.from(next.values());
    });
  };

  const handleUpdateScene = async () => {
    if (!editScene) {
      return;
    }
    const trimmedName = editName.trim();
    const trimmedMainFile = editMainFile.trim();
    if (!trimmedName || !trimmedMainFile) {
      toast.error("名称和主文件不能为空");
      return;
    }
    try {
      await sceneApi.updateScene(editScene.id, {
        name: trimmedName,
        description: editDescription.trim() || undefined,
        main_file: trimmedMainFile,
        thumb: editThumb,
      });
      await loadScenes();
      toast.success(`场景已更新：${trimmedName}`);
      setEditScene(null);
    } catch (error) {
      toast.error(`更新失败：${getErrorMessage(error)}`);
    }
  };

  const handleEditMainUploadClick = () => {
    editMainUploadRef.current?.click();
  };

  const handleEditThumbUploadClick = () => {
    editThumbUploadRef.current?.click();
  };

  const handleCreateMainUploadClick = () => {
    createMainUploadRef.current?.click();
  };

  const handleCreateThumbUploadClick = () => {
    createThumbUploadRef.current?.click();
  };

  const handleEditMainUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0) {
      return;
    }
    try {
      const result = await sceneApi.uploadSceneFiles([files[0]]);
      const uploaded = result.files?.[0];
      if (uploaded?.filename && uploaded?.path) {
        setEditMainFile(uploaded.filename);
        addUploadedMainFiles([uploaded]);
        toast.success("主文件已上传");
      }
    } catch (error) {
      toast.error(`主文件上传失败：${getErrorMessage(error)}`);
    } finally {
      event.target.value = "";
    }
  };

  const handleEditThumbUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0) {
      return;
    }
    try {
      const result = await sceneApi.uploadSceneFiles([files[0]]);
      const uploaded = result.files?.[0];
      if (uploaded?.path) {
        setEditThumb(uploaded.path);
        if (uploaded.filename) {
          addUploadedThumbs([uploaded as { filename: string; path: string }]);
        }
        toast.success("缩略图已上传");
      }
    } catch (error) {
      toast.error(`缩略图上传失败：${getErrorMessage(error)}`);
    } finally {
      event.target.value = "";
    }
  };

  const handleCreateMainUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0) {
      return;
    }
    try {
      const result = await sceneApi.uploadSceneFiles([files[0]]);
      const uploaded = result.files?.[0];
      if (uploaded?.filename && uploaded?.path) {
        setCreateMainFile(uploaded.filename);
        const nextRPath = uploaded.path.includes("/")
          ? uploaded.path.slice(0, uploaded.path.lastIndexOf("/"))
          : "";
        setCreateRPath(nextRPath);
        addUploadedMainFiles([uploaded]);
        addUploadedThumbs([uploaded]);
        toast.success("主文件已上传");
      }
    } catch (error) {
      toast.error(`主文件上传失败：${getErrorMessage(error)}`);
    } finally {
      event.target.value = "";
    }
  };

  const handleCreateThumbUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0) {
      return;
    }
    try {
      const result = await sceneApi.uploadSceneFiles([files[0]]);
      const uploaded = result.files?.[0];
      if (uploaded?.path) {
        setCreateThumb(uploaded.path);
        if (uploaded.filename) {
          addUploadedThumbs([uploaded as { filename: string; path: string }]);
        }
        toast.success("缩略图已上传");
      }
    } catch (error) {
      toast.error(`缩略图上传失败：${getErrorMessage(error)}`);
    } finally {
      event.target.value = "";
    }
  };

  const handleCreateSubmit = async () => {
    const trimmedName = createName.trim();
    const trimmedMainFile = createMainFile.trim();
    const trimmedRPath = createRPath.trim();
    if (!trimmedName || !trimmedMainFile || !trimmedRPath) {
      toast.error("名称、主文件、路径不能为空");
      return;
    }
    try {
      await sceneApi.createScene({
        name: trimmedName,
        description: createDescription.trim() || undefined,
        main_file: trimmedMainFile,
        r_path: trimmedRPath,
        thumb: createThumb,
      });
      await loadScenes();
      setCreateOpen(false);
      toast.success(`场景已创建：${trimmedName}`);
    } catch (error) {
      toast.error(`创建失败：${getErrorMessage(error)}`);
    }
  };

  const handleUploadClick = () => {
    uploadInputRef.current?.click();
  };

  const handleUploadChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0) {
      return;
    }
    try {
      const result = await sceneApi.uploadSceneFiles(files);
      const uploadedFiles = result.files ?? [];
      addUploadedMainFiles(uploadedFiles);
      addUploadedThumbs(
        uploadedFiles.filter((file) => file.path.includes("custom/scenes/thumbs/")),
      );
      const mainFileExtensions = new Set([".json", ".glb", ".gltf"]);
      const getExtension = (filename: string) => {
        const index = filename.lastIndexOf(".");
        return index === -1 ? "" : filename.slice(index).toLowerCase();
      };
      const mainFile = uploadedFiles.find((file) =>
        mainFileExtensions.has(getExtension(file.filename)),
      );
      const thumbFile = uploadedFiles.find((file) => file.path.includes("custom/scenes/thumbs/"));

      if (!mainFile) {
        toast.success(`已上传 ${uploadedFiles.length} 个文件`);
        return;
      }

      const rPath = mainFile.path.includes("/")
        ? mainFile.path.slice(0, mainFile.path.lastIndexOf("/"))
        : "";
      const name = mainFile.filename.replace(/\.[^/.]+$/, "");
      await sceneApi.createScene({
        name,
        r_path: rPath,
        main_file: mainFile.filename,
        thumb: thumbFile?.path,
      });
      await loadScenes();
      toast.success(`已上传 ${uploadedFiles.length} 个文件并创建场景`);
    } catch (error) {
      toast.error(`上传失败：${getErrorMessage(error)}`);
    } finally {
      event.target.value = "";
    }
  };

  const mainFileOptions = Array.from(
    new Set(
      [editMainFile, createMainFile, ...uploadedMainFiles.map((file) => file.filename)].filter(
        Boolean,
      ),
    ),
  );
  const thumbOptions = Array.from(
    new Set([editThumb, createThumb, ...uploadedThumbs.map((file) => file.path)].filter(Boolean)),
  );

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
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Scenes</h1>
              <p className="text-gray-600">Manage your 3D scenes • {scenes.length} total</p>
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={uploadInputRef}
                type="file"
                className="hidden"
                multiple
                accept=".json,.glb,.gltf,.png,.jpg,.jpeg,.webp"
                onChange={handleUploadChange}
              />
              <Button variant="outline" onClick={handleUploadClick}>
                Upload Files
              </Button>
              <Button onClick={handleCreateScene}>
                <Plus className="w-4 h-4 mr-2" />
                Create Scene
              </Button>
            </div>
          </div>

          {scenes.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Scenes Found</h3>
              <p className="text-gray-600 mb-4">Create your first scene to get started.</p>
              <Button onClick={handleCreateScene}>
                <Plus className="w-4 h-4 mr-2" />
                Create First Scene
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {scenes.map((scene) => (
                <SceneCard
                  key={scene.id}
                  scene={scene}
                  onView={handleView}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  agentId={agentId}
                  onSetActive={handleSetActive}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <Dialog open={Boolean(editScene)} onOpenChange={(open) => !open && setEditScene(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>编辑场景</DialogTitle>
            <DialogDescription>更新场景名称、描述和主文件。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <input
              ref={editMainUploadRef}
              type="file"
              className="hidden"
              accept=".json,.glb,.gltf"
              onChange={handleEditMainUpload}
            />
            <input
              ref={editThumbUploadRef}
              type="file"
              className="hidden"
              accept=".png,.jpg,.jpeg,.webp"
              onChange={handleEditThumbUpload}
            />
            <div className="space-y-2">
              <label className="text-sm font-medium">名称</label>
              <Input
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                placeholder="场景名称"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">描述</label>
              <Textarea
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                placeholder="场景描述"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">主文件</label>
              {mainFileOptions.length > 0 && (
                <Select
                  value={editMainFile || "none"}
                  onValueChange={(value) => setEditMainFile(value === "none" ? "" : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="从已上传文件选择" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">请选择</SelectItem>
                    {mainFileOptions.map((file) => (
                      <SelectItem key={file} value={file}>
                        {file}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="flex gap-2">
                <Input
                  value={editMainFile}
                  onChange={(event) => setEditMainFile(event.target.value)}
                  placeholder="main.glb"
                />
                <Button variant="outline" type="button" onClick={handleEditMainUploadClick}>
                  上传主文件
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">缩略图</label>
              {thumbOptions.length > 0 && (
                <Select
                  value={editThumb || "none"}
                  onValueChange={(value) => setEditThumb(value === "none" ? undefined : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="从已上传缩略图选择" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">请选择</SelectItem>
                    {thumbOptions.map((path) => (
                      <SelectItem key={path} value={path}>
                        <div className="flex items-center gap-2">
                          {agentId ? (
                            <img
                              src={buildFileUrl(agentId, path)}
                              alt="thumb"
                              className="h-6 w-6 rounded object-cover border"
                            />
                          ) : null}
                          <span>{path.split("/").pop() ?? path}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="flex items-center gap-2">
                <Button variant="outline" type="button" onClick={handleEditThumbUploadClick}>
                  上传缩略图
                </Button>
                <Button variant="ghost" type="button" onClick={() => setEditThumb(undefined)}>
                  清空缩略图
                </Button>
                {agentId && editThumb ? (
                  <img
                    src={buildFileUrl(agentId, editThumb)}
                    alt="缩略图预览"
                    className="h-12 w-12 rounded object-cover border"
                  />
                ) : (
                  <span className="text-xs text-gray-400">暂无缩略图</span>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditScene(null)}>
              取消
            </Button>
            <Button onClick={handleUpdateScene}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={createOpen} onOpenChange={(open) => !open && setCreateOpen(open)}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>创建场景</DialogTitle>
            <DialogDescription>填写场景信息并上传主文件与缩略图。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <input
              ref={createMainUploadRef}
              type="file"
              className="hidden"
              accept=".json,.glb,.gltf"
              onChange={handleCreateMainUpload}
            />
            <input
              ref={createThumbUploadRef}
              type="file"
              className="hidden"
              accept=".png,.jpg,.jpeg,.webp"
              onChange={handleCreateThumbUpload}
            />
            <div className="space-y-2">
              <label className="text-sm font-medium">名称</label>
              <Input
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                placeholder="场景名称"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">描述</label>
              <Textarea
                value={createDescription}
                onChange={(event) => setCreateDescription(event.target.value)}
                placeholder="场景描述"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">主文件</label>
              {mainFileOptions.length > 0 && (
                <Select
                  value={createMainFile || "none"}
                  onValueChange={(value) => {
                    const nextValue = value === "none" ? "" : value;
                    setCreateMainFile(nextValue);
                    const match = uploadedMainFiles.find((file) => file.filename === nextValue);
                    if (match?.path) {
                      const nextRPath = match.path.includes("/")
                        ? match.path.slice(0, match.path.lastIndexOf("/"))
                        : "";
                      if (nextRPath) {
                        setCreateRPath(nextRPath);
                      }
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="从已上传文件选择" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">请选择</SelectItem>
                    {mainFileOptions.map((file) => (
                      <SelectItem key={file} value={file}>
                        {file}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="flex gap-2">
                <Input
                  value={createMainFile}
                  onChange={(event) => setCreateMainFile(event.target.value)}
                  placeholder="main.glb"
                />
                <Button variant="outline" type="button" onClick={handleCreateMainUploadClick}>
                  上传主文件
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">路径 (r_path)</label>
              <Input
                value={createRPath}
                onChange={(event) => setCreateRPath(event.target.value)}
                placeholder="custom/scenes"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">缩略图</label>
              {thumbOptions.length > 0 && (
                <Select
                  value={createThumb || "none"}
                  onValueChange={(value) => setCreateThumb(value === "none" ? undefined : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="从已上传缩略图选择" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">请选择</SelectItem>
                    {thumbOptions.map((path) => (
                      <SelectItem key={path} value={path}>
                        <div className="flex items-center gap-2">
                          {agentId ? (
                            <img
                              src={buildFileUrl(agentId, path)}
                              alt="thumb"
                              className="h-6 w-6 rounded object-cover border"
                            />
                          ) : null}
                          <span>{path.split("/").pop() ?? path}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="flex items-center gap-2">
                <Button variant="outline" type="button" onClick={handleCreateThumbUploadClick}>
                  上传缩略图
                </Button>
                <Button variant="ghost" type="button" onClick={() => setCreateThumb(undefined)}>
                  清空缩略图
                </Button>
                {agentId && createThumb ? (
                  <img
                    src={buildFileUrl(agentId, createThumb)}
                    alt="缩略图预览"
                    className="h-12 w-12 rounded object-cover border"
                  />
                ) : (
                  <span className="text-xs text-gray-400">暂无缩略图</span>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreateSubmit}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}
