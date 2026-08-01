"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SceneCanvas } from "./scene-canvas";

export interface VolumeGridProps {
  /** Voxels across the frame (x), down the frame (y), and through time (z). */
  size?: [number, number, number];
  /** Accent hue, normally the paper's `hue`. */
  hue?: number;
  /** Speed of the activation wave sweeping along the time axis. */
  speed?: number;
}

/**
 * A spatio-temporal volume as a lattice of voxels, with a wave of activation
 * sweeping along the time axis. Generic on purpose: most papers in this library
 * describe some operation over exactly this structure, so per-paper modules can
 * reuse it with different sizes and accents.
 */
export function VolumeGrid({
  size = [8, 5, 8],
  hue = 170,
  speed = 0.6,
}: VolumeGridProps) {
  return (
    <SceneCanvas
      camera={[5.2, 3.4, 6.2]}
      fov={40}
      fallback={
        <div className="text-ink-faint grid h-full w-full place-items-center px-6 text-center text-xs">
          This visual needs WebGL, which isn&apos;t available in your browser.
        </div>
      }
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 5]} intensity={1.1} />
      <Lattice size={size} hue={hue} speed={speed} />
    </SceneCanvas>
  );
}

function Lattice({ size, hue, speed }: Required<VolumeGridProps>) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const [nx, ny, nz] = size;
  const count = nx * ny * nz;

  const { matrices, depths } = useMemo(() => {
    const matrices: THREE.Matrix4[] = [];
    const depths: number[] = [];
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
          depths.push(z / Math.max(nz - 1, 1));
        }
      }
    }
    return { matrices, depths };
  }, [nx, ny, nz]);

  const baseColor = useMemo(() => new THREE.Color(`hsl(${hue}, 70%, 55%)`), [hue]);
  const litColor = useMemo(() => new THREE.Color(`hsl(${hue}, 95%, 72%)`), [hue]);

  useFrame(({ clock }) => {
    const instanced = mesh.current;
    if (!instanced) return;
    const t = clock.getElapsedTime() * speed;
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      instanced.setMatrixAt(i, matrices[i]);
      // A band of activation travelling along z, wrapping around.
      const phase = (depths[i] - ((t % 1.6) / 1.6)) % 1;
      const wrapped = phase < 0 ? phase + 1 : phase;
      const intensity = Math.max(0, 1 - wrapped * 4);
      color.copy(baseColor).lerp(litColor, intensity);
      instanced.setColorAt(i, color);
    }

    instanced.instanceMatrix.needsUpdate = true;
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
    instanced.rotation.y = clock.getElapsedTime() * 0.12;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <boxGeometry args={[0.3, 0.3, 0.3]} />
      <meshStandardMaterial
        roughness={0.45}
        metalness={0.1}
        transparent
        opacity={0.9}
      />
    </instancedMesh>
  );
}
