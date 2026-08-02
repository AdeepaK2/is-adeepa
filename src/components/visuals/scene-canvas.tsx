"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { Component, Suspense } from "react";
import type { ErrorInfo, ReactNode } from "react";

/**
 * Uniform scale that keeps a scene of the given world size inside the canvas.
 *
 * The study visuals are laid out wide -- a 149-frame filmstrip, a two-lane
 * network -- and the stage they mount into is a fixed height, so on a narrow
 * screen the ends would simply fall outside the frustum. Scenes call this and
 * apply it to their root group so they shrink to fit instead of being cropped.
 */
export function useFitScale(worldWidth: number, worldHeight?: number): number {
  const viewport = useThree((state) => state.viewport);
  const byWidth = viewport.width / worldWidth;
  const byHeight = worldHeight ? viewport.height / worldHeight : Infinity;
  return Math.min(1, byWidth, byHeight);
}

interface SceneCanvasProps {
  children: ReactNode;
  /** Camera position in world units. */
  camera?: [number, number, number];
  fov?: number;
  className?: string;
  /** Shown when WebGL is unavailable or the scene throws. */
  fallback?: ReactNode;
}

/**
 * Shared react-three-fiber canvas. Every visual in the app mounts through this
 * so renderer settings (DPR clamp, transparent background) stay consistent and
 * are tuned in one place.
 *
 * Wrapped in an error boundary because WebGL is not guaranteed: it can be
 * disabled, blocked by the GPU blocklist, or unavailable in headless browsers.
 * Without this, a failed context throws during render and takes the page down.
 */
export function SceneCanvas({
  children,
  camera = [0, 0, 6],
  fov = 45,
  className,
  fallback = null,
}: SceneCanvasProps) {
  return (
    <WebGLBoundary fallback={fallback}>
      <Canvas
        className={className}
        camera={{ position: camera, fov }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <Suspense fallback={null}>{children}</Suspense>
      </Canvas>
    </WebGLBoundary>
  );
}

class WebGLBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surfaced in dev only; a missing visual should never be noisy in prod.
    if (process.env.NODE_ENV !== "production") {
      console.warn("Visual failed to render:", error.message, info.componentStack);
    }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
