"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { hueColor } from "@/lib/utils";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { ControlRow, Readout, SegmentedControl, WebGLFallback } from "./controls";
import { HoverFrame, useSceneHover, type SceneHover } from "./hover";
import { SceneCanvas, useFitScale } from "./scene-canvas";

/**
 * One behaviour the trained generator is shown, and whether it can redraw it.
 *
 * `reconstructs` is the whole mechanism: a one-class model is trained until it
 * can reproduce normal behaviour, so a class it has never seen comes back as
 * noise. Papers in this family almost never publish a similarity distribution,
 * only the picture, so `similarity` is optional and reads as unmeasured.
 */
export interface ReconstructionCase {
  id: string;
  label: string;
  /** Whether the generator reproduces the target. Drives how the output draws. */
  reconstructs: boolean;
  /** Similarity between real and generated, 0-100. Omit if never published. */
  similarity?: number;
  /** Shown as the segmented control's tooltip. */
  note?: string;
}

/** One dataset's decision threshold on the similarity metric. */
export interface ThresholdRow {
  id: string;
  label: string;
  value: number;
  title?: string;
}

export interface ReconstructionGapProps {
  hue?: number;
  /** Encoder blocks, mirrored on the decoder side. The U-Net's depth. */
  depth?: number;
  cases?: ReconstructionCase[];
  /** Per-dataset cut-off, selectable. Drawn as a marker on the gap. */
  thresholds?: ThresholdRow[];
  labels?: {
    input?: string;
    generator?: string;
    generated?: string;
    real?: string;
  };
  copy?: {
    /** Readout heading. Default "Cut-off similarity". */
    readout?: string;
    /** Sentence under the controls, per case id. */
    lines?: Record<string, string>;
    /** Heading on the case control. Default "Behaviour". */
    caseLabel?: string;
    /** Heading on the threshold control. Default "Dataset". */
    thresholdLabel?: string;
  };
}

/**
 * A one-class generative detector: something goes in, a posture comes out, and
 * the gap between that and the real frame is the decision.
 *
 * Built because the two-stream visual was wrong for this family. There are no
 * parallel lanes here and nothing merges -- it is one sequential pipeline, and
 * the informative moment is at the far end, where the generated frame either
 * matches the real one or does not. Drawing it as two converging streams
 * implied an architecture the papers do not have.
 *
 * The generator is drawn as its actual shape rather than a box: an encoder
 * narrowing to a bottleneck, a decoder widening back, and the skip connections
 * arcing over the top. That silhouette is what distinguishes a U-Net from the
 * autoencoders these papers are usually measured against, and it is the reason
 * the reconstruction is sharp enough for the gap to mean anything.
 */
export function ReconstructionGap({
  hue = 280,
  depth = 8,
  cases = [],
  thresholds = [],
  labels,
  copy,
}: ReconstructionGapProps) {
  const accent = hueColor(hue);
  const { frame, hover, hovered } = useSceneHover();

  const [caseId, setCaseId] = useState(() => cases[0]?.id ?? "");
  const [thresholdId, setThresholdId] = useState(() => thresholds[0]?.id ?? "");

  const active = cases.find((row) => row.id === caseId) ?? cases[0];
  const threshold =
    thresholds.find((row) => row.id === thresholdId) ?? thresholds[0];

  const text = active ? copy?.lines?.[active.id] : undefined;

  return (
    <div className="flex h-full flex-col">
      <HoverFrame frame={frame} hovered={hovered}>
        <SceneCanvas
          camera={[0.2, 1.4, 8.6]}
          fov={42}
          fallback={<WebGLFallback />}
          orbit
        >
          <ambientLight intensity={0.62} />
          <directionalLight position={[3, 6, 5]} intensity={1} />
          <Pipeline
            hue={hue}
            depth={depth}
            reconstructs={active?.reconstructs ?? true}
            caseLabel={active?.label ?? "input"}
            labels={labels}
            hover={hover}
          />
        </SceneCanvas>
      </HoverFrame>

      <ControlRow>
        <SegmentedControl<string>
          label={copy?.caseLabel ?? "Behaviour"}
          value={active?.id ?? ""}
          onChange={setCaseId}
          accent={accent}
          options={cases.map((row) => ({
            value: row.id,
            label: row.label,
            title: row.note,
          }))}
        />

        {text && (
          <p className="text-ink-faint max-w-xs text-xs leading-relaxed">{text}</p>
        )}

        {thresholds.length > 0 && (
          <SegmentedControl<string>
            label={copy?.thresholdLabel ?? "Dataset"}
            value={threshold?.id ?? ""}
            onChange={setThresholdId}
            accent={accent}
            options={thresholds.map((row) => ({
              value: row.id,
              label: row.label,
              title: row.title,
            }))}
          />
        )}

        <Readout
          label={copy?.readout ?? "Cut-off similarity"}
          value={active?.similarity ?? threshold?.value}
          accent={accent}
          unmeasuredNote="not measured in the paper"
        />
      </ControlRow>
    </div>
  );
}

/**
 * Deterministic pseudo-noise in [0, 1) from an index.
 *
 * Pure rather than a seeded closure, so the failed reconstruction looks the same
 * on every render without anything being reassigned after one completes.
 */
function noise(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const IN_X = -3.9;
const ENC_START = -2.9;
const STEP = 0.3;
const OUT_X = 3.5;
/** Where the generated and real frames sit, above and below the axis. */
const PAIR_Y = 1.05;

function Pipeline({
  hue,
  depth,
  reconstructs,
  caseLabel,
  labels,
  hover,
}: {
  hue: number;
  depth: number;
  reconstructs: boolean;
  caseLabel: string;
  labels?: ReconstructionGapProps["labels"];
  hover: SceneHover;
}) {
  const reduced = useReducedMotion();
  const pulse = useRef<THREE.Mesh>(null);

  // Light stage: an inactive or failed part must go pale, not dark.
  const palette = useMemo(
    () => ({
      lit: new THREE.Color(`hsl(${hue}, 85%, 42%)`),
      body: new THREE.Color(`hsl(${hue}, 58%, 52%)`),
      pale: new THREE.Color(`hsl(${hue}, 20%, 84%)`),
      alert: new THREE.Color("#be123c"),
      rail: new THREE.Color("#c6cbd3"),
    }),
    [hue],
  );

  const bottleneckX = ENC_START + (depth - 1) * STEP + STEP;
  const decoderEnd = bottleneckX + depth * STEP;
  const scale = useFitScale(Math.abs(IN_X) + OUT_X + 1.2, 4.4);

  useFrame(({ clock }) => {
    if (!pulse.current) return;
    const t = reduced ? 0.6 : (clock.getElapsedTime() * 0.32) % 1;
    pulse.current.position.x = IN_X + (decoderEnd - IN_X) * t;
  });

  /** Encoder heights taper to the bottleneck; the decoder mirrors them. */
  const heightAt = (index: number) => 1.05 - (index / depth) * 0.72;

  return (
    <group rotation={[0.06, -0.1, 0]} scale={scale}>
      {/* The differential-motion input: three thin channels, not a frame. */}
      <group
        position={[IN_X, 0, 0]}
        onPointerMove={(event) => {
          event.stopPropagation();
          hover.show(
            `${labels?.input ?? "motion input"} · 3 channels · the only thing the network receives`,
            event,
          );
        }}
        onPointerOut={hover.hide}
      >
        {[-0.16, 0, 0.16].map((z) => (
          <mesh key={z} position={[0, 0, z]}>
            <boxGeometry args={[0.07, 1, 0.9]} />
            <meshStandardMaterial
              color={palette.body}
              roughness={0.5}
              transparent
              opacity={0.85}
            />
          </mesh>
        ))}
      </group>

      {/* Rail from input to the first encoder block. */}
      <mesh position={[(IN_X + ENC_START) / 2, 0, 0]}>
        <boxGeometry args={[ENC_START - IN_X, 0.03, 0.03]} />
        <meshBasicMaterial color={palette.rail} />
      </mesh>

      {/* Encoder: narrowing toward the bottleneck. */}
      {Array.from({ length: depth }, (_, i) => (
        <mesh
          key={`enc-${i}`}
          position={[ENC_START + i * STEP, 0, 0]}
          onPointerMove={(event) => {
            event.stopPropagation();
            hover.show(
              `${labels?.generator ?? "generator"} · encoder layer ${i + 1} of ${depth} · downsampling`,
              event,
            );
          }}
          onPointerOut={hover.hide}
        >
          <boxGeometry args={[0.17, heightAt(i), heightAt(i)]} />
          <meshStandardMaterial color={palette.body} roughness={0.45} metalness={0.1} />
        </mesh>
      ))}

      {/* Bottleneck. */}
      <mesh
        position={[bottleneckX, 0, 0]}
        onPointerMove={(event) => {
          event.stopPropagation();
          hover.show("bottleneck · the motion compressed to its smallest form", event);
        }}
        onPointerOut={hover.hide}
      >
        <boxGeometry args={[0.2, 0.28, 0.28]} />
        <meshStandardMaterial color={palette.lit} roughness={0.3} metalness={0.2} />
      </mesh>

      {/* Decoder: widening back toward a posture. */}
      {Array.from({ length: depth }, (_, i) => {
        const h = heightAt(depth - 1 - i);
        return (
          <mesh
            key={`dec-${i}`}
            position={[bottleneckX + (i + 1) * STEP, 0, 0]}
            onPointerMove={(event) => {
              event.stopPropagation();
              hover.show(
                `${labels?.generator ?? "generator"} · decoder layer ${i + 1} of ${depth} · upsampling`,
                event,
              );
            }}
            onPointerOut={hover.hide}
          >
            <boxGeometry args={[0.17, h, h]} />
            <meshStandardMaterial color={palette.body} roughness={0.45} metalness={0.1} />
          </mesh>
        );
      })}

      {/* Skip connections, arcing encoder i to its mirrored decoder block. */}
      {Array.from({ length: depth }, (_, i) => {
        const from = ENC_START + i * STEP;
        const to = bottleneckX + (depth - i) * STEP;
        const lift = 0.75 + (depth - i) * 0.075;
        return (
          <mesh
            key={`skip-${i}`}
            position={[(from + to) / 2, lift, 0]}
            onPointerMove={(event) => {
              event.stopPropagation();
              hover.show(
                `skip connection · encoder layer ${i + 1} passed straight to the matching decoder layer`,
                event,
              );
            }}
            onPointerOut={hover.hide}
          >
            <boxGeometry args={[to - from, 0.025, 0.025]} />
            <meshBasicMaterial color={palette.pale} />
          </mesh>
        );
      })}

      {/* Travelling pulse: motion entering, a posture leaving. */}
      <mesh ref={pulse} position={[IN_X, 0, 0]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color={palette.lit} />
      </mesh>

      {/* Rails splitting to the generated / real pair. */}
      {[PAIR_Y, -PAIR_Y].map((y) => {
        const dx = OUT_X - decoderEnd;
        return (
          <mesh
            key={y}
            position={[(decoderEnd + OUT_X) / 2, y / 2, 0]}
            rotation={[0, 0, Math.atan2(y, dx)]}
          >
            <boxGeometry args={[Math.hypot(dx, y), 0.025, 0.025]} />
            <meshBasicMaterial color={palette.rail} />
          </mesh>
        );
      })}

      <Reconstructed
        x={OUT_X}
        y={PAIR_Y}
        reconstructs={reconstructs}
        palette={palette}
        label={`${labels?.generated ?? "generated posture"} · ${caseLabel} · ${
          reconstructs
            ? "redrawn cleanly, because this is what the model was trained on"
            : "meaningless pixels, because the model has never seen this"
        }`}
        hover={hover}
      />

      {/* The real frame: always intact, the thing the output is compared to. */}
      <mesh
        position={[OUT_X, -PAIR_Y, 0]}
        onPointerMove={(event) => {
          event.stopPropagation();
          hover.show(
            `${labels?.real ?? "real posture"} · the actual frame, unchanged`,
            event,
          );
        }}
        onPointerOut={hover.hide}
      >
        <boxGeometry args={[0.16, 0.86, 0.86]} />
        <meshStandardMaterial color={palette.body} roughness={0.45} metalness={0.1} />
      </mesh>

      {/* The gap being measured -- green when the two match, red when they do not. */}
      <mesh
        position={[OUT_X, 0, 0]}
        onPointerMove={(event) => {
          event.stopPropagation();
          hover.show(
            reconstructs
              ? "small gap · the two frames match, so the behaviour reads as normal"
              : "large gap · the frames disagree, and that disagreement is the detection",
            event,
          );
        }}
        onPointerOut={hover.hide}
      >
        <boxGeometry args={[0.06, PAIR_Y * 2 - 0.86, 0.06]} />
        <meshStandardMaterial
          color={reconstructs ? palette.lit : palette.alert}
          roughness={0.4}
        />
      </mesh>
    </group>
  );
}

/**
 * The generator's output.
 *
 * Solid when the model can redraw the behaviour, and a scatter of disconnected
 * cells inside a pale shell when it cannot -- which is what these papers show
 * qualitatively and label "meaningless".
 */
function Reconstructed({
  x,
  y,
  reconstructs,
  palette,
  label,
  hover,
}: {
  x: number;
  y: number;
  reconstructs: boolean;
  palette: { lit: THREE.Color; body: THREE.Color; pale: THREE.Color };
  label: string;
  hover: SceneHover;
}) {
  const cells = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        y: (noise(i * 3) - 0.5) * 0.74,
        z: (noise(i * 3 + 1) - 0.5) * 0.74,
        size: 0.06 + noise(i * 3 + 2) * 0.1,
      })),
    [],
  );

  const handlers = {
    onPointerMove: (event: {
      stopPropagation: () => void;
      clientX: number;
      clientY: number;
    }) => {
      event.stopPropagation();
      hover.show(label, event);
    },
    onPointerOut: hover.hide,
  };

  if (reconstructs) {
    return (
      <mesh position={[x, y, 0]} {...handlers}>
        <boxGeometry args={[0.16, 0.86, 0.86]} />
        <meshStandardMaterial color={palette.body} roughness={0.45} metalness={0.1} />
      </mesh>
    );
  }

  return (
    <group position={[x, y, 0]} {...handlers}>
      <mesh>
        <boxGeometry args={[0.16, 0.86, 0.86]} />
        <meshStandardMaterial
          color={palette.pale}
          roughness={0.6}
          transparent
          opacity={0.3}
        />
      </mesh>
      {cells.map((cell, index) => (
        <mesh key={index} position={[0, cell.y, cell.z]}>
          <boxGeometry args={[0.2, cell.size, cell.size]} />
          <meshStandardMaterial color={palette.body} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}
