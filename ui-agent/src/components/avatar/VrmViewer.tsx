"use client";

import { VRMLoaderPlugin } from "@pixiv/three-vrm";
import type { VRM } from "@pixiv/three-vrm";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

function VRMModel({ url, onVrmLoad }: { url: string | null; onVrmLoad?: (vrm: VRM) => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { scene, camera } = useThree() as any;
  const vrmRef = useRef<VRM | null>(null);

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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useFrame((_, delta) => {
    if (vrmRef.current) {
      vrmRef.current.update(delta);
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
  onVrmLoad?: (vrm: VRM) => void;
}

export function VrmViewer({ modelUrl, onVrmLoad }: VrmViewerProps) {
  return (
    <div className="w-full h-full">
      <Canvas
        shadows
        camera={{ fov: 45, near: 0.1, far: 1000 }}
        gl={{ antialias: true, alpha: true }}
      >
        <CameraController />
        <Lights />
        <VRMModel url={modelUrl} onVrmLoad={onVrmLoad} />
      </Canvas>
    </div>
  );
}

export default VrmViewer;
