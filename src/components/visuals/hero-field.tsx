"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { seededRandom } from "@/lib/random";
import { SceneCanvas } from "./scene-canvas";

const FRAME_COUNT = 14;
const FRAME_GAP = 0.42;
const POINTS_PER_FRAME = 90;

/**
 * The home page's ambient visual: a clip drawn as what these papers actually
 * operate on -- a stack of frames extended through time, with feature points
 * drifting inside it. Rotates slowly and never demands attention.
 */
export function HeroField() {
  return (
    <SceneCanvas camera={[0, 1.1, 7.4]} fov={42}>
      <ambientLight intensity={0.7} />
      <Volume />
    </SceneCanvas>
  );
}

function Volume() {
  const group = useRef<THREE.Group>(null);

  useFrame(({ clock, pointer }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime();
    // Slow drift, plus a gentle parallax lean toward the cursor.
    group.current.rotation.y = Math.sin(t * 0.14) * 0.5 + pointer.x * 0.25;
    group.current.rotation.x = -0.22 + Math.sin(t * 0.1) * 0.06 - pointer.y * 0.12;
  });

  return (
    <group ref={group}>
      <FrameStack />
      <FeaturePoints />
    </group>
  );
}

/** Outlined planes stacked along z — the frames of a clip. */
function FrameStack() {
  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(3.1, 1.85);
    return new THREE.EdgesGeometry(plane);
  }, []);

  const offset = ((FRAME_COUNT - 1) * FRAME_GAP) / 2;

  return (
    <>
      {Array.from({ length: FRAME_COUNT }, (_, i) => {
        // Fade toward the back of the stack so depth reads without fog.
        const depth = i / (FRAME_COUNT - 1);
        return (
          <lineSegments
            key={i}
            geometry={geometry}
            position={[0, 0, -offset + i * FRAME_GAP]}
          >
            <lineBasicMaterial
              // The frontmost frame is the "current" one and reads as the accent.
              color={i === FRAME_COUNT - 1 ? "#5eead4" : "#5f7395"}
              transparent
              opacity={0.2 + depth * 0.7}
            />
          </lineSegments>
        );
      })}
    </>
  );
}

/** Points that ripple through the volume, standing in for tracked features. */
function FeaturePoints() {
  const points = useRef<THREE.Points>(null);

  const { geometry, seeds } = useMemo(() => {
    const total = FRAME_COUNT * POINTS_PER_FRAME;
    const positions = new Float32Array(total * 3);
    const seeds = new Float32Array(total);
    const offset = ((FRAME_COUNT - 1) * FRAME_GAP) / 2;
    const random = seededRandom(0x5eea);

    for (let f = 0; f < FRAME_COUNT; f++) {
      for (let p = 0; p < POINTS_PER_FRAME; p++) {
        const i = f * POINTS_PER_FRAME + p;
        positions[i * 3] = (random() - 0.5) * 2.9;
        positions[i * 3 + 1] = (random() - 0.5) * 1.7;
        positions[i * 3 + 2] = -offset + f * FRAME_GAP;
        seeds[i] = random() * Math.PI * 2;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return { geometry, seeds };
  }, []);

  useFrame(({ clock }) => {
    if (!points.current) return;
    const t = clock.getElapsedTime();
    const attr = points.current.geometry.attributes.position as THREE.BufferAttribute;
    const array = attr.array as Float32Array;

    // Nudge y only — cheap, and enough to make the volume feel alive.
    for (let i = 0; i < seeds.length; i++) {
      array[i * 3 + 1] += Math.sin(t * 0.9 + seeds[i]) * 0.0016;
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial
        color="#5eead4"
        size={0.042}
        sizeAttenuation
        transparent
        opacity={0.85}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
