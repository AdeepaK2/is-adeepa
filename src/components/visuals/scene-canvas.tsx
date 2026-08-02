"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Component, Suspense, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { useReducedMotion } from "@/lib/use-reduced-motion";

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
  /** Let the viewer drag to turn the camera around the scene. */
  orbit?: boolean;
  /** Turn slowly until the viewer takes over. Requires `orbit`. */
  autoRotate?: boolean;
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
  orbit = false,
  autoRotate = false,
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
        {orbit && <Orbit autoRotate={autoRotate} />}
      </Canvas>
    </WebGLBoundary>
  );
}

/**
 * Drag to turn the camera around the scene.
 *
 * Zoom is off: these scenes sit inline in a page people scroll through, and a
 * wheel handler over a full-width canvas swallows the scroll they meant for the
 * document. Panning is off for the same reason a scene cannot be lost -- there
 * is no way to drag the subject out of frame and be stuck.
 *
 * The idle turn is what tells a reader the scene can be turned at all, so it
 * runs until the first drag and then never resumes.
 */
function Orbit({ autoRotate }: { autoRotate: boolean }) {
  const reduced = useReducedMotion();
  const [idle, setIdle] = useState(true);

  return (
    <OrbitControls
      makeDefault
      enablePan={false}
      enableZoom={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.55}
      autoRotate={autoRotate && idle && !reduced}
      autoRotateSpeed={0.4}
      onStart={() => setIdle(false)}
      // Stop short of the poles, where the scene would roll over and read as
      // upside down with no horizon to explain why.
      minPolarAngle={Math.PI * 0.12}
      maxPolarAngle={Math.PI * 0.88}
    />
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
