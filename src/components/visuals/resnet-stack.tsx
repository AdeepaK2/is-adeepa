"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import {
  ControlGroup,
  ControlRow,
  Readout,
  SegmentedControl,
  WebGLFallback,
} from "./controls";
import { SceneCanvas, useFitScale } from "./scene-canvas";

export interface Stage {
  name: string;
  /** Filters in the stage. Drives how thick its slab is drawn. */
  channels: number;
}

type Source = "scratch" | "kinetics" | "kineticsMit";

export interface ResnetStackProps {
  hue?: number;
  /** Convolution stages, input first. Defaults to 3D ResNet-18's five. */
  stages?: Stage[];
  /** Accuracy per pre-training source with nothing frozen. */
  sources?: Partial<Record<Source, number>>;
  /**
   * Accuracy by number of frozen stages. Papers usually measure this for one
   * pre-training source only; `freezeSource` says which.
   */
  freeze?: { layers: number; accuracy: number }[];
  freezeSource?: Source;
}

const DEFAULT_STAGES: Stage[] = [
  { name: "conv1", channels: 64 },
  { name: "conv2", channels: 64 },
  { name: "conv3", channels: 128 },
  { name: "conv4", channels: 256 },
  { name: "conv5", channels: 512 },
];

/**
 * The backbone as a stack of convolution stages, with two travelling pulses:
 * data going forward, and gradients coming back.
 *
 * Freezing a stage is easy to describe and easy to misjudge, so it is shown as
 * what it physically is -- the backward pulse stops dead at the frozen block,
 * which never updates again. Set against the accuracy readout, the paper's
 * result that freezing *costs* accuracy stops being surprising.
 */
export function ResnetStack({
  hue = 210,
  stages = DEFAULT_STAGES,
  sources = {},
  freeze = [],
  freezeSource = "kineticsMit",
}: ResnetStackProps) {
  const accent = `hsl(${hue} 78% 62%)`;
  const [source, setSource] = useState<Source>(freezeSource);
  const [frozen, setFrozen] = useState(0);

  // Freezing is only meaningful with pre-trained weights, and papers measure it
  // for a single source, so every other combination is honestly unmeasured.
  const accuracy =
    frozen === 0
      ? sources[source]
      : source === freezeSource
        ? freeze.find((row) => row.layers === frozen)?.accuracy
        : undefined;

  const baseline = sources.scratch;

  const freezeOptions = [0, ...freeze.map((row) => row.layers)].filter(
    (layers, index, all) => all.indexOf(layers) === index,
  );

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <SceneCanvas camera={[0.4, 1.9, 7.2]} fov={40} fallback={<WebGLFallback />}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 5, 6]} intensity={1.05} />
          <Backbone stages={stages} frozen={frozen} hue={hue} />
        </SceneCanvas>
      </div>

      <ControlRow>
        <SegmentedControl<Source>
          label="Pre-trained on"
          value={source}
          onChange={setSource}
          accent={accent}
          options={[
            { value: "scratch", label: "scratch", title: "Random initial weights" },
            { value: "kinetics", label: "K", title: "Kinetics" },
            { value: "kineticsMit", label: "K+M", title: "Kinetics + Moments in Time" },
          ]}
        />

        <SegmentedControl<string>
          label="Frozen stages"
          value={String(frozen)}
          onChange={(value) => setFrozen(Number(value))}
          accent={accent}
          options={freezeOptions.map((layers) => ({
            value: String(layers),
            label: String(layers),
            title:
              layers === 0
                ? "Every stage keeps training"
                : `The first ${layers} stage${layers > 1 ? "s" : ""} never update`,
          }))}
        />

        <ControlGroup label="Stages">
          <div className="flex flex-wrap gap-1">
            {stages.map((stage, index) => {
              const isFrozen = index < frozen;
              return (
                <span
                  key={stage.name}
                  className={cn(
                    "rounded-md px-2 py-1 font-mono text-[11px]",
                    isFrozen
                      ? "bg-raised text-ink-faint line-through"
                      : "bg-raised text-ink-muted",
                  )}
                  title={isFrozen ? "frozen -- no gradient reaches it" : "trainable"}
                >
                  {stage.name}
                </span>
              );
            })}
          </div>
        </ControlGroup>

        <Readout
          label="Validation accuracy"
          value={accuracy}
          accent={accent}
          delta={
            accuracy !== undefined && baseline !== undefined
              ? accuracy - baseline
              : undefined
          }
          deltaLabel="vs scratch"
        />
      </ControlRow>
    </div>
  );
}

const GAP = 0.5;

function Backbone({
  stages,
  frozen,
  hue,
}: {
  stages: Stage[];
  frozen: number;
  hue: number;
}) {
  const forward = useRef<THREE.Mesh>(null);
  const backward = useRef<THREE.Mesh>(null);
  const reduced = useReducedMotion();

  // Channels grow while the spatial map shrinks -- the usual CNN silhouette.
  const layout = useMemo(() => {
    const maxChannels = Math.max(...stages.map((stage) => stage.channels));
    const boxes = stages.map((stage, index) => ({
      cross: 2.5 * Math.pow(0.7, index),
      thickness: 0.3 + (stage.channels / maxChannels) * 0.9,
    }));
    const total =
      boxes.reduce((sum, box) => sum + box.thickness, 0) + GAP * (boxes.length - 1);

    const placed: {
      cross: number;
      thickness: number;
      x: number;
      // Built once here rather than per render, since a frozen stage's outline
      // would otherwise allocate a fresh geometry every time the scene updates.
      outline: THREE.EdgesGeometry;
    }[] = [];
    let cursor = -total / 2;
    for (const box of boxes) {
      placed.push({
        ...box,
        x: cursor + box.thickness / 2,
        outline: new THREE.EdgesGeometry(
          new THREE.BoxGeometry(box.thickness + 0.08, box.cross + 0.08, box.cross + 0.08),
        ),
      });
      cursor += box.thickness + GAP;
    }

    return { placed, left: -total / 2, right: total / 2, width: total };
  }, [stages]);

  const liveColor = useMemo(() => new THREE.Color(`hsl(${hue}, 70%, 55%)`), [hue]);
  const frozenColor = useMemo(() => new THREE.Color(`hsl(${hue}, 8%, 34%)`), [hue]);
  const pulseColor = useMemo(() => new THREE.Color(`hsl(${hue}, 95%, 74%)`), [hue]);

  // Gradients flow back only as far as the first stage that still trains.
  const gradientStop =
    frozen > 0 && frozen <= layout.placed.length
      ? layout.placed[frozen - 1].x + layout.placed[frozen - 1].thickness / 2
      : layout.left;

  useFrame(({ clock }) => {
    const t = reduced ? 0.5 : (clock.getElapsedTime() * 0.35) % 1;
    if (forward.current) {
      forward.current.position.x = layout.left + (layout.right - layout.left) * t;
    }
    if (backward.current) {
      backward.current.position.x = layout.right - (layout.right - gradientStop) * t;
    }
  });

  // Leaves room for the two pulse tracks sitting above and below the stack.
  const scale = useFitScale(layout.width + 1.5, 4.6);

  return (
    <group rotation={[0.12, -0.5, 0]} scale={scale}>
      {layout.placed.map((box, index) => {
        const isFrozen = index < frozen;
        return (
          <group key={stages[index].name} position={[box.x, 0, 0]}>
            <mesh>
              <boxGeometry args={[box.thickness, box.cross, box.cross]} />
              <meshStandardMaterial
                color={isFrozen ? frozenColor : liveColor}
                roughness={isFrozen ? 0.85 : 0.4}
                metalness={0.1}
                transparent
                opacity={isFrozen ? 0.65 : 0.92}
              />
            </mesh>
            {isFrozen && (
              <lineSegments geometry={box.outline}>
                <lineBasicMaterial color="#848a94" />
              </lineSegments>
            )}
          </group>
        );
      })}

      {/* Data going forward, always the full depth of the network. */}
      <mesh ref={forward} position={[layout.left, 1.9, 0]}>
        <sphereGeometry args={[0.13, 16, 16]} />
        <meshBasicMaterial color={pulseColor} />
      </mesh>

      {/* Gradients coming back, halted by whatever is frozen. */}
      <mesh ref={backward} position={[layout.right, -1.9, 0]}>
        <sphereGeometry args={[0.13, 16, 16]} />
        <meshBasicMaterial color={frozen > 0 ? "#fb7185" : pulseColor} />
      </mesh>
    </group>
  );
}
