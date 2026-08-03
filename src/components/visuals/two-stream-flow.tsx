"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { cn, hueColor } from "@/lib/utils";
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

/** How a lane is drawn: carrying data, switched off, or right/wrong on a case. */
type LaneState = "on" | "off" | "ok" | "fail";

type Selection = "rgb" | "flow" | "both";

/** One qualitative example, with which streams got it right. */
export interface StreamCase {
  id: string;
  label: string;
  rgb: boolean;
  flow: boolean;
  fused: boolean;
  note: string;
}

/** One row of a fusion results table. */
export interface FusionRow {
  id: string;
  label: string;
  accuracy: number;
  title?: string;
}

export interface TwoStreamFlowProps {
  hue?: number;
  /**
   * `streams` compares the two inputs on their own. `fusion` shows why adding
   * their outputs beats either, using the paper's qualitative cases.
   */
  mode?: "streams" | "fusion";
  /** Accuracy of each stream alone, and of the two fused. */
  accuracy?: { rgb?: number; flow?: number; both?: number };
  /** Fusion variants -- which model the second stream contributed. */
  fusion?: FusionRow[];
  cases?: StreamCase[];
  labels?: { rgb: string; flow: string };
  /**
   * Overrides the visible copy of `streams` mode.
   *
   * The defaults describe RGB against optical flow, which is what the two-stream
   * papers do. Other papers run two lanes over something else entirely -- a pair
   * of adjacent frames, two resolutions -- and for those the default sentences
   * would be plainly wrong on screen, so they can be replaced wholesale.
   */
  copy?: {
    /** Chip labels. Default "RGB" and "flow". */
    chips?: { rgb: string; flow: string; both: string };
    /** The sentence under the chips, per selection. */
    lines?: { rgb: string; flow: string; both: string };
    /** Named in each lane's hover label. Default "3D ResNet-18". */
    backbone?: string;
    /** Readout heading. Default "Validation accuracy". */
    readout?: string;
    /** What the `both` delta is measured against. Default "vs best single". */
    deltaLabel?: string;
  };
}

/**
 * The two-stream architecture: appearance frames along one lane, optical flow
 * along the other, summed at the end.
 *
 * The point of the `fusion` mode is that the streams fail on *different* videos.
 * A stream going dark while the sum still lands makes late fusion look like what
 * it is -- not an accuracy trick, but two views covering each other's blind spots.
 */
export function TwoStreamFlow({
  hue = 210,
  mode = "streams",
  accuracy = {},
  fusion = [],
  cases = [],
  labels = { rgb: "RGB frames", flow: "optical flow" },
  copy,
}: TwoStreamFlowProps) {
  const accent = hueColor(hue);

  const chips = copy?.chips ?? { rgb: "RGB", flow: "flow", both: "both" };
  const lines = copy?.lines ?? {
    rgb: "Three channels of colour. Sees who and where, but has to infer movement.",
    flow: "Two channels of per-pixel motion. Sees movement directly, and nothing about appearance.",
    both: "Each stream predicts on its own; the two outputs are added before the softmax.",
  };

  const [selection, setSelection] = useState<Selection>("both");
  const [caseId, setCaseId] = useState(() => cases[0]?.id ?? "");
  const [fusionId, setFusionId] = useState(() => bestFusion(fusion)?.id ?? "");
  const { frame, hover, hovered } = useSceneHover();

  const active = cases.find((item) => item.id === caseId) ?? cases[0];
  const activeFusion = fusion.find((row) => row.id === fusionId);

  const lanes: { rgb: LaneState; flow: LaneState } =
    mode === "fusion" && active
      ? { rgb: active.rgb ? "ok" : "fail", flow: active.flow ? "ok" : "fail" }
      : {
          rgb: selection === "flow" ? "off" : "on",
          flow: selection === "rgb" ? "off" : "on",
        };

  const output: LaneState =
    mode === "fusion" && active ? (active.fused ? "ok" : "fail") : "on";

  return (
    <div className="flex h-full flex-col">
      <HoverFrame frame={frame} hovered={hovered}>
        <SceneCanvas
          camera={[0, 0.5, 8.4]}
          fov={42}
          fallback={<WebGLFallback />}
          orbit
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[2, 5, 6]} intensity={1} />
          <Streams
            lanes={lanes}
            output={output}
            hue={hue}
            labels={labels}
            backbone={copy?.backbone ?? "3D ResNet-18"}
            hover={hover}
          />
        </SceneCanvas>
      </HoverFrame>

      {mode === "fusion" ? (
        <ControlRow>
          <SegmentedControl<string>
            label="Example video"
            value={active?.id ?? ""}
            onChange={setCaseId}
            accent={accent}
            options={cases.map((item) => ({
              value: item.id,
              label: item.label,
              title: item.note,
            }))}
          />

          <ControlGroup label="Verdict">
            <div className="flex flex-wrap gap-1">
              <Verdict label="RGB" ok={active?.rgb} />
              <Verdict label="flow" ok={active?.flow} />
              <Verdict label="fused" ok={active?.fused} />
            </div>
          </ControlGroup>

          <SegmentedControl<string>
            label="Fused with flow model"
            value={fusionId}
            onChange={setFusionId}
            accent={accent}
            options={fusion.map((row) => ({
              value: row.id,
              label: row.label,
              title: row.title,
            }))}
          />

          <Readout
            label="Validation accuracy"
            value={activeFusion?.accuracy}
            accent={accent}
            delta={
              activeFusion && accuracy.rgb !== undefined
                ? activeFusion.accuracy - accuracy.rgb
                : undefined
            }
            deltaLabel="vs RGB alone"
          />
        </ControlRow>
      ) : (
        <ControlRow>
          <SegmentedControl<Selection>
            label="Streams used"
            value={selection}
            onChange={setSelection}
            accent={accent}
            options={[
              { value: "rgb", label: chips.rgb, title: `${labels.rgb} only` },
              { value: "flow", label: chips.flow, title: `${labels.flow} only` },
              { value: "both", label: chips.both, title: "Both lanes, combined" },
            ]}
          />

          <p className="text-ink-faint max-w-xs text-xs leading-relaxed">
            {lines[selection]}
          </p>

          <Readout
            label={copy?.readout ?? "Validation accuracy"}
            value={accuracy[selection === "both" ? "both" : selection]}
            accent={accent}
            delta={
              selection === "both" &&
              accuracy.both !== undefined &&
              accuracy.rgb !== undefined
                ? accuracy.both - Math.max(accuracy.rgb, accuracy.flow ?? 0)
                : undefined
            }
            deltaLabel={copy?.deltaLabel ?? "vs best single"}
          />
        </ControlRow>
      )}
    </div>
  );
}

function bestFusion(fusion: FusionRow[]): FusionRow | undefined {
  return fusion.reduce<FusionRow | undefined>(
    (winner, row) => (!winner || row.accuracy > winner.accuracy ? row : winner),
    undefined,
  );
}

function Verdict({ label, ok }: { label: string; ok?: boolean }) {
  return (
    <span
      className={cn(
        "bg-raised rounded-md px-2 py-1 font-mono text-[11px]",
        ok ? "text-signal" : "text-alert",
      )}
    >
      {label} {ok ? "✓" : "✗"}
    </span>
  );
}

const FRAMES = 8;
const BLOCK_X = [-1.7, -0.5, 0.7];
const BLOCK_WIDTH = 0.55;
const START_X = -4.3;
/** Where a lane stops running straight and turns toward the sum node. */
const MERGE_X = BLOCK_X[2] + BLOCK_WIDTH / 2 + 0.25;
const SUM_X = 2.3;
const OUT_X = 3.7;
const LANE_Y = 1.15;

function Streams({
  lanes,
  output,
  hue,
  labels,
  backbone,
  hover,
}: {
  lanes: { rgb: LaneState; flow: LaneState };
  output: LaneState;
  hue: number;
  labels: { rgb: string; flow: string };
  backbone: string;
  hover: SceneHover;
}) {
  const reduced = useReducedMotion();
  const rgbPulse = useRef<THREE.Mesh>(null);
  const flowPulse = useRef<THREE.Mesh>(null);
  const sumPulse = useRef<THREE.Mesh>(null);

  const palette = useMemo(
    () => ({
      rgb: new THREE.Color(`hsl(${hue}, 60%, 48%)`),
      flow: new THREE.Color(`hsl(${(hue + 55) % 360}, 60%, 48%)`),
      // A switched-off lane recedes toward the panel, so `off` is the line
      // color rather than the dark it was on the dark stage.
      off: new THREE.Color("#c6cbd3"),
      fail: new THREE.Color("#be123c"),
      lit: new THREE.Color(`hsl(${hue}, 88%, 40%)`),
    }),
    [hue],
  );

  const colorFor = (lane: "rgb" | "flow", state: LaneState) => {
    if (state === "off") return palette.off;
    if (state === "fail") return palette.fail;
    return palette[lane];
  };

  /** How a lane is doing, in the words the controls use. */
  const stateWord = (state: LaneState) =>
    state === "off"
      ? "switched off"
      : state === "ok"
        ? "classified it correctly"
        : state === "fail"
          ? "got it wrong"
          : "running";

  const scale = useFitScale(Math.abs(START_X) + OUT_X + 1, 4);

  useFrame(({ clock }) => {
    const t = reduced ? 0.55 : (clock.getElapsedTime() * 0.4) % 1;

    const travel = (mesh: THREE.Mesh | null, state: LaneState) => {
      if (!mesh) return;
      mesh.visible = state !== "off" && state !== "fail";
      mesh.position.x = START_X + (MERGE_X - START_X) * t;
    };
    travel(rgbPulse.current, lanes.rgb);
    travel(flowPulse.current, lanes.flow);

    if (sumPulse.current) {
      sumPulse.current.position.x = SUM_X + (OUT_X - SUM_X) * t;
      sumPulse.current.visible = output !== "fail";
    }
  });

  return (
    <group rotation={[0.05, -0.12, 0]} scale={scale}>
      {(["rgb", "flow"] as const).map((lane) => {
        const y = lane === "rgb" ? LANE_Y : -LANE_Y;
        const state = lanes[lane];
        const color = colorFor(lane, state);
        const dim = state === "off";

        const name = labels[lane];

        return (
          <group key={lane} position={[0, y, 0]}>
            <FrameStack
              color={color}
              dim={dim}
              startX={START_X}
              hover={hover}
              label={`${name} · input clip · ${
                lane === "rgb" ? "3 channels" : "2 channels, horizontal and vertical"
              }`}
            />
            {BLOCK_X.map((x, index) => (
              <mesh
                key={x}
                position={[x, 0, 0]}
                onPointerMove={(event) => {
                  event.stopPropagation();
                  hover.show(
                    `${name} · ${backbone} stage ${index + 1} · ${stateWord(state)}`,
                    event,
                  );
                }}
                onPointerOut={hover.hide}
              >
                <boxGeometry
                  args={[BLOCK_WIDTH, 0.9 - index * 0.12, 0.9 - index * 0.12]}
                />
                <meshStandardMaterial
                  color={color}
                  roughness={0.45}
                  metalness={0.1}
                  transparent
                  opacity={dim ? 0.35 : 0.92}
                />
              </mesh>
            ))}
            {/* Lane rail, so an inactive stream still reads as a path. */}
            <mesh position={[(START_X + MERGE_X) / 2, 0, 0]}>
              <boxGeometry args={[MERGE_X - START_X, 0.03, 0.03]} />
              <meshBasicMaterial color={color} transparent opacity={dim ? 0.25 : 0.55} />
            </mesh>
            <mesh ref={lane === "rgb" ? rgbPulse : flowPulse} position={[START_X, 0, 0]}>
              <sphereGeometry args={[0.12, 16, 16]} />
              <meshBasicMaterial color={palette.lit} />
            </mesh>
          </group>
        );
      })}

      {/* The two lanes meeting: outputs added, then softmax. */}
      {[LANE_Y, -LANE_Y].map((y) => {
        const dx = SUM_X - MERGE_X;
        return (
          <mesh
            key={y}
            position={[(MERGE_X + SUM_X) / 2, y / 2, 0]}
            rotation={[0, 0, Math.atan2(-y, dx)]}
          >
            <boxGeometry args={[Math.hypot(dx, y), 0.03, 0.03]} />
            <meshBasicMaterial color="#c6cbd3" />
          </mesh>
        );
      })}

      <mesh
        position={[SUM_X, 0, 0]}
        onPointerMove={(event) => {
          event.stopPropagation();
          hover.show("late fusion · the two streams' scores are added", event);
        }}
        onPointerOut={hover.hide}
      >
        <sphereGeometry args={[0.3, 24, 24]} />
        <meshStandardMaterial
          color={output === "fail" ? palette.fail : palette.lit}
          roughness={0.3}
          metalness={0.2}
        />
      </mesh>
      <mesh ref={sumPulse} position={[SUM_X, 0, 0]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color={palette.lit} />
      </mesh>

      <mesh
        position={[OUT_X, 0, 0]}
        onPointerMove={(event) => {
          event.stopPropagation();
          hover.show(
            `softmax · fight or non-fight · ${
              output === "fail" ? "wrong on this clip" : "correct on this clip"
            }`,
            event,
          );
        }}
        onPointerOut={hover.hide}
      >
        <boxGeometry args={[0.45, 0.9, 0.9]} />
        <meshStandardMaterial
          color={output === "fail" ? palette.fail : palette.lit}
          roughness={0.35}
          metalness={0.15}
          transparent
          opacity={0.9}
        />
      </mesh>
    </group>
  );
}

/** The input clip: a short run of frames feeding one lane. */
function FrameStack({
  color,
  dim,
  startX,
  hover,
  label,
}: {
  color: THREE.Color;
  dim: boolean;
  startX: number;
  hover: SceneHover;
  label: string;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);

  const matrices = useMemo(() => {
    const dummy = new THREE.Object3D();
    return Array.from({ length: FRAMES }, (_, i) => {
      dummy.position.set(startX + i * 0.16, 0, 0);
      dummy.updateMatrix();
      return dummy.matrix.clone();
    });
  }, [startX]);

  useFrame(() => {
    const instanced = mesh.current;
    if (!instanced) return;
    for (let i = 0; i < FRAMES; i++) {
      instanced.setMatrixAt(i, matrices[i]);
      instanced.setColorAt(i, color);
    }
    instanced.instanceMatrix.needsUpdate = true;
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, FRAMES]}
      onPointerMove={(event) => {
        event.stopPropagation();
        hover.show(label, event);
      }}
      onPointerOut={hover.hide}
    >
      <boxGeometry args={[0.05, 1, 1]} />
      <meshStandardMaterial
        roughness={0.5}
        metalness={0.05}
        transparent
        opacity={dim ? 0.3 : 0.85}
      />
    </instancedMesh>
  );
}
