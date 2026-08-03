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

/** One stage of a model, drawn as a block along its lane. */
export interface LineupBlock {
  label: string;
  /** Weight count. `0` for a stage that holds no learned weights. */
  params: number;
  /** Frozen blocks are drawn pale and outlined; trained blocks solid. */
  trained: boolean;
  note?: string;
}

/**
 * What a paper reports for one model on one dataset. Omit what it does not.
 *
 * Papers split into two camps here: those that break accuracy into sensitivity
 * and specificity, and those that publish a single accuracy figure. Outcome mode
 * draws whichever it is given rather than requiring the richer form, because
 * accuracy-only reporting is itself one of the findings this review tracks.
 */
export interface ModelMetrics {
  sensitivity?: number;
  specificity?: number;
  accuracy?: number;
  /** Standard deviation across folds, drawn as a whisker on an accuracy bar. */
  accuracySd?: number;
  specificitySd?: number;
}

export interface LineupModel {
  id: string;
  label: string;
  /** Stages, input first. Used by `architecture` mode. */
  blocks?: LineupBlock[];
  /** Metrics keyed by dataset id. Used by `outcome` mode. */
  metrics?: Record<string, ModelMetrics>;
  /** Shown instead of a parameter count when the model trains no deep weights. */
  emptyNote?: string;
}

export interface LineupDataset {
  id: string;
  label: string;
  title?: string;
  /** Accuracy of always predicting the majority class, drawn as a marker. */
  floor?: number;
  floorLabel?: string;
}

export interface ModelLineupProps {
  hue?: number;
  /**
   * `architecture` compares what each model is made of and what actually
   * trains. `outcome` compares what they scored, one lane per model.
   */
  mode?: "architecture" | "outcome";
  models?: LineupModel[];
  datasets?: LineupDataset[];
  /** Model the outcome readout measures its delta against. */
  baselineId?: string;
  /** What the outcome readout calls its number. */
  metricLabel?: string;
  /**
   * What the outcome chip row is choosing between. Usually datasets, but the
   * same axis serves anything a paper reports the whole lineup across -- a
   * prediction granularity, an input length.
   */
  datasetLabel?: string;
}

/** Whether a paper broke this result into the two rates, or reported one figure. */
function hasRates(metrics?: ModelMetrics): boolean {
  return (
    metrics?.sensitivity !== undefined || metrics?.specificity !== undefined
  );
}

/**
 * Several models side by side, one lane each.
 *
 * Papers that compare architectures print the comparison as a table, which
 * flattens two things worth seeing. In `architecture` mode the blocks are scaled
 * by weight count, so a model whose name advertises a recurrent layer but whose
 * mass sits in one dense layer looks like what it is. In `outcome` mode the two
 * bars per lane are sensitivity and specificity, with the distance between them
 * drawn in red -- on a dataset built to provoke false positives, that gap is the
 * result, and a single accuracy column hides it.
 *
 * Bars run from a true zero, because the interesting failures here are models
 * that score 0% specificity and a truncated axis would flatter them.
 *
 * A paper that publishes accuracy alone gets one bar per lane instead of two,
 * with a whisker for the fold-to-fold spread. That asymmetry is deliberate: put
 * the two kinds of paper side by side and the missing second bar is visible.
 */
export function ModelLineup({
  hue = 170,
  mode = "architecture",
  models = [],
  datasets = [],
  baselineId,
  metricLabel = "Mean accuracy",
  datasetLabel = "Dataset",
}: ModelLineupProps) {
  const accent = hueColor(hue);
  const { frame, hover, hovered } = useSceneHover();

  const [modelId, setModelId] = useState(() => models[0]?.id ?? "");
  const [datasetId, setDatasetId] = useState(() => datasets[0]?.id ?? "");

  const active = models.find((model) => model.id === modelId) ?? models[0];
  const dataset = datasets.find((row) => row.id === datasetId) ?? datasets[0];
  const activeIndex = Math.max(
    0,
    models.findIndex((model) => model.id === active?.id),
  );

  const metrics = dataset ? active?.metrics?.[dataset.id] : undefined;
  const baseline = dataset
    ? models.find((model) => model.id === baselineId)?.metrics?.[dataset.id]
    : undefined;
  const baselineLabel = models.find((model) => model.id === baselineId)?.label;

  const trainedParams = active?.blocks
    ?.filter((block) => block.trained)
    .reduce((sum, block) => sum + block.params, 0);

  // A model can be genuinely trainable-free -- a linear SVM read off frozen
  // features -- and `Readout` already has a state for "no number here".
  const trainedMillions =
    trainedParams === undefined || trainedParams === 0
      ? undefined
      : Number((trainedParams / 1e6).toFixed(2));

  const modelOptions = models.map((model, index) => ({
    value: model.id,
    label: `${pips(index)} ${model.label}`,
    title: model.label,
  }));

  return (
    <div className="flex h-full flex-col">
      <HoverFrame frame={frame} hovered={hovered}>
        <SceneCanvas
          camera={mode === "architecture" ? [0.6, 2.1, 8] : [0, 1.4, 8.4]}
          fov={40}
          fallback={<WebGLFallback />}
          orbit
        >
          <ambientLight intensity={0.65} />
          <directionalLight position={[3, 5, 6]} intensity={1.0} />
          {mode === "architecture" ? (
            <ArchitectureLanes
              models={models}
              activeIndex={activeIndex}
              hue={hue}
              hover={hover}
            />
          ) : (
            <OutcomeLanes
              models={models}
              activeIndex={activeIndex}
              dataset={dataset}
              hue={hue}
              hover={hover}
            />
          )}
        </SceneCanvas>
      </HoverFrame>

      <ControlRow>
        {mode === "outcome" && datasets.length > 1 && (
          <SegmentedControl<string>
            label={datasetLabel}
            value={dataset?.id ?? ""}
            onChange={setDatasetId}
            accent={accent}
            options={datasets.map((row) => ({
              value: row.id,
              label: row.label,
              title: row.title,
            }))}
          />
        )}

        <SegmentedControl<string>
          label="Model"
          value={active?.id ?? ""}
          onChange={setModelId}
          accent={accent}
          options={modelOptions}
        />

        {mode === "architecture" ? (
          <>
            <ControlGroup label="Stages">
              <div className="flex flex-wrap gap-1">
                {(active?.blocks ?? []).map((block) => (
                  <span
                    key={block.label}
                    className={cn(
                      "rounded-md px-2 py-1 font-mono text-[11px]",
                      block.trained
                        ? "bg-raised text-ink-muted"
                        : "bg-raised text-ink-faint line-through",
                    )}
                    title={
                      block.note ??
                      (block.trained
                        ? `${formatParams(block.params)}, trained here`
                        : `${formatParams(block.params)}, frozen -- reused as-is`)
                    }
                  >
                    {block.label}
                  </span>
                ))}
              </div>
            </ControlGroup>

            <Readout
              label="Trained parameters"
              value={trainedMillions}
              unit=" M"
              accent={accent}
              unmeasuredNote={active?.emptyNote ?? "no deep weights trained"}
            />
          </>
        ) : (
          <>
            {hasRates(metrics) ? (
              <ControlGroup label="Sensitivity / specificity">
                <p className="text-ink-muted font-mono text-[11px] tabular-nums">
                  {metrics?.sensitivity === undefined
                    ? "not reported"
                    : `${metrics.sensitivity.toFixed(2)}%`}
                  <span className="text-ink-faint"> / </span>
                  {metrics?.specificity === undefined
                    ? "not reported"
                    : `${metrics.specificity.toFixed(2)}%`}
                  {metrics?.sensitivity !== undefined &&
                    metrics?.specificity !== undefined && (
                      <span className="text-alert">
                        {"  gap "}
                        {(metrics.sensitivity - metrics.specificity).toFixed(2)}
                      </span>
                    )}
                </p>
              </ControlGroup>
            ) : (
              // Papers that publish one accuracy figure get one line. Saying the
              // two rates were never reported is the more useful thing to show.
              <ControlGroup label="False-positive behaviour">
                <p className="text-ink-faint font-mono text-[11px]">
                  {metrics?.accuracySd === undefined
                    ? "sensitivity and specificity not reported"
                    : `± ${metrics.accuracySd.toFixed(2)} across folds · rates not reported`}
                </p>
              </ControlGroup>
            )}

            <Readout
              label={metricLabel}
              value={metrics?.accuracy}
              accent={accent}
              delta={
                metrics?.accuracy !== undefined &&
                baseline?.accuracy !== undefined &&
                active?.id !== baselineId
                  ? metrics.accuracy - baseline.accuracy
                  : undefined
              }
              deltaLabel={baselineLabel ? `vs ${baselineLabel}` : undefined}
              unmeasuredNote="not reported in the paper"
            />
          </>
        )}
      </ControlRow>
    </div>
  );
}

const LANE_GAP = 1.2;
const BLOCK_GAP = 0.3;
const BLOCK_CROSS = 0.62;
const BAR_SPAN = 6.4;
const BAR_H = 0.3;
const BAR_D = 0.45;
const ROW_OFFSET = 0.21;

/**
 * Block length from a weight count.
 *
 * Log-scaled: the counts in a single lane span five orders of magnitude, so a
 * linear map would render everything but the largest block as a sliver. The
 * exact figure is in the hover label, where it cannot be misread off a length.
 */
function blockWidth(params: number): number {
  if (params <= 0) return 0.5;
  return 0.35 + Math.max(0, Math.log10(params) - 2) * 0.46;
}

function formatParams(params: number): string {
  if (params <= 0) return "no learned weights";
  if (params >= 1e6) return `${(params / 1e6).toFixed(2)} M parameters`;
  if (params >= 1e3) return `${(params / 1e3).toFixed(1)} K parameters`;
  return `${params} parameters`;
}

/** Font-free lane marker, matched by the chip labels in the control row. */
function pips(index: number): string {
  return "·".repeat(index + 1);
}

function laneY(index: number, count: number): number {
  return ((count - 1) / 2) * LANE_GAP - index * LANE_GAP;
}

function ArchitectureLanes({
  models,
  activeIndex,
  hue,
  hover,
}: {
  models: LineupModel[];
  activeIndex: number;
  hue: number;
  hover: SceneHover;
}) {
  const pulse = useRef<THREE.Mesh>(null);
  const reduced = useReducedMotion();

  const layout = useMemo(() => {
    const lanes = models.map((model) => {
      const blocks = model.blocks ?? [];
      const widths = blocks.map((block) => blockWidth(block.params));
      const span =
        widths.reduce((sum, width) => sum + width, 0) +
        BLOCK_GAP * Math.max(0, widths.length - 1);
      return { blocks, widths, span };
    });
    const widest = Math.max(1, ...lanes.map((lane) => lane.span));

    // Lanes are left-aligned rather than centred: the frozen backbone is the
    // shared prefix of two of them, and it only reads as shared if it starts in
    // the same place.
    const left = -widest / 2;
    const placed = lanes.map((lane) => {
      let cursor = left;
      const boxes = lane.blocks.map((block, index) => {
        const width = lane.widths[index];
        const x = cursor + width / 2;
        cursor += width + BLOCK_GAP;
        return {
          block,
          width,
          x,
          outline: new THREE.EdgesGeometry(
            new THREE.BoxGeometry(
              width + 0.06,
              BLOCK_CROSS + 0.06,
              BLOCK_CROSS + 0.06,
            ),
          ),
        };
      });
      return { boxes, span: lane.span };
    });

    return { placed, left, widest };
  }, [models]);

  const trainedColor = useMemo(
    () => new THREE.Color(`hsl(${hue}, 82%, 42%)`),
    [hue],
  );
  const frozenColor = useMemo(
    () => new THREE.Color(`hsl(${hue}, 18%, 84%)`),
    [hue],
  );
  const pulseColor = useMemo(
    () => new THREE.Color(`hsl(${hue}, 88%, 38%)`),
    [hue],
  );

  const activeLane = layout.placed[activeIndex];
  const activeSpan = activeLane?.span ?? layout.widest;
  const activeY = laneY(activeIndex, models.length);

  useFrame(({ clock }) => {
    if (!pulse.current) return;
    const t = reduced ? 0.5 : (clock.getElapsedTime() * 0.32) % 1;
    pulse.current.position.x = layout.left + activeSpan * t;
    pulse.current.position.y = activeY + 0.62;
  });

  const scale = useFitScale(layout.widest + 1.6, models.length * LANE_GAP + 1.8);

  return (
    <group rotation={[0.16, -0.42, 0]} scale={scale}>
      {layout.placed.map((lane, laneIndex) => {
        const model = models[laneIndex];
        const y = laneY(laneIndex, models.length);
        const dim = laneIndex !== activeIndex;
        return (
          <group key={model.id} position={[0, y, 0]}>
            <Pips
              count={laneIndex + 1}
              x={layout.left - 0.4}
              color={dim ? frozenColor : trainedColor}
            />
            {lane.boxes.map(({ block, width, x, outline }) => {
              const label = `${model.label} · ${block.label} · ${formatParams(
                block.params,
              )} · ${block.trained ? "trained" : "frozen, reused as-is"}`;
              return (
                <group key={block.label} position={[x, 0, 0]}>
                  <mesh
                    onPointerMove={(event) => {
                      event.stopPropagation();
                      hover.show(block.note ? `${label} · ${block.note}` : label, event);
                    }}
                    onPointerOut={hover.hide}
                  >
                    <boxGeometry args={[width, BLOCK_CROSS, BLOCK_CROSS]} />
                    <meshStandardMaterial
                      color={block.trained ? trainedColor : frozenColor}
                      roughness={block.trained ? 0.4 : 0.85}
                      metalness={0.1}
                      transparent
                      opacity={dim ? 0.42 : block.trained ? 0.94 : 0.7}
                    />
                  </mesh>
                  {!block.trained && (
                    <lineSegments geometry={outline}>
                      <lineBasicMaterial
                        color="#8b919b"
                        transparent
                        opacity={dim ? 0.35 : 1}
                      />
                    </lineSegments>
                  )}
                </group>
              );
            })}
          </group>
        );
      })}

      {/* Forward pass along whichever lane is selected. */}
      <mesh
        ref={pulse}
        position={[layout.left, activeY + 0.62, 0]}
        onPointerMove={(event) => {
          event.stopPropagation();
          hover.show(
            `forward pass · ${models[activeIndex]?.label ?? "selected model"}`,
            event,
          );
        }}
        onPointerOut={hover.hide}
      >
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshBasicMaterial color={pulseColor} />
      </mesh>
    </group>
  );
}

function OutcomeLanes({
  models,
  activeIndex,
  dataset,
  hue,
  hover,
}: {
  models: LineupModel[];
  activeIndex: number;
  dataset?: LineupDataset;
  hue: number;
  hover: SceneHover;
}) {
  const left = -BAR_SPAN / 2;
  const reduced = useReducedMotion();

  const sensColor = useMemo(
    () => new THREE.Color(`hsl(${hue}, 82%, 42%)`),
    [hue],
  );
  const specColor = useMemo(
    () => new THREE.Color(`hsl(${(hue + 48) % 360}, 68%, 46%)`),
    [hue],
  );
  const trackColor = useMemo(
    () => new THREE.Color(`hsl(${hue}, 18%, 86%)`),
    [hue],
  );

  const rows = models.map((model) => {
    const metrics = dataset ? model.metrics?.[dataset.id] : undefined;
    return {
      model,
      rates: hasRates(metrics),
      sensitivity: metrics?.sensitivity,
      specificity: metrics?.specificity,
      accuracy: metrics?.accuracy,
      accuracySd: metrics?.accuracySd,
    };
  });

  // Extra width on the left: the lane pips sit outside the bar span, and with
  // five lanes the fifth one reaches furthest out.
  const scale = useFitScale(BAR_SPAN + 3, models.length * LANE_GAP + 1.6);
  const floorX =
    dataset?.floor === undefined
      ? undefined
      : left + (dataset.floor / 100) * BAR_SPAN;

  return (
    <group rotation={[0.1, -0.16, 0]} scale={scale}>
      {rows.map((row, index) => {
        const y = laneY(index, models.length);
        const dim = index !== activeIndex;
        return (
          <group key={row.model.id} position={[0, y, 0]}>
            <Pips
              count={index + 1}
              x={left - 0.42}
              color={dim ? trackColor : sensColor}
            />

            {row.rates ? (
              <>
                <Track y={ROW_OFFSET} left={left} color={trackColor} />
                <Track y={-ROW_OFFSET} left={left} color={trackColor} />

                <Bar
                  value={row.sensitivity}
                  y={ROW_OFFSET}
                  left={left}
                  color={sensColor}
                  dim={dim}
                  reduced={reduced}
                  hover={hover}
                  label={`${row.model.label} · sensitivity ${format(
                    row.sensitivity,
                  )} · violent chunks caught`}
                />
                <Bar
                  value={row.specificity}
                  y={-ROW_OFFSET}
                  left={left}
                  color={specColor}
                  dim={dim}
                  reduced={reduced}
                  hover={hover}
                  label={`${row.model.label} · specificity ${format(
                    row.specificity,
                  )} · non-violent chunks left alone`}
                />

                {row.sensitivity !== undefined &&
                  row.specificity !== undefined &&
                  row.sensitivity > row.specificity && (
                    <Gap
                      from={row.specificity}
                      to={row.sensitivity}
                      y={-ROW_OFFSET}
                      left={left}
                      dim={dim}
                      reduced={reduced}
                      hover={hover}
                      label={`${row.model.label} · ${(
                        row.sensitivity - row.specificity
                      ).toFixed(2)} points of the recall on violent clips it does not match on non-violent`}
                    />
                  )}
              </>
            ) : (
              <>
                <Track y={0} left={left} color={trackColor} />
                <Bar
                  value={row.accuracy}
                  y={0}
                  left={left}
                  color={sensColor}
                  dim={dim}
                  reduced={reduced}
                  hover={hover}
                  label={`${row.model.label} · accuracy ${format(
                    row.accuracy,
                  )}${
                    row.accuracySd === undefined
                      ? ""
                      : ` ± ${row.accuracySd.toFixed(2)} across folds`
                  } · sensitivity and specificity not reported`}
                />
                {row.accuracy !== undefined && row.accuracySd !== undefined && (
                  <Whisker
                    centre={row.accuracy}
                    spread={row.accuracySd}
                    left={left}
                    dim={dim}
                    reduced={reduced}
                    hover={hover}
                    label={`${row.model.label} · ± ${row.accuracySd.toFixed(
                      2,
                    )} points across folds -- the spread the headline figure hides`}
                  />
                )}
              </>
            )}
          </group>
        );
      })}

      {floorX !== undefined && (
        <mesh
          position={[floorX, 0, 0]}
          onPointerMove={(event) => {
            event.stopPropagation();
            hover.show(
              `${dataset?.floorLabel ?? "always-positive baseline"} · ${dataset?.floor}% accuracy without learning anything`,
              event,
            );
          }}
          onPointerOut={hover.hide}
        >
          <boxGeometry
            args={[0.045, models.length * LANE_GAP + 0.3, BAR_D + 0.5]}
          />
          <meshStandardMaterial
            color="#8b919b"
            roughness={0.9}
            transparent
            opacity={0.55}
          />
        </mesh>
      )}
    </group>
  );
}

function Track({
  y,
  left,
  color,
}: {
  y: number;
  left: number;
  color: THREE.Color;
}) {
  return (
    <mesh position={[left + BAR_SPAN / 2, y, -0.05]}>
      <boxGeometry args={[BAR_SPAN, BAR_H * 0.5, BAR_D * 0.6]} />
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
  );
}

function Bar({
  value,
  y,
  left,
  color,
  dim,
  reduced,
  hover,
  label,
}: {
  value?: number;
  y: number;
  left: number;
  color: THREE.Color;
  dim: boolean;
  reduced: boolean;
  hover: SceneHover;
  label: string;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const target = ((value ?? 0) / 100) * BAR_SPAN;

  useFrame(() => {
    if (!mesh.current) return;
    const current = reduced
      ? target
      : THREE.MathUtils.lerp(mesh.current.scale.x, target, 0.12);
    // A zero-scaled box renders a degenerate normal matrix, so hold a sliver.
    mesh.current.scale.x = Math.max(current, 0.0001);
    mesh.current.position.x = left + mesh.current.scale.x / 2;
  });

  if (value === undefined) return null;

  return (
    <mesh
      ref={mesh}
      position={[left, y, 0]}
      scale={[0.0001, 1, 1]}
      onPointerMove={(event) => {
        event.stopPropagation();
        hover.show(label, event);
      }}
      onPointerOut={hover.hide}
    >
      <boxGeometry args={[1, BAR_H, BAR_D]} />
      <meshStandardMaterial
        color={color}
        roughness={0.42}
        metalness={0.08}
        transparent
        opacity={dim ? 0.45 : 0.95}
      />
    </mesh>
  );
}

/** The distance between specificity and sensitivity, drawn where it costs. */
function Gap({
  from,
  to,
  y,
  left,
  dim,
  reduced,
  hover,
  label,
}: {
  from: number;
  to: number;
  y: number;
  left: number;
  dim: boolean;
  reduced: boolean;
  hover: SceneHover;
  label: string;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const start = left + (from / 100) * BAR_SPAN;
  const width = ((to - from) / 100) * BAR_SPAN;

  useFrame(() => {
    if (!mesh.current) return;
    const current = reduced
      ? width
      : THREE.MathUtils.lerp(mesh.current.scale.x, width, 0.12);
    mesh.current.scale.x = Math.max(current, 0.0001);
    mesh.current.position.x = start + mesh.current.scale.x / 2;
  });

  return (
    <mesh
      ref={mesh}
      position={[start, y, BAR_D / 2 + 0.04]}
      scale={[0.0001, 1, 1]}
      onPointerMove={(event) => {
        event.stopPropagation();
        hover.show(label, event);
      }}
      onPointerOut={hover.hide}
    >
      <boxGeometry args={[1, BAR_H * 0.34, 0.1]} />
      <meshStandardMaterial
        color="#be123c"
        roughness={0.5}
        transparent
        opacity={dim ? 0.4 : 0.95}
      />
    </mesh>
  );
}

/**
 * The standard deviation across folds, straddling the bar's tip.
 *
 * Drawn because the interesting comparisons in accuracy-only papers are usually
 * decided by margins smaller than this. A bar tip is a claim; the whisker is how
 * much of that claim survives changing which fold you tested on.
 */
function Whisker({
  centre,
  spread,
  left,
  dim,
  reduced,
  hover,
  label,
}: {
  centre: number;
  spread: number;
  left: number;
  dim: boolean;
  reduced: boolean;
  hover: SceneHover;
  label: string;
}) {
  const group = useRef<THREE.Group>(null);
  const targetX = left + (centre / 100) * BAR_SPAN;
  const width = Math.max(((2 * spread) / 100) * BAR_SPAN, 0.02);

  useFrame(() => {
    if (!group.current) return;
    group.current.position.x = reduced
      ? targetX
      : THREE.MathUtils.lerp(group.current.position.x, targetX, 0.12);
  });

  return (
    <group
      ref={group}
      position={[left, 0, BAR_D / 2 + 0.06]}
      onPointerMove={(event) => {
        event.stopPropagation();
        hover.show(label, event);
      }}
      onPointerOut={hover.hide}
    >
      <mesh>
        <boxGeometry args={[width, 0.035, 0.06]} />
        <meshStandardMaterial
          color="#5b6270"
          roughness={0.7}
          transparent
          opacity={dim ? 0.4 : 0.9}
        />
      </mesh>
      {[-width / 2, width / 2].map((x) => (
        <mesh key={x} position={[x, 0, 0]}>
          <boxGeometry args={[0.035, BAR_H * 0.62, 0.06]} />
          <meshStandardMaterial
            color="#5b6270"
            roughness={0.7}
            transparent
            opacity={dim ? 0.4 : 0.9}
          />
        </mesh>
      ))}
    </group>
  );
}

function Pips({
  count,
  x,
  color,
}: {
  count: number;
  x: number;
  color: THREE.Color;
}) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <mesh key={index} position={[x - index * 0.17, 0, 0]}>
          <sphereGeometry args={[0.055, 12, 12]} />
          <meshStandardMaterial color={color} roughness={0.6} />
        </mesh>
      ))}
    </>
  );
}

function format(value?: number): string {
  return value === undefined ? "not reported" : `${value.toFixed(2)}%`;
}
