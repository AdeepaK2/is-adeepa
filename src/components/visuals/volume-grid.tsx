"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { hueColor } from "@/lib/utils";
import { ControlRow, SegmentedControl, WebGLFallback } from "./controls";
import { HoverFrame, useSceneHover, type SceneHover } from "./hover";
import { SceneCanvas } from "./scene-canvas";

/** Whether the kernel has any extent along the time axis. */
type Reach = "2d" | "3d";

export interface VolumeGridProps {
  /** Voxels across the frame (x), down the frame (y), and through time (z). */
  size?: [number, number, number];
  /** Accent hue, normally the paper's `hue`. */
  hue?: number;
  /** Speed of the animation. */
  speed?: number;
  /**
   * `wave` sweeps activation along the time axis -- an ambient view of a
   * spatio-temporal volume. `kernel` slides a convolution kernel through it.
   */
  mode?: "wave" | "kernel";
  /** Kernel extent in voxels, `kernel` mode only. The paper's stages use 3x3x3. */
  kernel?: [number, number, number];
  /** Show the 2D/3D kernel toggle beneath the scene. */
  interactive?: boolean;
}

/**
 * A spatio-temporal volume as a lattice of voxels. Generic on purpose: most
 * papers in this library describe some operation over exactly this structure,
 * so per-paper modules can reuse it with different sizes and accents.
 *
 * In `kernel` mode it answers the question 3D convolution exists to answer --
 * a 2D kernel only ever sees one frame at a time, so movement between frames is
 * invisible to it, while a 3D kernel covers several frames at once.
 */
export function VolumeGrid({
  size = [8, 5, 8],
  hue = 170,
  speed = 0.6,
  mode = "wave",
  kernel = [3, 3, 3],
  interactive = false,
}: VolumeGridProps) {
  const [reach, setReach] = useState<Reach>("3d");
  const accent = hueColor(hue);
  const { frame, hover, hovered } = useSceneHover();

  const scene = (
    <SceneCanvas
      camera={[5.2, 3.4, 6.2]}
      fov={40}
      fallback={<WebGLFallback />}
      orbit
      autoRotate
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 5]} intensity={1.1} />
      {mode === "kernel" ? (
        <KernelSweep
          size={size}
          hue={hue}
          speed={speed}
          kernel={kernel}
          reach={reach}
          hover={hover}
        />
      ) : (
        <Lattice size={size} hue={hue} speed={speed} hover={hover} />
      )}
    </SceneCanvas>
  );

  // Still a flex column with no controls, so `HoverFrame` sizes the same way in
  // both branches rather than collapsing to its content.
  if (!interactive || mode !== "kernel") {
    return (
      <div className="flex h-full flex-col">
        <HoverFrame frame={frame} hovered={hovered}>
          {scene}
        </HoverFrame>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <HoverFrame frame={frame} hovered={hovered}>
        {scene}
      </HoverFrame>
      <ControlRow>
        <SegmentedControl<Reach>
          label="Kernel"
          value={reach}
          onChange={setReach}
          accent={accent}
          options={[
            {
              value: "2d",
              label: `${kernel[0]}x${kernel[1]} (2D)`,
              title: "One frame at a time -- motion between frames is invisible",
            },
            {
              value: "3d",
              label: `${kernel[0]}x${kernel[1]}x${kernel[2]} (3D)`,
              title: "Covers several frames at once, so it can see movement",
            },
          ]}
        />
        <p className="text-ink-faint ml-auto max-w-xs text-right text-xs leading-relaxed">
          {reach === "3d"
            ? "The kernel spans three frames, so a single output value already encodes change over time."
            : "The kernel sits inside one frame. Stack a thousand of these and the model still never compares two frames."}
        </p>
      </ControlRow>
    </div>
  );
}

/** Shared voxel placement: a centred lattice with one matrix per voxel. */
function useLattice(size: [number, number, number]) {
  const [nx, ny, nz] = size;
  return useMemo(() => {
    const matrices: THREE.Matrix4[] = [];
    const coords: [number, number, number][] = [];
    const dummy = new THREE.Object3D();
    const step = 0.62;

    for (let z = 0; z < nz; z++) {
      for (let y = 0; y < ny; y++) {
        for (let x = 0; x < nx; x++) {
          dummy.position.set(
            (x - (nx - 1) / 2) * step,
            (y - (ny - 1) / 2) * step,
            (z - (nz - 1) / 2) * step,
          );
          dummy.updateMatrix();
          matrices.push(dummy.matrix.clone());
          coords.push([x, y, z]);
        }
      }
    }
    return { matrices, coords, step };
  }, [nx, ny, nz]);
}

/** The ambient view: a band of activation travelling along the time axis. */
function Lattice({
  size,
  hue,
  speed,
  hover,
}: Required<Pick<VolumeGridProps, "size" | "hue" | "speed">> & {
  hover: SceneHover;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const reduced = useReducedMotion();
  const { matrices, coords } = useLattice(size);
  const count = matrices.length;
  const nz = size[2];

  const baseColor = useMemo(() => new THREE.Color(`hsl(${hue}, 38%, 76%)`), [hue]);
  const litColor = useMemo(() => new THREE.Color(`hsl(${hue}, 78%, 45%)`), [hue]);

  useFrame(({ clock }) => {
    const instanced = mesh.current;
    if (!instanced) return;
    const t = reduced ? 0.5 : clock.getElapsedTime() * speed;
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      instanced.setMatrixAt(i, matrices[i]);
      const depth = coords[i][2] / Math.max(nz - 1, 1);
      const phase = (depth - ((t % 1.6) / 1.6)) % 1;
      const wrapped = phase < 0 ? phase + 1 : phase;
      const intensity = Math.max(0, 1 - wrapped * 4);
      color.copy(baseColor).lerp(litColor, intensity);
      instanced.setColorAt(i, color);
    }

    instanced.instanceMatrix.needsUpdate = true;
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
    instanced.rotation.y = reduced ? 0.4 : clock.getElapsedTime() * 0.12;
  });

  return (
    <Voxels
      meshRef={mesh}
      count={count}
      hover={hover}
      label={(index) => {
        const [x, y, z] = coords[index];
        return `frame ${z + 1} of ${nz} · pixel ${x + 1},${y + 1}`;
      }}
    />
  );
}

/**
 * A convolution kernel raster-scanning the volume: along the width, then down
 * the height, then through time. Voxels currently under the kernel light up, so
 * how much of the time axis it touches is visible at a glance.
 */
function KernelSweep({
  size,
  hue,
  speed,
  kernel,
  reach,
  hover,
}: Required<Pick<VolumeGridProps, "size" | "hue" | "speed" | "kernel">> & {
  reach: Reach;
  hover: SceneHover;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const box = useRef<THREE.LineSegments>(null);
  // Where the kernel is right now, so a hovered voxel can say whether it is
  // currently under it. A ref rather than state: this changes every frame.
  const centre = useRef({ cx: 0, cy: 0, cz: 0 });
  const reduced = useReducedMotion();

  const [nx, ny, nz] = size;
  const { matrices, coords, step } = useLattice(size);
  const count = matrices.length;

  const [kx, ky, kz] = kernel;
  const depth = reach === "3d" ? kz : 1;

  // On a light stage the recessed state is the pale one: voxels the kernel is
  // not touching have to fall back toward the panel, not stand out against it.
  const dimColor = useMemo(() => new THREE.Color(`hsl(${hue}, 20%, 84%)`), [hue]);
  const sliceColor = useMemo(() => new THREE.Color(`hsl(${hue}, 42%, 66%)`), [hue]);
  const litColor = useMemo(() => new THREE.Color(`hsl(${hue}, 85%, 42%)`), [hue]);

  const edges = useMemo(
    () =>
      new THREE.EdgesGeometry(
        new THREE.BoxGeometry(kx * step, ky * step, depth * step),
      ),
    [kx, ky, depth, step],
  );

  const offset = (index: number, extent: number) => (index - (extent - 1) / 2) * step;

  useFrame(({ clock }) => {
    const instanced = mesh.current;
    if (!instanced) return;

    // Raster scan: continuous along x, stepping y then z as it wraps.
    const t = reduced ? nx * 2.5 : clock.getElapsedTime() * speed * 2;
    const cx = t % nx;
    const cy = Math.floor(t / nx) % ny;
    const cz = Math.floor(t / (nx * ny)) % nz;
    centre.current = { cx, cy, cz };

    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      instanced.setMatrixAt(i, matrices[i]);
      const [x, y, z] = coords[i];
      const inside =
        Math.abs(x - cx) < kx / 2 &&
        Math.abs(y - cy) < ky / 2 &&
        Math.abs(z - cz) < depth / 2;

      if (inside) color.copy(litColor);
      else if (z === cz) color.copy(sliceColor);
      else color.copy(dimColor);
      instanced.setColorAt(i, color);
    }
    instanced.instanceMatrix.needsUpdate = true;
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;

    box.current?.position.set(offset(cx, nx), offset(cy, ny), offset(cz, nz));
  });

  // The scene used to sway on its own for depth. The camera is the viewer's now
  // -- a subject that also moves makes a drag impossible to aim.
  return (
    <group rotation={[0, 0.35, 0]}>
      <Voxels
        meshRef={mesh}
        count={count}
        hover={hover}
        label={(index) => {
          const [x, y, z] = coords[index];
          const { cx, cy, cz } = centre.current;
          const inside =
            Math.abs(x - cx) < kx / 2 &&
            Math.abs(y - cy) < ky / 2 &&
            Math.abs(z - cz) < depth / 2;
          const state = inside
            ? "under the kernel"
            : z === Math.round(cz)
              ? "current frame, outside the kernel"
              : "not being read";
          return `frame ${z + 1} of ${nz} · pixel ${x + 1},${y + 1} · ${state}`;
        }}
      />
      <lineSegments ref={box} geometry={edges}>
        <lineBasicMaterial color={litColor} transparent opacity={0.9} />
      </lineSegments>
    </group>
  );
}

function Voxels({
  meshRef,
  count,
  hover,
  label,
}: {
  meshRef: React.RefObject<THREE.InstancedMesh | null>;
  count: number;
  hover: SceneHover;
  /** Built per hover rather than up front -- it reads the live kernel position. */
  label: (index: number) => string;
}) {
  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      onPointerMove={(event) => {
        event.stopPropagation();
        if (event.instanceId === undefined) return;
        hover.show(label(event.instanceId), event);
      }}
      onPointerOut={hover.hide}
    >
      <boxGeometry args={[0.3, 0.3, 0.3]} />
      <meshStandardMaterial roughness={0.45} metalness={0.1} transparent opacity={0.9} />
    </instancedMesh>
  );
}
