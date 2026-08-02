"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { ControlRow, SegmentedControl, WebGLFallback } from "./controls";
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
  const accent = `hsl(${hue} 78% 62%)`;

  const scene = (
    <SceneCanvas camera={[5.2, 3.4, 6.2]} fov={40} fallback={<WebGLFallback />}>
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 5]} intensity={1.1} />
      {mode === "kernel" ? (
        <KernelSweep size={size} hue={hue} speed={speed} kernel={kernel} reach={reach} />
      ) : (
        <Lattice size={size} hue={hue} speed={speed} />
      )}
    </SceneCanvas>
  );

  if (!interactive || mode !== "kernel") return scene;

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">{scene}</div>
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
}: Required<Pick<VolumeGridProps, "size" | "hue" | "speed">>) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const reduced = useReducedMotion();
  const { matrices, coords } = useLattice(size);
  const count = matrices.length;
  const nz = size[2];

  const baseColor = useMemo(() => new THREE.Color(`hsl(${hue}, 70%, 55%)`), [hue]);
  const litColor = useMemo(() => new THREE.Color(`hsl(${hue}, 95%, 72%)`), [hue]);

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

  return <Voxels meshRef={mesh} count={count} />;
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
}: Required<Pick<VolumeGridProps, "size" | "hue" | "speed" | "kernel">> & {
  reach: Reach;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const box = useRef<THREE.LineSegments>(null);
  const group = useRef<THREE.Group>(null);
  const reduced = useReducedMotion();

  const [nx, ny, nz] = size;
  const { matrices, coords, step } = useLattice(size);
  const count = matrices.length;

  const [kx, ky, kz] = kernel;
  const depth = reach === "3d" ? kz : 1;

  const dimColor = useMemo(() => new THREE.Color(`hsl(${hue}, 30%, 24%)`), [hue]);
  const sliceColor = useMemo(() => new THREE.Color(`hsl(${hue}, 55%, 40%)`), [hue]);
  const litColor = useMemo(() => new THREE.Color(`hsl(${hue}, 95%, 72%)`), [hue]);

  const edges = useMemo(
    () =>
      new THREE.EdgesGeometry(
        new THREE.BoxGeometry(kx * step, ky * step, depth * step),
      ),
    [kx, ky, depth, step],
  );

  const centre = (index: number, extent: number) => (index - (extent - 1) / 2) * step;

  useFrame(({ clock }) => {
    const instanced = mesh.current;
    if (!instanced) return;

    // Raster scan: continuous along x, stepping y then z as it wraps.
    const t = reduced ? nx * 2.5 : clock.getElapsedTime() * speed * 2;
    const cx = t % nx;
    const cy = Math.floor(t / nx) % ny;
    const cz = Math.floor(t / (nx * ny)) % nz;

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

    box.current?.position.set(centre(cx, nx), centre(cy, ny), centre(cz, nz));
    // A slow sway rather than a full spin -- the kernel stays trackable.
    if (group.current) {
      group.current.rotation.y = reduced
        ? 0.35
        : 0.35 + Math.sin(clock.getElapsedTime() * 0.18) * 0.22;
    }
  });

  return (
    <group ref={group}>
      <Voxels meshRef={mesh} count={count} />
      <lineSegments ref={box} geometry={edges}>
        <lineBasicMaterial color={litColor} transparent opacity={0.9} />
      </lineSegments>
    </group>
  );
}

function Voxels({
  meshRef,
  count,
}: {
  meshRef: React.RefObject<THREE.InstancedMesh | null>;
  count: number;
}) {
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <boxGeometry args={[0.3, 0.3, 0.3]} />
      <meshStandardMaterial roughness={0.45} metalness={0.1} transparent opacity={0.9} />
    </instancedMesh>
  );
}
