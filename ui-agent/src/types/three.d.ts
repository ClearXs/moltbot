// Global type declarations for three.js
declare module "three" {
  export * from "@pixiv/three-vrm";
  // Add basic three.js types
  export const Object3D: any;
  export const Vector3: any;
  export const Quaternion: any;
  export const Matrix4: any;
  export const Scene: any;
  export const PerspectiveCamera: any;
  export const WebGLRenderer: any;
}

declare module "three/examples/jsm/loaders/GLTFLoader.js" {
  export class GLTFLoader {
    load(
      url: string,
      onLoad: (gltf: any) => void,
      onProgress?: (progress: any) => void,
      onError?: (error: any) => void,
    ): void;
    register(callback: (parser: any) => any): void;
  }
}

declare module "three/examples/jsm/controls/OrbitControls.js" {
  export class OrbitControls {
    constructor(camera: any, domElement?: any);
    update(): void;
    dispose(): void;
  }
}
