"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { hueColor } from "@/lib/utils";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import {
  ControlGroup,
  ControlRow,
  Readout,
  SegmentedControl,
  WebGLFallback,
} from "./controls";
import { HoverFrame, useSceneHover, type SceneHover } from "./hover";
import { SceneCanvas, useFitScale } from "./scene-canvas";

/** Which recurrences are running over the sequence. */
type Direction = "forward" | "bidirectional";

export interface BidirectionalSequenceProps {
  hue?: number;
  /**
   * Frame tiles drawn along the clip. Illustrative unless a paper states its
   * sequence length -- this one writes it as `n` and never assigns it a value,
   * which the latency readout says out loud.
   */
  frames?: number;
  /**
   * Accuracy per configuration. Omit the direction a paper never ran: a
   * bidirectional model whose forward-only ablation is missing cannot say what
   * the second pass bought, and the readout reports that rather than guessing.
   */
  accuracy?: { forward?: number; bidirectional?: number };
  labels?: { forward: string; backward: string; verdict: string };
  copy?: {
    /** Readout heading. Default "Accuracy". */
    readout?: string;
    /** Chip group heading. Default "Recurrence". */
    directionLabel?: string;
    chips?: { forward: string; bidirectional: string };
    /** The sentence under the chips, per direction. */
    lines?: { forward: string; bidirectional: string };
  };
}

const STRIP = 8.4;
const VERDICT_X = STRIP / 2 + 1.35;
const LANE_Y = 1.05;

/**
 * A frame sequence with a forward recurrence above it and a backward one below.
 *
 * The point is latency, not accuracy. A forward-only recurrence has a hidden
 * state after every frame, so a verdict exists whenever you care to read one; a
 * bidirectional one cannot produce anything until its backward pass has started,
 * and the backward pass starts at the last frame. For a paper that motivates
 * itself with early alerts on a live camera, that is a structural constraint
 * rather than a hyperparameter, and it is invisible in an accuracy table.
 *
 * The two lanes are drawn as one growing bar each rather than a chain of cells,
 * because what matters is how much of the clip each pass has had to consume
 * before the verdict block can light.
 */
export function BidirectionalSequence({
  hue = 210,
  frames = 16,
  accuracy = {},
  labels = {
    forward: "forward GRU",
    backward: "backward GRU",
    verdict: "concatenate → classify",
  },
  copy,
}: BidirectionalSequenceProps) {
  const accent = hueColor(hue);
  const [direction, setDirection] = useState<Direction>("bidirectional");
  const { frame, hover, hovered } = useSceneHover();

  const chips = copy?.chips ?? {
    forward: "forward only",
    bidirectional: "bidirectional",
  };
  const lines = copy?.lines;

  const latency =
    direction === "forward"
      ? "1 frame · a state exists after every frame"
      : `all ${frames} frames · nothing before the clip ends`;

  return (
    <div className="flex h-full flex-col">
      <HoverFrame frame={frame} hovered={hovered}>
        <SceneCanvas
          camera={[0, 1.9, 8.6]}
          fov={40}
          fallback={<WebGLFallback />}
          orbit
        >
          <ambientLight intensity={0.65} />
          <directionalLight position={[3, 5, 6]} intensity={1} />
          <Sequence
            frames={frames}
            direction={direction}
            hue={hue}
            labels={labels}
            hover={hover}
          />
        </SceneCanvas>
      </HoverFrame>

      <ControlRow>
        <SegmentedControl<Direction>
          label={copy?.directionLabel ?? "Recurrence"}
          value={direction}
          onChange={setDirection}
          accent={accent}
          options={[
            {
              value: "forward",
              label: chips.forward,
              title: "One pass, first frame to last",
            },
            {
              value: "bidirectional",
              label: chips.bidirectional,
              title: "Two passes, and the second starts at the last frame",
            },
          ]}
        />

        <ControlGroup label="Frames before a verdict">
          <p className="text-ink-muted font-mono text-[11px]">{latency}</p>
        </ControlGroup>

        {lines && (
          <p className="text-ink-faint w-full max-w-xl text-xs leading-relaxed">
            {lines[direction]}
          </p>
        )}

        <Readout
          label={copy?.readout ?? "Accuracy"}
          value={accuracy[direction]}
          accent={accent}
          unmeasuredNote="this configuration was never run"
        />
      </ControlRow>
    </div>
  );
}

function Sequence({
  frames,
  direction,
  hue,
  labels,
  hover,
}: {
  frames: number;
  direction: Direction;
  hue: number;
  labels: { forward: string; backward: string; verdict: string };
  hover: SceneHover;
}) {
  const tiles = useRef<THREE.InstancedMesh>(null);
  const forwardBar = useRef<THREE.Mesh>(null);
  const backwardBar = useRef<THREE.Mesh>(null);
  const verdict = useRef<THREE.MeshStandardMaterial>(null);
  const clock = useRef(0);
  const reduced = useReducedMotion();

  // Inactive states are pale and active ones dark and saturated: the page is
  // light, so the usual dark-scene instinct is inverted here.
  const pale = useMemo(() => new THREE.Color(`hsl(${hue}, 20%, 84%)`), [hue]);
  const litForward = useMemo(
    () => new THREE.Color(`hsl(${hue}, 85%, 42%)`),
    [hue],
  );
  const litBackward = useMemo(
    () => new THREE.Color(`hsl(${(hue + 40) % 360}, 68%, 46%)`),
    [hue],
  );

  const matrices = useMemo(() => {
    const step = STRIP / Math.max(frames - 1, 1);
    const dummy = new THREE.Object3D();
    return Array.from({ length: frames }, (_, i) => {
      dummy.position.set(i * step - STRIP / 2, 0, 0);
      dummy.updateMatrix();
      return dummy.matrix.clone();
    });
  }, [frames]);

  const scale = useFitScale(VERDICT_X * 2 + 1.6, 4.2);

  // Reused so the frame loop allocates nothing.
  const scratch = useMemo(() => new THREE.Color(), []);

  useFrame((_, delta) => {
    // One sweep of the clip, then a beat holding the finished state, so the
    // bidirectional verdict is visible rather than flashing past.
    clock.current = (clock.current + delta / 4.5) % 1.28;
    const t = reduced ? 1 : Math.min(1, clock.current);

    const bidirectional = direction === "bidirectional";
    const last = Math.max(frames - 1, 1);

    const instanced = tiles.current;
    if (instanced) {
      for (let i = 0; i < frames; i++) {
        instanced.setMatrixAt(i, matrices[i]);
        const readForward = i / last <= t;
        const readBackward = bidirectional && (last - i) / last <= t;
        if (readForward && readBackward) {
          scratch.copy(litForward).lerp(litBackward, 0.5);
        } else if (readForward) {
          scratch.copy(litForward);
        } else if (readBackward) {
          scratch.copy(litBackward);
        } else {
          scratch.copy(pale);
        }
        instanced.setColorAt(i, scratch);
      }
      instanced.instanceMatrix.needsUpdate = true;
      if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
    }

    // Both bars grow from their own end of the strip.
    const length = Math.max(0.001, t * STRIP);
    if (forwardBar.current) {
      forwardBar.current.scale.x = length;
      forwardBar.current.position.x = -STRIP / 2 + length / 2;
    }
    if (backwardBar.current) {
      backwardBar.current.visible = bidirectional;
      backwardBar.current.scale.x = length;
      backwardBar.current.position.x = STRIP / 2 - length / 2;
    }

    // Forward-only: confidence exists and grows. Bidirectional: nothing until
    // the backward pass has reached the front of the clip.
    if (verdict.current) {
      const ready = bidirectional ? (t >= 0.999 ? 1 : 0) : t;
      verdict.current.color.copy(pale).lerp(litForward, ready);
    }
  });

  return (
    <group rotation={[0.08, -0.2, 0]} scale={scale}>
      <instancedMesh
        ref={tiles}
        args={[undefined, undefined, frames]}
        onPointerMove={(event) => {
          event.stopPropagation();
          const index = event.instanceId;
          if (index === undefined) return;
          hover.show(
            `frame ${index + 1} of ${frames} · read first by the ${
              direction === "bidirectional" && index > (frames - 1) / 2
                ? "backward"
                : "forward"
            } pass`,
            event,
          );
        }}
        onPointerOut={hover.hide}
      >
        <boxGeometry args={[STRIP / frames / 1.5, 1.5, 1.5]} />
        <meshStandardMaterial roughness={0.5} metalness={0.05} />
      </instancedMesh>

      <mesh
        ref={forwardBar}
        position={[-STRIP / 2, LANE_Y, 0]}
        scale={[0.0001, 1, 1]}
        onPointerMove={(event) => {
          event.stopPropagation();
          hover.show(`${labels.forward} · first frame to last`, event);
        }}
        onPointerOut={hover.hide}
      >
        <boxGeometry args={[1, 0.24, 0.4]} />
        <meshStandardMaterial color={litForward} roughness={0.45} />
      </mesh>

      <mesh
        ref={backwardBar}
        position={[STRIP / 2, -LANE_Y, 0]}
        scale={[0.0001, 1, 1]}
        onPointerMove={(event) => {
          event.stopPropagation();
          hover.show(
            `${labels.backward} · last frame to first, so it cannot start until the clip has ended`,
            event,
          );
        }}
        onPointerOut={hover.hide}
      >
        <boxGeometry args={[1, 0.24, 0.4]} />
        <meshStandardMaterial color={litBackward} roughness={0.45} />
      </mesh>

      <mesh
        position={[VERDICT_X, 0, 0]}
        onPointerMove={(event) => {
          event.stopPropagation();
          hover.show(
            direction === "bidirectional"
              ? `${labels.verdict} · waits for both passes, so no verdict exists before the last frame`
              : `${labels.verdict} · a forward state exists after every frame`,
            event,
          );
        }}
        onPointerOut={hover.hide}
      >
        <boxGeometry args={[0.9, 1.9, 1.9]} />
        <meshStandardMaterial
          ref={verdict}
          color={pale}
          roughness={0.5}
          metalness={0.05}
        />
      </mesh>
    </group>
  );
}
