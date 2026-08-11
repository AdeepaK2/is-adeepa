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

/** One stacked temporal-convolution block. */
export interface TcnBlock {
  name: string;
  /** Spacing between the timesteps this block's kernel reads. */
  dilation: number;
  /** Taps per kernel. Odd, so the block stays centred on its own timestep. */
  kernel?: number;
}

/** A sequence length the paper ran, and what it scored there. */
export interface SequenceLengthRow {
  frames: number;
  /** Omit for a length the paper did not measure -- never interpolate one. */
  accuracy?: number;
}

export interface TcnReceptiveFieldProps {
  hue?: number;
  /** Frame tiles drawn along the clip. Overridden by the selected length. */
  frames?: number;
  /** Blocks, input first. This paper stacks three. */
  blocks?: TcnBlock[];
  /** Lengths the reader can switch between, with the paper's accuracy at each. */
  sequenceLengths?: SequenceLengthRow[];
  copy?: {
    /** Readout heading. Default "Accuracy". */
    readout?: string;
    /** Chip group heading for the depth switch. Default "Read from". */
    depthLabel?: string;
    /** Chip group heading for the length switch. Default "Sequence length". */
    lengthLabel?: string;
  };
}

const STRIP = 8.4;
const FRAME_Y = -1.85;
const LAYER_GAP = 1.15;

const DEFAULT_BLOCKS: TcnBlock[] = [
  { name: "block 1", dilation: 1, kernel: 3 },
  { name: "block 2", dilation: 2, kernel: 3 },
  { name: "block 3", dilation: 4, kernel: 3 },
];

/**
 * How much of a clip one unit of a dilated temporal convolution stack can see.
 *
 * The paper proposes its ST-TCN blocks as a replacement for recurrence, and the
 * substitution only works if depth buys reach: a recurrent state carries the
 * whole prefix by construction, while a convolution sees exactly the window its
 * kernels span and not one frame more. Stacking with growing dilation widens
 * that window geometrically, and the cone drawn here is the whole argument --
 * select a depth and the frames outside its reach stay pale, because for that
 * unit they do not exist.
 *
 * Only the cone above the centre timestep is drawn rather than every edge in the
 * stack. The full graph is a solid mat of lines at any useful clip length, and
 * the question the visual answers is about one output unit's inputs.
 */
export function TcnReceptiveField({
  hue = 175,
  frames = 20,
  blocks = DEFAULT_BLOCKS,
  sequenceLengths = [],
  copy,
}: TcnReceptiveFieldProps) {
  const accent = hueColor(hue);
  const { frame, hover, hovered } = useSceneHover();

  const [depth, setDepth] = useState(blocks.length);
  const [length, setLength] = useState<number>(
    () => sequenceLengths[0]?.frames ?? frames,
  );

  const clip = sequenceLengths.length > 0 ? length : frames;
  const activeDepth = Math.min(depth, blocks.length);
  const layers = useMemo(
    () => coneLayers(clip, blocks, activeDepth),
    [clip, blocks, activeDepth],
  );

  const covered = layers[0] ?? [];
  const span =
    covered.length === 0 ? 0 : covered[covered.length - 1] - covered[0] + 1;

  // What the stack reaches on an unbounded clip, before the clip truncates it.
  const reach = blocks
    .slice(0, activeDepth)
    .reduce((total, block) => total + ((block.kernel ?? 3) - 1) * block.dilation, 1);

  const accuracy = sequenceLengths.find((row) => row.frames === clip)?.accuracy;

  return (
    <div className="flex h-full flex-col">
      <HoverFrame frame={frame} hovered={hovered}>
        <SceneCanvas
          camera={[0, 1.2, 9]}
          fov={42}
          fallback={<WebGLFallback />}
          orbit
        >
          <ambientLight intensity={0.65} />
          <directionalLight position={[3, 5, 6]} intensity={1} />
          <Stack
            clip={clip}
            blocks={blocks}
            depth={activeDepth}
            layers={layers}
            hue={hue}
            hover={hover}
          />
        </SceneCanvas>
      </HoverFrame>

      <ControlRow>
        <SegmentedControl<string>
          label={copy?.depthLabel ?? "Read from"}
          value={String(activeDepth)}
          onChange={(value) => setDepth(Number(value))}
          accent={accent}
          options={blocks.map((block, index) => ({
            value: String(index + 1),
            label: block.name,
            title: `dilation ${block.dilation}, ${block.kernel ?? 3} taps`,
          }))}
        />

        {sequenceLengths.length > 1 && (
          <SegmentedControl<string>
            label={copy?.lengthLabel ?? "Sequence length"}
            value={String(clip)}
            onChange={(value) => setLength(Number(value))}
            accent={accent}
            options={sequenceLengths.map((row) => ({
              value: String(row.frames),
              label: `${row.frames}`,
              title: `${row.frames} frames per clip`,
            }))}
          />
        )}

        <ControlGroup label="Receptive field">
          <p className="text-ink-muted font-mono text-[11px] tabular-nums">
            {span} of {clip} frames
            <span className="text-ink-faint">
              {" · reach "}
              {reach}
              {reach > clip ? " (clipped by the clip)" : ""}
            </span>
          </p>
        </ControlGroup>

        <Readout
          label={copy?.readout ?? "Accuracy"}
          value={accuracy}
          accent={accent}
          unmeasuredNote="this length was not measured"
        />
      </ControlRow>
    </div>
  );
}

/**
 * Indices each layer contributes to one output unit at `depth`, layer 0 being
 * the frames themselves. Walked downwards from the single selected unit, so what
 * comes back is exactly that unit's receptive field at every level.
 */
function coneLayers(
  frames: number,
  blocks: TcnBlock[],
  depth: number,
): number[][] {
  const layers: number[][] = Array.from({ length: depth + 1 }, () => []);
  let current = [Math.floor((frames - 1) / 2)];
  layers[depth] = current;

  for (let level = depth; level >= 1; level--) {
    const block = blocks[level - 1];
    const half = Math.floor((block.kernel ?? 3) / 2);
    const inputs = new Set<number>();
    for (const unit of current) {
      for (let tap = -half; tap <= half; tap++) {
        const index = unit + tap * block.dilation;
        if (index >= 0 && index < frames) inputs.add(index);
      }
    }
    current = [...inputs].sort((a, b) => a - b);
    layers[level - 1] = current;
  }

  return layers;
}

function layerY(level: number): number {
  return FRAME_Y + level * LAYER_GAP;
}

function Stack({
  clip,
  blocks,
  depth,
  layers,
  hue,
  hover,
}: {
  clip: number;
  blocks: TcnBlock[];
  depth: number;
  layers: number[][];
  hue: number;
  hover: SceneHover;
}) {
  const tiles = useRef<THREE.InstancedMesh>(null);
  const pulse = useRef<THREE.Mesh>(null);
  const time = useRef(0);
  const reduced = useReducedMotion();

  // The page is light, so inactive reads as pale and active as dark and
  // saturated -- the inverse of the usual dark-scene instinct.
  const pale = useMemo(() => new THREE.Color(`hsl(${hue}, 20%, 84%)`), [hue]);
  const lit = useMemo(() => new THREE.Color(`hsl(${hue}, 85%, 42%)`), [hue]);
  const edge = useMemo(() => new THREE.Color(`hsl(${hue}, 72%, 46%)`), [hue]);

  const step = STRIP / Math.max(clip - 1, 1);
  const x = (index: number) => index * step - STRIP / 2;

  const matrices = useMemo(() => {
    const dummy = new THREE.Object3D();
    return Array.from({ length: clip }, (_, index) => {
      dummy.position.set(index * step - STRIP / 2, FRAME_Y, 0);
      dummy.updateMatrix();
      return dummy.matrix.clone();
    });
  }, [clip, step]);

  const coveredFrames = useMemo(() => new Set(layers[0] ?? []), [layers]);
  const scratch = useMemo(() => new THREE.Color(), []);

  /** Edges of the cone, one per tap that lands inside the clip. */
  const edges = useMemo(() => {
    const at = (index: number) => index * step - STRIP / 2;
    const out: { key: string; from: THREE.Vector2; to: THREE.Vector2 }[] = [];
    for (let level = depth; level >= 1; level--) {
      const block = blocks[level - 1];
      const half = Math.floor((block.kernel ?? 3) / 2);
      for (const unit of layers[level] ?? []) {
        for (let tap = -half; tap <= half; tap++) {
          const index = unit + tap * block.dilation;
          if (index < 0 || index >= clip) continue;
          out.push({
            key: `${level}-${unit}-${tap}`,
            from: new THREE.Vector2(at(unit), layerY(level)),
            to: new THREE.Vector2(at(index), layerY(level - 1)),
          });
        }
      }
    }
    return out;
  }, [blocks, clip, depth, layers, step]);

  const scale = useFitScale(STRIP + 2, (blocks.length + 1) * LAYER_GAP + 2.4);
  const topY = layerY(depth);

  useFrame((_, delta) => {
    const instanced = tiles.current;
    if (instanced) {
      for (let index = 0; index < clip; index++) {
        instanced.setMatrixAt(index, matrices[index]);
        instanced.setColorAt(
          index,
          scratch.copy(coveredFrames.has(index) ? lit : pale),
        );
      }
      instanced.instanceMatrix.needsUpdate = true;
      if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
    }

    // One activation climbing the cone, so the direction of the read is legible.
    if (pulse.current) {
      time.current = (time.current + delta / 2.6) % 1.4;
      const t = reduced ? 1 : Math.min(1, time.current);
      pulse.current.position.y = FRAME_Y + (topY - FRAME_Y) * t;
    }
  });

  return (
    <group rotation={[0.06, -0.12, 0]} scale={scale}>
      <instancedMesh
        ref={tiles}
        args={[undefined, undefined, clip]}
        onPointerMove={(event) => {
          event.stopPropagation();
          const index = event.instanceId;
          if (index === undefined) return;
          hover.show(
            `frame ${index + 1} of ${clip} · ${
              coveredFrames.has(index)
                ? "inside the receptive field at this depth"
                : "outside it -- this unit never sees this frame"
            }`,
            event,
          );
        }}
        onPointerOut={hover.hide}
      >
        <boxGeometry args={[step * 0.62, 1, 1]} />
        <meshStandardMaterial roughness={0.5} metalness={0.05} />
      </instancedMesh>

      {edges.map((line) => (
        <Edge key={line.key} from={line.from} to={line.to} color={edge} />
      ))}

      {blocks.map((block, index) => {
        const level = index + 1;
        const active = level <= depth;
        const units = new Set(layers[level] ?? []);
        return (
          <group key={block.name}>
            {Array.from({ length: clip }, (_, unit) => {
              const inCone = active && units.has(unit);
              return (
                <mesh
                  key={unit}
                  position={[x(unit), layerY(level), 0]}
                  onPointerMove={(event) => {
                    event.stopPropagation();
                    hover.show(
                      `${block.name} · dilation ${block.dilation}, ${
                        block.kernel ?? 3
                      } taps · ${
                        inCone
                          ? "feeds the selected unit"
                          : "outside the selected unit's cone"
                      }`,
                      event,
                    );
                  }}
                  onPointerOut={hover.hide}
                >
                  <sphereGeometry args={[inCone ? 0.15 : 0.09, 14, 14]} />
                  <meshStandardMaterial
                    color={inCone ? lit : pale}
                    roughness={0.45}
                    metalness={0.05}
                    transparent
                    opacity={active ? 1 : 0.5}
                  />
                </mesh>
              );
            })}
          </group>
        );
      })}

      <mesh
        ref={pulse}
        position={[x(Math.floor((clip - 1) / 2)), FRAME_Y, 0.42]}
        onPointerMove={(event) => {
          event.stopPropagation();
          hover.show(
            "one activation climbing the stack · every level widens what it has seen",
            event,
          );
        }}
        onPointerOut={hover.hide}
      >
        <sphereGeometry args={[0.11, 16, 16]} />
        <meshBasicMaterial color={edge} />
      </mesh>
    </group>
  );
}

/** One tap, drawn as a thin rod. Every point is in the XY plane, so the
 * rotation is a single angle rather than a quaternion. */
function Edge({
  from,
  to,
  color,
}: {
  from: THREE.Vector2;
  to: THREE.Vector2;
  color: THREE.Color;
}) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);

  return (
    <mesh
      position={[from.x + dx / 2, from.y + dy / 2, 0]}
      rotation={[0, 0, Math.atan2(dy, dx) - Math.PI / 2]}
    >
      <cylinderGeometry args={[0.022, 0.022, length, 6]} />
      <meshStandardMaterial
        color={color}
        roughness={0.6}
        transparent
        opacity={0.75}
      />
    </mesh>
  );
}
