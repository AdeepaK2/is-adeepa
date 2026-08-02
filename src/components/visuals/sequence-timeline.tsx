"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { seededRandom } from "@/lib/random";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import {
  ControlRow,
  RangeWindow,
  Readout,
  SegmentedControl,
  WebGLFallback,
} from "./controls";
import { SceneCanvas, useFitScale } from "./scene-canvas";

/** Accuracies measured for one configuration, per pre-training source. */
export interface MeasuredAccuracy {
  scratch?: number;
  kinetics?: number;
  kineticsMit?: number;
}

/** A contiguous window of the clip, e.g. the `49-149` row of a results table. */
export interface RangeRow extends MeasuredAccuracy {
  start: number;
  end: number;
}

/** A configuration described only by how many frames it samples. */
export interface CountRow extends MeasuredAccuracy {
  frames: number;
}

type Strategy = "random" | "custom" | "videowise";
type Pretrained = keyof MeasuredAccuracy;

export interface SequenceTimelineProps {
  /** Frames extracted per clip. The paper gets 149 from a 5s/30fps video. */
  totalFrames?: number;
  hue?: number;
  /** Random spatiotemporal crop: N consecutive frames from a random start. */
  random?: CountRow[];
  /** Custom spatiotemporal crop: a fixed start/end window. */
  custom?: RangeRow[];
  /** Video-wise random crop: N frames scattered across the whole clip. */
  videowise?: CountRow[];
}

/**
 * The clip as a filmstrip of frames, with the sampled ones lit.
 *
 * This is the visual for the finding that sampling strategy is a real
 * hyperparameter: which frames a model is fed, and whether they are
 * consecutive, moves accuracy by several points -- often more than feeding it
 * more frames does.
 *
 * Accuracies come from the module data, and only the configurations a paper
 * actually ran have one. Anything else reports itself as unmeasured.
 */
export function SequenceTimeline({
  totalFrames = 149,
  hue = 210,
  random = [],
  custom = [],
  videowise = [],
}: SequenceTimelineProps) {
  const accent = `hsl(${hue} 78% 62%)`;

  const [strategy, setStrategy] = useState<Strategy>("custom");
  const [pretrained, setPretrained] = useState<Pretrained>("kineticsMit");
  const [range, setRange] = useState(() => pickDefaultRange(custom, totalFrames));
  const [randomCount, setRandomCount] = useState(() => random[0]?.frames ?? 50);
  const [scatterCount, setScatterCount] = useState(() => videowise[0]?.frames ?? 50);

  const selected = useMemo(() => {
    if (strategy === "custom") return contiguous(range.start, range.end, totalFrames);
    if (strategy === "random") {
      // A random start, but consecutive from there -- the crop's whole point.
      const start = Math.round((totalFrames - randomCount) * 0.33);
      return contiguous(start, start + randomCount, totalFrames);
    }
    return scatter(scatterCount, totalFrames);
  }, [strategy, range, randomCount, scatterCount, totalFrames]);

  const accuracy = (() => {
    if (strategy === "custom") {
      return custom.find((row) => row.start === range.start && row.end === range.end)?.[
        pretrained
      ];
    }
    const rows = strategy === "random" ? random : videowise;
    const frames = strategy === "random" ? randomCount : scatterCount;
    return rows.find((row) => row.frames === frames)?.[pretrained];
  })();

  // "Use the whole clip" is the honest reference point for any cropping choice.
  const baseline = custom.find((row) => row.start === 0 && row.end === totalFrames)?.[
    pretrained
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <SceneCanvas camera={[0, 2.1, 7.6]} fov={40} fallback={<WebGLFallback />}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 6, 6]} intensity={1} />
          <Filmstrip total={totalFrames} selected={selected} hue={hue} />
        </SceneCanvas>
      </div>

      <ControlRow>
        <SegmentedControl<Strategy>
          label="Crop"
          value={strategy}
          onChange={setStrategy}
          accent={accent}
          options={[
            { value: "random", label: "random", title: "N consecutive frames from a random start" },
            { value: "custom", label: "custom", title: "A fixed start and end point" },
            { value: "videowise", label: "video-wise", title: "N frames scattered across the clip" },
          ]}
        />

        {strategy === "custom" ? (
          <RangeWindow
            label="Frames"
            total={totalFrames}
            start={range.start}
            end={range.end}
            onChange={setRange}
            presets={custom}
            accent={accent}
          />
        ) : (
          <SegmentedControl<string>
            label="Frames"
            value={String(strategy === "random" ? randomCount : scatterCount)}
            onChange={(value) =>
              strategy === "random"
                ? setRandomCount(Number(value))
                : setScatterCount(Number(value))
            }
            accent={accent}
            options={(strategy === "random" ? random : videowise).map((row) => ({
              value: String(row.frames),
              label: String(row.frames),
            }))}
          />
        )}

        <SegmentedControl<Pretrained>
          label="Pre-trained on"
          value={pretrained}
          onChange={setPretrained}
          accent={accent}
          options={[
            { value: "scratch", label: "scratch", title: "No pre-training" },
            { value: "kinetics", label: "K", title: "Kinetics" },
            { value: "kineticsMit", label: "K+M", title: "Kinetics + Moments in Time" },
          ]}
        />

        <Readout
          label="Validation accuracy"
          value={accuracy}
          accent={accent}
          delta={
            accuracy !== undefined && baseline !== undefined
              ? accuracy - baseline
              : undefined
          }
          deltaLabel={`vs all ${totalFrames}`}
        />
      </ControlRow>
    </div>
  );
}

function pickDefaultRange(custom: RangeRow[], totalFrames: number) {
  // The paper's best window, when it is present -- otherwise the whole clip.
  const best = custom.reduce<RangeRow | undefined>((winner, row) => {
    const score = row.kineticsMit ?? row.kinetics ?? row.scratch ?? -1;
    const leader = winner
      ? (winner.kineticsMit ?? winner.kinetics ?? winner.scratch ?? -1)
      : -1;
    return score > leader ? row : winner;
  }, undefined);
  return { start: best?.start ?? 0, end: best?.end ?? totalFrames };
}

function contiguous(start: number, end: number, total: number) {
  const selected = new Set<number>();
  for (let i = Math.max(0, start); i < Math.min(end, total); i++) selected.add(i);
  return selected;
}

/** N frames spread across the whole clip, sampled deterministically. */
function scatter(count: number, total: number) {
  const random = seededRandom(count * 977 + total);
  const selected = new Set<number>();
  let guard = 0;
  while (selected.size < Math.min(count, total) && guard < total * 20) {
    selected.add(Math.floor(random() * total));
    guard++;
  }
  return selected;
}

const STRIP_LENGTH = 9;

function Filmstrip({
  total,
  selected,
  hue,
}: {
  total: number;
  selected: Set<number>;
  hue: number;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const group = useRef<THREE.Group>(null);
  const reduced = useReducedMotion();

  const matrices = useMemo(() => {
    const step = STRIP_LENGTH / Math.max(total - 1, 1);
    const dummy = new THREE.Object3D();
    return Array.from({ length: total }, (_, i) => {
      dummy.position.set(i * step - STRIP_LENGTH / 2, 0, 0);
      dummy.updateMatrix();
      return dummy.matrix.clone();
    });
  }, [total]);

  const dimColor = useMemo(() => new THREE.Color(`hsl(${hue}, 22%, 26%)`), [hue]);
  const litColor = useMemo(() => new THREE.Color(`hsl(${hue}, 92%, 68%)`), [hue]);

  // The strip is wide; shrink it rather than letting the ends fall out of frame.
  const scale = useFitScale(STRIP_LENGTH * 1.15, 3.4);

  useFrame(({ clock }) => {
    const instanced = mesh.current;
    if (!instanced) return;

    for (let i = 0; i < total; i++) {
      instanced.setMatrixAt(i, matrices[i]);
      instanced.setColorAt(i, selected.has(i) ? litColor : dimColor);
    }
    instanced.instanceMatrix.needsUpdate = true;
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;

    if (group.current) {
      group.current.rotation.y = reduced
        ? -0.42
        : -0.42 + Math.sin(clock.getElapsedTime() * 0.2) * 0.12;
    }
  });

  return (
    <group ref={group} rotation={[0, -0.42, 0]} scale={scale}>
      <instancedMesh ref={mesh} args={[undefined, undefined, total]}>
        <boxGeometry args={[STRIP_LENGTH / total / 1.6, 1.9, 2.6]} />
        <meshStandardMaterial roughness={0.5} metalness={0.05} />
      </instancedMesh>
    </group>
  );
}
