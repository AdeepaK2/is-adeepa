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

/** Which stages of the pipeline are being counted. */
type Scope = "claimed" | "full";

/**
 * One timed stage of a pipeline.
 *
 * Papers time their stages in whichever unit suited the experiment -- per image
 * for a feature extractor, per clip for a classifier -- and then compare the two
 * as though they were the same quantity. Both units are accepted here so the
 * composition can be done once, correctly, in the visual.
 */
export interface BudgetStage {
  id: string;
  label: string;
  /** Seconds per frame, for a stage timed per image. */
  perFrame?: number;
  /** Seconds per clip, for a stage timed per clip or per test video. */
  perClip?: number;
  /** Whether the paper's own real-time claim included this stage. */
  countedInClaim: boolean;
  note?: string;
}

export interface ThroughputBudgetProps {
  hue?: number;
  stages?: BudgetStage[];
  /** Seconds of compute available per second of video. Real time is 1. */
  budgetSeconds?: number;
  /** Seconds of video in one clip, used to amortise a per-clip cost. */
  clipSeconds?: number;
  /** Input frame rates to test the budget against. */
  frameRates?: number[];
  copy?: {
    /** Readout heading. Default "Compute per second of video". */
    readout?: string;
    /** Chip group heading for the scope switch. */
    scopeLabel?: string;
    /** Chip group heading for the frame-rate switch. */
    rateLabel?: string;
    chips?: { claimed: string; full: string };
    /** The sentence under the chips, per scope. */
    lines?: { claimed: string; full: string };
  };
}

const UNIT = 0.62;
const BLOCK_H = 1.15;
const BLOCK_D = 1.15;
/** Past this the row says nothing more than "far too slow", and stops fitting. */
const MAX_BLOCKS = 40;

/**
 * Seconds of compute owed for one second of video, drawn against the budget.
 *
 * A real-time claim is an arithmetic statement -- the pipeline finishes a second
 * of video in under a second -- and papers routinely make it from the cost of one
 * stage while a larger stage sits untimed or timed in a different unit two
 * columns away. Each solid block here is one second of compute owed; the outlined
 * block is the second available. Switching the scope from what a paper's claim
 * counted to the whole pipeline is the argument, and it needs no scale trick to
 * read: the row either fits inside the outline or it does not.
 */
export function ThroughputBudget({
  hue = 210,
  stages = [],
  budgetSeconds = 1,
  clipSeconds = 1,
  frameRates = [25, 30],
  copy,
}: ThroughputBudgetProps) {
  const accent = hueColor(hue);
  const { frame, hover, hovered } = useSceneHover();

  const [scope, setScope] = useState<Scope>("claimed");
  const [fps, setFps] = useState(() => frameRates[0] ?? 25);

  const included = stages.filter(
    (stage) => scope === "full" || stage.countedInClaim,
  );

  const perStage = included.map((stage) => ({
    stage,
    seconds:
      (stage.perFrame ?? 0) * fps + (stage.perClip ?? 0) / Math.max(clipSeconds, 0.001),
  }));
  const cost = perStage.reduce((sum, row) => sum + row.seconds, 0);

  const chips = copy?.chips ?? { claimed: "as claimed", full: "whole pipeline" };
  const lines = copy?.lines;

  const over = cost - budgetSeconds;

  return (
    <div className="flex h-full flex-col">
      <HoverFrame frame={frame} hovered={hovered}>
        <SceneCanvas
          camera={[0, 2.2, 8.4]}
          fov={40}
          fallback={<WebGLFallback />}
          orbit
        >
          <ambientLight intensity={0.65} />
          <directionalLight position={[3, 5, 6]} intensity={1} />
          <BudgetRow
            cost={cost}
            budget={budgetSeconds}
            fps={fps}
            hue={hue}
            hover={hover}
          />
        </SceneCanvas>
      </HoverFrame>

      <ControlRow>
        <SegmentedControl<Scope>
          label={copy?.scopeLabel ?? "Stages counted"}
          value={scope}
          onChange={setScope}
          accent={accent}
          options={[
            {
              value: "claimed",
              label: chips.claimed,
              title: stages
                .filter((stage) => stage.countedInClaim)
                .map((stage) => stage.label)
                .join(" · "),
            },
            {
              value: "full",
              label: chips.full,
              title: stages.map((stage) => stage.label).join(" · "),
            },
          ]}
        />

        {frameRates.length > 1 && (
          <SegmentedControl<string>
            label={copy?.rateLabel ?? "Input frame rate"}
            value={String(fps)}
            onChange={(value) => setFps(Number(value))}
            accent={accent}
            options={frameRates.map((rate) => ({
              value: String(rate),
              label: `${rate} fps`,
              title: `${rate} frames arrive per second of video`,
            }))}
          />
        )}

        <ControlGroup label="Budget">
          <p className="text-ink-muted font-mono text-[11px] tabular-nums">
            {budgetSeconds.toFixed(2)}s available
            {over > 0 ? (
              <span className="text-alert"> · over by {over.toFixed(2)}s</span>
            ) : (
              <span className="text-signal"> · inside by {(-over).toFixed(2)}s</span>
            )}
          </p>
        </ControlGroup>

        {lines && (
          <p className="text-ink-faint w-full max-w-xl text-xs leading-relaxed">
            {lines[scope]}
          </p>
        )}

        <Readout
          label={copy?.readout ?? "Compute per second of video"}
          value={Number(cost.toFixed(2))}
          unit=" s"
          accent={accent}
        />
      </ControlRow>
    </div>
  );
}

function BudgetRow({
  cost,
  budget,
  fps,
  hue,
  hover,
}: {
  cost: number;
  budget: number;
  fps: number;
  hue: number;
  hover: SceneHover;
}) {
  // Inactive pale, active dark and saturated -- the page behind this is light.
  const lit = useMemo(() => new THREE.Color(`hsl(${hue}, 85%, 42%)`), [hue]);
  const overflow = useMemo(() => new THREE.Color("#be123c"), []);

  const blocks = useMemo(() => {
    const count = Math.min(MAX_BLOCKS, Math.max(1, Math.ceil(cost)));
    return Array.from({ length: count }, (_, i) => ({
      index: i,
      // The last block is a partial second whenever the cost is not whole.
      length: Math.max(0.04, Math.min(1, cost - i)),
      overBudget: i >= budget,
    }));
  }, [cost, budget]);

  const span = Math.max(budget, Math.min(cost, MAX_BLOCKS));
  const left = -(span * UNIT) / 2;

  const outline = useMemo(
    () =>
      new THREE.EdgesGeometry(
        new THREE.BoxGeometry(
          budget * UNIT + 0.08,
          BLOCK_H + 0.22,
          BLOCK_D + 0.22,
        ),
      ),
    [budget],
  );

  const scale = useFitScale(span * UNIT + 1.8, 3.4);

  return (
    <group rotation={[0.12, -0.2, 0]} scale={scale}>
      {blocks.map((block) => (
        <Second
          key={block.index}
          index={block.index}
          length={block.length}
          overBudget={block.overBudget}
          left={left}
          lit={lit}
          overflow={overflow}
          hover={hover}
        />
      ))}

      <mesh
        position={[left + (budget * UNIT) / 2, 0, 0]}
        onPointerMove={(event) => {
          event.stopPropagation();
          hover.show(
            `the real-time budget · ${budget.toFixed(2)}s of compute for ${budget.toFixed(2)}s of video at ${fps} fps`,
            event,
          );
        }}
        onPointerOut={hover.hide}
      >
        <boxGeometry
          args={[budget * UNIT + 0.08, BLOCK_H + 0.22, BLOCK_D + 0.22]}
        />
        <meshStandardMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <lineSegments
        geometry={outline}
        position={[left + (budget * UNIT) / 2, 0, 0]}
      >
        <lineBasicMaterial color="#8b919b" />
      </lineSegments>
    </group>
  );
}

/**
 * One second of compute owed.
 *
 * Grows into place rather than appearing, and staggered along the row, so that
 * switching the scope reads as the cost extending past the budget rather than as
 * two unrelated pictures.
 */
function Second({
  index,
  length,
  overBudget,
  left,
  lit,
  overflow,
  hover,
}: {
  index: number;
  length: number;
  overBudget: boolean;
  left: number;
  lit: THREE.Color;
  overflow: THREE.Color;
  hover: SceneHover;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const elapsed = useRef(0);
  const reduced = useReducedMotion();

  useFrame((_, delta) => {
    if (!mesh.current) return;
    elapsed.current += delta;
    const target = elapsed.current > index * 0.05 ? 1 : 0;
    const current = reduced
      ? 1
      : THREE.MathUtils.lerp(mesh.current.scale.x, target, 0.16);
    // A zero-scaled box renders a degenerate normal matrix, so hold a sliver.
    mesh.current.scale.x = Math.max(current, 0.0001);
  });

  return (
    <mesh
      ref={mesh}
      position={[left + (index + length / 2) * UNIT, 0, 0]}
      scale={[0.0001, 1, 1]}
      onPointerMove={(event) => {
        event.stopPropagation();
        hover.show(
          overBudget
            ? `second ${index + 1} of compute · owed beyond the real-time budget`
            : `second ${index + 1} of compute · inside the budget`,
          event,
        );
      }}
      onPointerOut={hover.hide}
    >
      <boxGeometry args={[length * UNIT * 0.86, BLOCK_H, BLOCK_D]} />
      <meshStandardMaterial
        color={overBudget ? overflow : lit}
        roughness={0.45}
        metalness={0.06}
      />
    </mesh>
  );
}
