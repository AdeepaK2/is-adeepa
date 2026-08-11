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

/** Which branches of the gate are switched on. */
type Branch = "spatial" | "channel" | "both";

export interface AttentionBranch {
  id: "spatial" | "channel";
  label: string;
  /** Hover label on the lane -- say what the branch computes, not its name. */
  note: string;
}

export interface AttentionMapProps {
  hue?: number;
  /** Rows × columns of the drawn feature map. */
  gridSize?: [number, number];
  /** Channel slabs drawn behind it. */
  channels?: number;
  branches?: AttentionBranch[];
  /** How the branches meet. This paper sums them before the sigmoid. */
  combine?: "sum" | "concat" | "product";
  /**
   * Draw the output as `(1 + M) ⊗ F` rather than `M ⊗ F`. With the residual
   * term the gate can only amplify -- a weight of zero still passes the feature
   * through untouched -- which is a different claim from "the model ignores the
   * rest of the frame", and the two are easy to conflate.
   */
  residual?: boolean;
  /**
   * Accuracy per branch configuration. Omit any the paper never ablated; the
   * readout then says so rather than implying the branch was measured alone.
   */
  effect?: { spatial?: number; channel?: number; both?: number };
  copy?: {
    /** Readout heading. Default "Accuracy". */
    readout?: string;
    /** Chip group heading. Default "Branch". */
    branchLabel?: string;
    /** The sentence under the chips, per branch. */
    lines?: Partial<Record<Branch, string>>;
  };
}

const CELL = 0.44;
const SLAB_GAP = 0.5;
const INPUT_X = -3.5;
const OUTPUT_X = 3.4;
const LANE_Y = 1.75;
const SUM_X = 1.25;

const DEFAULT_BRANCHES: AttentionBranch[] = [
  {
    id: "spatial",
    label: "spatial",
    note: "one weight per position, shared across every channel",
  },
  {
    id: "channel",
    label: "channel",
    note: "one weight per channel, shared across every position",
  },
];

/**
 * A two-branch bottleneck attention gate, and what each branch can express.
 *
 * The two branches are routinely described in the same breath -- "spatial and
 * channel attention" -- as though they were two helpings of the same thing. They
 * are not, and the difference is visible in the shape of what they can produce:
 * a spatial mask varies across the frame and is identical on every channel, a
 * channel mask varies across channels and is flat across the frame. Only their
 * combination varies in both, and papers that report one number for the whole
 * module never show which of the two was doing the work.
 *
 * The output cells are scaled by their gain rather than only tinted, because the
 * residual form of the gate is what bounds that gain from below: with `1 + M`
 * the smallest cell is still the original feature, and nothing is ever switched
 * off.
 */
export function AttentionMap({
  hue = 175,
  gridSize = [5, 5],
  channels = 4,
  branches = DEFAULT_BRANCHES,
  combine = "sum",
  residual = true,
  effect = {},
  copy,
}: AttentionMapProps) {
  const accent = hueColor(hue);
  const { frame, hover, hovered } = useSceneHover();
  const [branch, setBranch] = useState<Branch>("both");

  const spatialLabel =
    branches.find((row) => row.id === "spatial")?.label ?? "spatial";
  const channelLabel =
    branches.find((row) => row.id === "channel")?.label ?? "channel";

  const combineText =
    combine === "sum"
      ? "M(F) = σ(M_s(F) + M_c(F))"
      : combine === "product"
        ? "M(F) = σ(M_s(F) ⊗ M_c(F))"
        : "M(F) = σ(concat(M_s(F), M_c(F)))";

  return (
    <div className="flex h-full flex-col">
      <HoverFrame frame={frame} hovered={hovered}>
        <SceneCanvas
          camera={[0.4, 1.6, 8.6]}
          fov={42}
          fallback={<WebGLFallback />}
          orbit
        >
          <ambientLight intensity={0.68} />
          <directionalLight position={[3, 5, 6]} intensity={1} />
          <Gate
            gridSize={gridSize}
            channels={channels}
            branch={branch}
            branches={branches}
            residual={residual}
            combineText={combineText}
            hue={hue}
            hover={hover}
          />
        </SceneCanvas>
      </HoverFrame>

      <ControlRow>
        <SegmentedControl<Branch>
          label={copy?.branchLabel ?? "Branch"}
          value={branch}
          onChange={setBranch}
          accent={accent}
          options={[
            {
              value: "spatial",
              label: spatialLabel,
              title: "Where in the frame -- flat across channels",
            },
            {
              value: "channel",
              label: channelLabel,
              title: "Which channel -- flat across the frame",
            },
            { value: "both", label: "both", title: combineText },
          ]}
        />

        <ControlGroup label="Gate">
          <p className="text-ink-muted font-mono text-[11px]">
            {residual ? "F′ = (1 + M(F)) ⊗ F" : "F′ = M(F) ⊗ F"}
            <span className="text-ink-faint">
              {residual ? " · gain never falls below 1" : ""}
            </span>
          </p>
        </ControlGroup>

        {copy?.lines?.[branch] && (
          <p className="text-ink-faint w-full max-w-xl text-xs leading-relaxed">
            {copy.lines[branch]}
          </p>
        )}

        <Readout
          label={copy?.readout ?? "Accuracy"}
          value={effect[branch]}
          accent={accent}
          unmeasuredNote="this branch was never ablated on its own"
        />
      </ControlRow>
    </div>
  );
}

interface Cell {
  channel: number;
  row: number;
  col: number;
  x: number;
  y: number;
  z: number;
  spatial: number;
  channelWeight: number;
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

function Gate({
  gridSize,
  channels,
  branch,
  branches,
  residual,
  combineText,
  hue,
  hover,
}: {
  gridSize: [number, number];
  channels: number;
  branch: Branch;
  branches: AttentionBranch[];
  residual: boolean;
  combineText: string;
  hue: number;
  hover: SceneHover;
}) {
  const output = useRef<THREE.InstancedMesh>(null);
  const current = useRef<Float32Array>(new Float32Array(0));
  const reduced = useReducedMotion();

  const pale = useMemo(() => new THREE.Color(`hsl(${hue}, 20%, 84%)`), [hue]);
  const lit = useMemo(() => new THREE.Color(`hsl(${hue}, 85%, 42%)`), [hue]);
  const spatialColor = useMemo(
    () => new THREE.Color(`hsl(${hue}, 80%, 44%)`),
    [hue],
  );
  const channelColor = useMemo(
    () => new THREE.Color(`hsl(${(hue + 46) % 360}, 68%, 46%)`),
    [hue],
  );

  const [rows, cols] = gridSize;

  /**
   * The mask each branch produces. Illustrative shapes, not measured ones: the
   * paper publishes no attention maps, so what is drawn here is the *form* a
   * branch can take -- varying across position, or across channel -- and never a
   * claim about where this model actually looked.
   */
  const cells = useMemo<Cell[]>(() => {
    const out: Cell[] = [];
    const centreRow = (rows - 1) * 0.34;
    const centreCol = (cols - 1) * 0.62;
    for (let channel = 0; channel < channels; channel++) {
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const distance =
            (row - centreRow) ** 2 * 0.6 + (col - centreCol) ** 2 * 0.5;
          out.push({
            channel,
            row,
            col,
            x: (col - (cols - 1) / 2) * CELL,
            y: ((rows - 1) / 2 - row) * CELL,
            z: (channel - (channels - 1) / 2) * SLAB_GAP,
            spatial: Math.exp(-distance / 2.4),
            channelWeight: 0.18 + 0.74 * (((channel * 5) % channels) / Math.max(channels - 1, 1)),
          });
        }
      }
    }
    return out;
  }, [channels, cols, rows]);

  const target = useMemo(
    () =>
      cells.map((cell) =>
        branch === "spatial"
          ? cell.spatial
          : branch === "channel"
            ? cell.channelWeight
            : sigmoid((cell.spatial - 0.5) * 5 + (cell.channelWeight - 0.5) * 5),
      ),
    [branch, cells],
  );

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const scratch = useMemo(() => new THREE.Color(), []);
  const scale = useFitScale(OUTPUT_X - INPUT_X + 4, rows * CELL + LANE_Y * 2 + 1.6);

  useFrame(() => {
    const mesh = output.current;
    if (!mesh) return;
    if (current.current.length !== cells.length) {
      current.current = new Float32Array(cells.length);
    }

    for (let index = 0; index < cells.length; index++) {
      const cell = cells[index];
      const value = reduced
        ? target[index]
        : THREE.MathUtils.lerp(current.current[index], target[index], 0.12);
      current.current[index] = value;

      const size = 0.2 * (residual ? 1 + value : Math.max(value, 0.05));
      dummy.position.set(OUTPUT_X + cell.x, cell.y, cell.z);
      dummy.scale.setScalar(size);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, scratch.copy(pale).lerp(lit, value));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  const spatialOn = branch !== "channel";
  const channelOn = branch !== "spatial";

  return (
    <group rotation={[0.12, -0.34, 0]} scale={scale}>
      {/* F, before the gate: every cell the same, which is the point. */}
      {cells.map((cell) => (
        <mesh
          key={`in-${cell.channel}-${cell.row}-${cell.col}`}
          position={[INPUT_X + cell.x, cell.y, cell.z]}
          onPointerMove={(event) => {
            event.stopPropagation();
            hover.show(
              `F · input feature map · channel ${cell.channel + 1} of ${channels}, position (${cell.row + 1}, ${cell.col + 1})`,
              event,
            );
          }}
          onPointerOut={hover.hide}
        >
          <boxGeometry args={[0.2, 0.2, 0.2]} />
          <meshStandardMaterial color={pale} roughness={0.65} />
        </mesh>
      ))}

      {/* M_s: one plate, no channel axis at all. */}
      <group position={[-0.6, LANE_Y, 0]}>
        {cells
          .filter((cell) => cell.channel === 0)
          .map((cell) => (
            <mesh
              key={`ms-${cell.row}-${cell.col}`}
              position={[cell.x, cell.y * 0.55, 0]}
              onPointerMove={(event) => {
                event.stopPropagation();
                hover.show(
                  `M_s · ${branches.find((row) => row.id === "spatial")?.note ?? "spatial branch"}`,
                  event,
                );
              }}
              onPointerOut={hover.hide}
            >
              <boxGeometry args={[0.3, 0.18, 0.3]} />
              <meshStandardMaterial
                color={spatialOn ? spatialColor : pale}
                roughness={0.5}
                transparent
                opacity={spatialOn ? 0.5 + cell.spatial * 0.5 : 0.45}
              />
            </mesh>
          ))}
      </group>

      {/* M_c: one weight per channel, no spatial axis at all. */}
      <group position={[-0.6, -LANE_Y, 0]}>
        {Array.from({ length: channels }, (_, channel) => {
          const weight =
            cells.find((cell) => cell.channel === channel)?.channelWeight ?? 0;
          return (
            <mesh
              key={`mc-${channel}`}
              position={[(channel - (channels - 1) / 2) * 0.5, 0, 0]}
              onPointerMove={(event) => {
                event.stopPropagation();
                hover.show(
                  `M_c · ${branches.find((row) => row.id === "channel")?.note ?? "channel branch"} · channel ${channel + 1}`,
                  event,
                );
              }}
              onPointerOut={hover.hide}
            >
              <boxGeometry args={[0.34, 0.16 + weight * 0.5, 0.34]} />
              <meshStandardMaterial
                color={channelOn ? channelColor : pale}
                roughness={0.5}
                transparent
                opacity={channelOn ? 0.95 : 0.45}
              />
            </mesh>
          );
        })}
      </group>

      {/* Where the two meet, and the only place the sigmoid happens. */}
      <mesh
        position={[SUM_X, 0, 0]}
        onPointerMove={(event) => {
          event.stopPropagation();
          hover.show(`${combineText} · the branches meet here`, event);
        }}
        onPointerOut={hover.hide}
      >
        <sphereGeometry args={[0.3, 20, 20]} />
        <meshStandardMaterial
          color={lit}
          roughness={0.4}
          metalness={0.1}
          transparent
          opacity={0.92}
        />
      </mesh>

      <Rod from={[-0.6, LANE_Y]} to={[SUM_X, 0]} color={spatialColor} on={spatialOn} />
      <Rod
        from={[-0.6, -LANE_Y]}
        to={[SUM_X, 0]}
        color={channelColor}
        on={channelOn}
      />
      <Rod from={[INPUT_X + 1, 0]} to={[-1.6, LANE_Y]} color={spatialColor} on={spatialOn} />
      <Rod
        from={[INPUT_X + 1, 0]}
        to={[-1.6, -LANE_Y]}
        color={channelColor}
        on={channelOn}
      />
      <Rod from={[SUM_X, 0]} to={[OUTPUT_X - 1, 0]} color={lit} on />

      <instancedMesh
        ref={output}
        args={[undefined, undefined, cells.length]}
        onPointerMove={(event) => {
          event.stopPropagation();
          const index = event.instanceId;
          if (index === undefined) return;
          const cell = cells[index];
          const gain = (residual ? 1 : 0) + (current.current[index] ?? 0);
          hover.show(
            `F′ · channel ${cell.channel + 1}, position (${cell.row + 1}, ${
              cell.col + 1
            }) · gain ${gain.toFixed(2)}×`,
            event,
          );
        }}
        onPointerOut={hover.hide}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.5} metalness={0.05} />
      </instancedMesh>
    </group>
  );
}

/** A connection between two points in the XY plane. */
function Rod({
  from,
  to,
  color,
  on,
}: {
  from: [number, number];
  to: [number, number];
  color: THREE.Color;
  on: boolean;
}) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.hypot(dx, dy);

  return (
    <mesh
      position={[from[0] + dx / 2, from[1] + dy / 2, 0]}
      rotation={[0, 0, Math.atan2(dy, dx) - Math.PI / 2]}
    >
      <cylinderGeometry args={[0.035, 0.035, length, 8]} />
      <meshStandardMaterial
        color={color}
        roughness={0.6}
        transparent
        opacity={on ? 0.85 : 0.25}
      />
    </mesh>
  );
}
