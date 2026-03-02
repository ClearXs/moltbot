"use client";

import { VRMLoaderPlugin } from "@pixiv/three-vrm";
import type { VRM } from "@pixiv/three-vrm";
import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyVRM = any;

function VRMModel({
  url,
  motionUrl,
  onVrmLoad,
}: {
  url: string | null;
  motionUrl: string | null;
  onVrmLoad?: (vrm: VRM) => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { scene, camera } = useThree() as any;
  const vrmRef = useRef<VRM | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mixerRef = useRef<any>(null);
  const currentMotionUrlRef = useRef<string | null>(null);

  // 加载 VMD 动画 - 暂时禁用，需要额外配置 three-stdlib
  const loadMotion = async (_vrm: AnyVRM, _motionUrl: string) => {
    console.log("[VrmViewer] Motion loading is disabled, motionUrl:", _motionUrl);
    // TODO: 启用 VMD 动画加载
    // 需要安装 three-stdlib 并配置 VMDLoader
    /*
    if (!_motionUrl || currentMotionUrlRef.current === _motionUrl) {
      return;
    }
    currentMotionUrlRef.current = _motionUrl;
    console.log("[VrmViewer] Loading motion from:", _motionUrl);
    try {
      const { VMDLoader } = await import("three-stdlib/loaders/VMDLoader.js");
      const vmdLoader = new VMDLoader();
      const motion = await new Promise<AnyVRM>((resolve, reject) => {
        vmdLoader.load(_motionUrl, resolve, undefined, reject);
      });
      if (!motion || (Array.isArray(motion) && motion.length === 0)) {
        console.warn("[VrmViewer] No motion data loaded");
        return;
      }
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
        mixerRef.current = null;
      }
      _vrm.loadAnimation(motion);
      const animations = _vrm.anim;
      if (animations && animations.length > 0) {
        const THREEAny = THREE as any;
        mixerRef.current = new THREEAny.AnimationMixer(_vrm.scene);
        const action = mixerRef.current.clipAction(animations[0]);
        action.play();
      }
      console.log("[VrmViewer] Motion loaded successfully");
    } catch (error) {
      console.error("[VrmViewer] Failed to load motion:", error);
    }
    */
  };

  useEffect(() => {
    if (!url) {
      console.log("[VrmViewer] No URL provided");
      return;
    }

    console.log("[VrmViewer] Loading VRM from:", url);

    const loader = new GLTFLoader();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    loader.register((parser: any) => new VRMLoaderPlugin(parser));

    loader.load(
      url,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (gltf: any) => {
        const vrm = gltf.userData.vrm as VRM;
        if (!vrm) {
          console.error("No VRM found in loaded GLTF");
          return;
        }

        vrm.scene.traverse((obj: any) => {
          obj.frustumCulled = false;
        });

        scene.add(vrm.scene);
        vrmRef.current = vrm;

        // Set up look-at target
        const lookAtTarget = new THREE.Object3D();
        camera.add(lookAtTarget);
        if (vrm.lookAt) {
          vrm.lookAt.target = lookAtTarget;
        }

        // 加载动作
        if (motionUrl) {
          loadMotion(vrm, motionUrl);
        }

        if (onVrmLoad) {
          onVrmLoad(vrm);
        }
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (progress: any) => {
        // Loading progress
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (error: any) => {
        console.error("[VrmViewer] Error loading VRM:", error);
      },
    );

    return () => {
      if (vrmRef.current) {
        scene.remove(vrmRef.current.scene);
        vrmRef.current = null;
      }
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
        mixerRef.current = null;
      }
      currentMotionUrlRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // 监听 motionUrl 变化
  useEffect(() => {
    if (vrmRef.current && motionUrl) {
      loadMotion(vrmRef.current, motionUrl);
    }
  }, [motionUrl]);

  useFrame((_, delta) => {
    if (vrmRef.current) {
      vrmRef.current.update(delta);
    }
    if (mixerRef.current) {
      mixerRef.current.update(delta);
    }
  });

  return null;
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
    </>
  );
}

function CameraController() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { camera } = useThree() as any;

  useEffect(() => {
    camera.position.set(0, 1.2, 2);
    camera.lookAt(0, 1, 0);
  }, [camera]);

  return null;
}

export interface VrmViewerProps {
  modelUrl: string | null;
  motionUrl?: string | null;
  onVrmLoad?: (vrm: VRM) => void;
}

export function VrmViewer({ modelUrl, motionUrl = null, onVrmLoad }: VrmViewerProps) {
  return (
    <div className="w-full h-full">
      <Canvas
        shadows
        camera={{ fov: 45, near: 0.1, far: 1000 }}
        gl={{ antialias: true, alpha: true }}
      >
        <CameraController />
        <Lights />
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={0.5}
          maxDistance={10}
          target={[0, 1, 0]}
        />
        <VRMModel url={modelUrl} motionUrl={motionUrl} onVrmLoad={onVrmLoad} />
      </Canvas>
    </div>
  );
}

export default VrmViewer;
