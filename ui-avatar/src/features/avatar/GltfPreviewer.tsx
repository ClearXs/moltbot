import { Pause, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

export type GltfPreviewerProps = {
  url: string;
};

const fitCameraToObject = (
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  object: THREE.Object3D,
) => {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = (camera.fov * Math.PI) / 180;
  let cameraZ = Math.abs(maxDim / (2 * Math.tan(fov / 2)));
  cameraZ *= 1.6;

  camera.position.set(center.x, center.y + maxDim * 0.1, cameraZ + center.z);
  camera.near = Math.max(0.1, maxDim / 100);
  camera.far = Math.max(1000, maxDim * 10);
  camera.updateProjectionMatrix();

  controls.target.copy(center);
  controls.update();
};

export default function GltfPreviewer({ url }: GltfPreviewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [clips, setClips] = useState<THREE.AnimationClip[]>([]);
  const [activeClip, setActiveClip] = useState<string>("none");
  const [progress, setProgress] = useState<number>(0);
  const [missingAssets, setMissingAssets] = useState<string[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [loopMode, setLoopMode] = useState<"repeat" | "once">("repeat");
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionRef = useRef<THREE.AnimationAction | null>(null);
  const lastTimeUpdateRef = useRef(0);
  const clipMap = useMemo(() => {
    const map = new Map<string, THREE.AnimationClip>();
    clips.forEach((clip, index) => map.set(String(index), clip));
    return map;
  }, [clips]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor("#0b0f14");
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000,
    );
    camera.position.set(0, 1, 3);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    const manager = new THREE.LoadingManager();
    manager.onProgress = (_url, loaded, total) => {
      if (total > 0) {
        setProgress(Math.min(100, Math.round((loaded / total) * 100)));
      }
    };
    manager.onLoad = () => {
      setProgress(100);
    };
    manager.onError = (url) => {
      setMissingAssets((prev) => {
        if (prev.includes(url)) {
          return prev;
        }
        return [...prev, url];
      });
    };

    const loader = new GLTFLoader(manager);
    loader.load(
      url,
      (gltf) => {
        const model = gltf.scene;
        scene.add(model);
        const nextClips = gltf.animations ?? [];
        setClips(nextClips);
        setIsPaused(false);
        setSpeed(1);
        setLoopMode("repeat");
        setCurrentTime(0);
        if (nextClips.length > 0) {
          setActiveClip("0");
          const mixer = new THREE.AnimationMixer(model);
          mixerRef.current = mixer;
          const action = mixer.clipAction(nextClips[0]);
          setDuration(nextClips[0].duration || 0);
          action.setLoop(
            loopMode === "repeat" ? THREE.LoopRepeat : THREE.LoopOnce,
            loopMode === "repeat" ? Infinity : 1,
          );
          action.clampWhenFinished = loopMode === "once";
          action.play();
          actionRef.current = action;
          mixer.timeScale = speed;
        } else {
          setActiveClip("none");
          setDuration(0);
          mixerRef.current = null;
          actionRef.current = null;
        }
        fitCameraToObject(camera, controls, model);
      },
      undefined,
      (loadError) => {
        console.error("Failed to load glTF", loadError);
        setError("模型加载失败");
      },
    );

    let frameId = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      frameId = window.requestAnimationFrame(animate);
      const mixer = mixerRef.current;
      if (mixer) {
        mixer.update(clock.getDelta());
        const action = actionRef.current;
        if (action) {
          const now = performance.now();
          if (now - lastTimeUpdateRef.current > 120) {
            setCurrentTime(action.time);
            lastTimeUpdateRef.current = now;
          }
        }
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const resize = () => {
      const { clientWidth, clientHeight } = container;
      if (!clientWidth || !clientHeight) {
        return;
      }
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      mixerRef.current = null;
      actionRef.current = null;
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [url]);

  useEffect(() => {
    const mixer = mixerRef.current;
    if (!mixer) {
      return;
    }
    if (activeClip === "none") {
      mixer.stopAllAction();
      actionRef.current = null;
      return;
    }
    const clip = clipMap.get(activeClip);
    if (!clip) {
      return;
    }
    actionRef.current?.stop();
    const action = mixer.clipAction(clip);
    action.reset();
    setDuration(clip.duration || 0);
    action.setLoop(
      loopMode === "repeat" ? THREE.LoopRepeat : THREE.LoopOnce,
      loopMode === "repeat" ? Infinity : 1,
    );
    action.clampWhenFinished = loopMode === "once";
    action.play();
    actionRef.current = action;
  }, [activeClip, clipMap, loopMode]);

  useEffect(() => {
    const mixer = mixerRef.current;
    if (!mixer) {
      return;
    }
    mixer.timeScale = isPaused ? 0 : speed;
  }, [isPaused, speed]);

  useEffect(() => {
    const action = actionRef.current;
    if (!action) {
      return;
    }
    action.setLoop(
      loopMode === "repeat" ? THREE.LoopRepeat : THREE.LoopOnce,
      loopMode === "repeat" ? Infinity : 1,
    );
    action.clampWhenFinished = loopMode === "once";
  }, [loopMode]);

  const formatTime = (value: number) => {
    if (!Number.isFinite(value)) {
      return "0:00";
    }
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60)
      .toString()
      .padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

  if (error) {
    return (
      <div className="h-full w-full flex items-center justify-center text-sm text-gray-500">
        {error}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {progress > 0 && progress < 100 && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-sm">
          加载中 {progress}%
        </div>
      )}
      {missingAssets.length > 0 && (
        <div className="absolute bottom-4 left-4 right-4 rounded-md bg-amber-100/90 p-3 text-xs text-amber-800">
          部分资源加载失败：{missingAssets.slice(0, 3).join("、")}
          {missingAssets.length > 3 ? " 等" : ""}
        </div>
      )}
      {clips.length > 0 && (
        <div className="absolute top-4 right-4 w-64 space-y-3 rounded-lg bg-black/70 p-3 text-white">
          <Select value={activeClip} onValueChange={setActiveClip}>
            <SelectTrigger className="bg-white/10 text-white border-white/20">
              <SelectValue placeholder="选择动画" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">无动画</SelectItem>
              {clips.map((clip, index) => {
                const name = clip.name || `动画 ${index + 1}`;
                return (
                  <SelectItem key={`${name}-${index}`} value={String(index)}>
                    {name}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Select
            value={loopMode}
            onValueChange={(value) => setLoopMode(value as "repeat" | "once")}
          >
            <SelectTrigger className="bg-white/10 text-white border-white/20">
              <SelectValue placeholder="循环模式" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="repeat">循环播放</SelectItem>
              <SelectItem value="once">单次播放</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 border-white/40 bg-white/10 text-white hover:bg-white/20"
              onClick={() => setIsPaused((prev) => !prev)}
            >
              {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </Button>
            <div className="flex-1">
              <div className="text-xs text-white/70 mb-1">速度 {speed.toFixed(1)}x</div>
              <Slider
                value={[speed]}
                onValueChange={(value) => setSpeed(value[0] ?? 1)}
                min={0.5}
                max={2}
                step={0.1}
              />
            </div>
          </div>
          <div className="text-xs text-white/70 flex items-center justify-between">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <Slider
            value={[Math.min(currentTime, duration)]}
            onValueChange={(value) => {
              const action = actionRef.current;
              const mixer = mixerRef.current;
              if (!action) {
                return;
              }
              const nextTime = value[0] ?? 0;
              action.time = nextTime;
              mixer?.update(0);
              setCurrentTime(nextTime);
            }}
            min={0}
            max={Math.max(duration, 0.01)}
            step={0.05}
          />
        </div>
      )}
    </div>
  );
}
