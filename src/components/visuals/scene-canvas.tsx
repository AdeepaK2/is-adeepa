"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import type { ReactNode } from "react";

interface SceneCanvasProps {
  children: ReactNode;
  /** Camera position in world units. */
  camera?: [number, number, number];
  fov?: number;
  className?: string;
}

/**
 * Shared react-three-fiber canvas. Every visual in the app mounts through this
 * so renderer settings (DPR clamp, tone mapping, transparent background) stay
 * consistent and are tuned in one place.
 */
export function SceneCanvas({
  children,
  camera = [0, 0, 6],
  fov = 45,
  className,
}: SceneCanvasProps) {
  return (
    <Canvas
      className={className}
      camera={{ position: camera, fov }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <Suspense fallback={null}>{children}</Suspense>
    </Canvas>
  );
}
