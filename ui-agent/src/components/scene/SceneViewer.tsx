// GLTF/GLB Viewer for Scene Preview

"use client";

import { useGLTF, OrbitControls, Environment, Html } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import * as THREE from "three";

// Extend JSX namespace for react-three-fiber
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      primitive: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ambientLight: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      directionalLight: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pointLight: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      spotLight: any;
    }
  }
}

// GLTF Model Component
function GltfModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);

  return <primitive object={scene} scale={1} position={[0, 0, 0]} />;
}

// Loading component
function Loader() {
  return (
    <Html center>
      <div className="text-gray-500">加载中...</div>
    </Html>
  );
}

// Scene setup
function SceneSetup() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
      <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} autoRotate={false} />
      <Environment preset="studio" background={false} />
    </>
  );
}

export interface SceneViewerProps {
  modelUrl?: string | null;
  className?: string;
}

export function SceneViewer({ modelUrl, className }: SceneViewerProps) {
  if (!modelUrl) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <div className="text-gray-400 text-center">
          <p>未配置场景模型</p>
          <p className="text-sm">请在场景设置中配置模型路径</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <Canvas camera={{ position: [0, 2, 5], fov: 45 }} style={{ background: "#f3f4f6" }} shadows>
        <Suspense fallback={<Loader />}>
          <GltfModel url={modelUrl} />
        </Suspense>
        <SceneSetup />
      </Canvas>
    </div>
  );
}

export default SceneViewer;
