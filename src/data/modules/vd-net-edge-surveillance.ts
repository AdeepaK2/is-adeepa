import type { StudyModule } from "@/types/study";

/**
 * Khan, El Saddik, Gueaieb, De Masi & Karray (2024), "VD-Net: An Edge
 * Vision-Based Surveillance System for Violence Detection".
 * IEEE Access 12:43796-43808.
 *
 * Provenance note. Every table in this PDF is embedded as vector outlines with
 * no text layer, so the numbers below were read off the rendered pages rather
 * than extracted; the prose was extracted and cross-checked against them. Where
 * the paper's own tables disagree with each other — and they do, in three
 * places — both figures are recorded and the disagreement is named. Nothing here
 * is interpolated: the paper reports no timing of any kind, and that absence is
 * carried through as `undefined` rather than filled from the FLOPs count.
 *
 * Table map, for anyone checking the numbers against the PDF (physical pages):
 *   T1 p7   dataset statistics            T4 p9   precision / recall / F1
 *   T2 p8   ablation, four datasets       T5 p9   comparison to prior work
 *   T3 p8   sequence-length sweep         T6 p10  parameters, size, GFLOPs
 *   Fig 5 p10  confusion matrices         Fig 6 p11  ROC curves (no AUC given)
 */
export const moduleVdNet: StudyModule = {
  slug: "vd-net-edge-surveillance",

  premise:
    "Most of the library answers surveillance violence detection by making the model see more: another stream, a heavier backbone, a longer clip. This paper argues the opposite constraint — the model has to fit on the camera — and builds from a bottleneck transformer and a stack of dilated temporal convolutions, reaching 49.28 M parameters and 15.30 GFLOPs against baselines six times that size. It names the device it is meant to run on, a Jetson AGX Orin, and then never runs on it.",

  results: [
    {
      label: "Surveillance Fight",
      value: "92.50%",
      note: "accuracy — +3.80 over the best prior result in the paper's own Table 5",
    },
    {
      label: "Compute",
      value: "15.30",
      note: "GFLOPs, against 33.47 for AR-Net and 98 for TSM (T6)",
    },
    {
      label: "Measured on the Jetson",
      value: "nothing",
      note: "no latency, frame rate or on-device figure appears anywhere in the paper",
    },
  ],

  review: {
    architecture: {
      family: "Edge / Lightweight",
      backbone:
        "A modified bottleneck transformer (after BoTNet, ref [29]) feeding three hierarchically stacked ST-TCN blocks. No pre-trained image backbone is named, and no input resolution is stated.",
      motionEncoding:
        "Dilated temporal convolution. Three stacked blocks each convolve along the time axis with a widening receptive field, so how far back a unit can see is set by depth and dilation rather than by a recurrent state or by 3D kernels. The paper proposes this explicitly as a replacement for RNNs, on the grounds that the convolutions parallelise over the sequence where a recurrence cannot.",
      inputs: [
        "A frame sequence. The sequence-length sweep in T3 tests 10, 15, 20 and 25 frames; 20 is the best and is presumably what the headline runs use, though the paper never says so outright.",
        "RGB only. No optical flow, no pose, no audio, and so no uncosted pre-processing stage hiding behind the reported compute.",
      ],
      fusion:
        "None in the two-stream sense. There is one path; the bottleneck transformer's own split into a 'core' and a 'context' sequence is rejoined by concatenation and a linear projection inside the block.",
      supervision:
        "Supervised binary classification, whole clip, violent / nonviolent",
      notes: [
        "Separate the named contribution from the architecture. ST-TCN, the parallel bottleneck transformer and the bottleneck attention module are recombinations of refs [38], [29] and [34]; what is new is the arrangement, and the ablation in T2 measures exactly that. The paper's own novelty claim — 'the first use of a bottleneck layer to learn salient cues of violent activity in the IIoT network' — is a priority claim about application, not a design one.",
        "The system diagram (Fig. 1) is a four-part deployment story: cameras, an edge screening step, a cloud stage for detailed investigation, and an alert to 'relevant departments'. Only the classifier is evaluated. The alerting, the IIoT transport and the cloud stage are described and never measured.",
        "Two different papers in this library are called VD-Net. This one (V004) is bottleneck-transformer plus ST-TCN; V010 is a ConvLSTM plus a GRU from a different group. They share nothing but the name.",
      ],
    },

    attention: {
      used: true,
      kinds: ["self", "spatial", "channel"],
      mechanisms: [
        {
          name: "Bottleneck self-attention (modified BoTNet block)",
          placement:
            "Feature extraction, before the ST-TCN stack. Self-attention runs over a subset of tokens — the 'context' sequence — rather than all of them, then rejoins the 'core' by concatenation and linear projection. The modification is to connect the content-position encoding in parallel with the original content rather than in series (Fig. 3, bottom, against the traditional block on top).",
          reportedEffect:
            "Measured only as part of the whole modified block: B + ST-TCN → MB + ST-TCN is +1.05 on Hockey, +3.30 on Movie, +3.94 on Surveillance Fight and +3.03 on Violent Flow (T2). The parallel encoding is never isolated from the rest of the modification.",
        },
        {
          name: "Bottleneck attention, spatial branch (M_s, after BAM, ref [34])",
          placement:
            "Applied to the feature map as one half of the gate. M_s = BN(FC(AP(F))) — one weight per position, shared across every channel (eq. 3).",
          reportedEffect:
            "Not ablated. No experiment separates the spatial branch from the channel branch.",
        },
        {
          name: "Bottleneck attention, channel branch (M_c)",
          placement:
            "The other half of the same gate — one weight per channel, shared across every position (eq. 4). The two are summed and passed through a sigmoid, M(F) = σ(M_s(F) + M_c(F)) (eq. 2).",
          reportedEffect:
            "Not ablated, and not separable from the spatial branch in any reported number.",
        },
      ],
      notes: [
        "The gate is residual: F′ = (1 + M(F)) ⊗ F (eq. 5). That form bounds the gain below at 1, so this module can only amplify — it never suppresses a region below its original value. 'The model learns to ignore the rest of the frame' is a common gloss on attention and it is not what this equation does.",
        "Three attention mechanisms, one ablation row between them. T2's 3.94-point jump on Surveillance Fight is the paper's best evidence that any of this helps, and it cannot be attributed to any one of the three.",
        "Attention here is learned, not a fixed prior. Nothing in the model is a hand-set crop or a fixed frame window, which distinguishes it from the spatiotemporal crop in V001.",
      ],
    },

    efficiency: {
      parameters: "49.28 M",
      flops: "15.30 GFLOPs",
      modelSize: "188.00 MB",
      throughput: undefined,
      hardware:
        "Training: GeForce RTX 3080-Ti. Inference target: NVIDIA Jetson AGX Orin 64 GB, named as the edge server but never used to produce a reported number.",
      realTime: {
        status: "claimed-without-evidence",
        note: "'Real-time' appears eleven times, including in the abstract ('especially for real-time surveillance systems with limited computing power') and in the contributions ('significantly improving accuracy with reduced latency for real-time applications'). A term census over all thirteen pages returns no FPS, no latency, no inference time, no milliseconds and no throughput figure of any kind. T6 reports parameters, model size and GFLOPs — proxies for cost, not measurements of speed, and they say nothing about whether a frame is classified inside its own frame interval.",
      },
      edgeDeployment: {
        status: "claimed-without-evidence",
        note: "The target device is specified in unusual detail — Jetson AGX Orin 64 GB, its SoC, its ARM cores, its connectivity — and nothing is ever run on it. The conclusion settles the question against the paper: the authors 'plan to further improve the proposed VD-Net framework by exploring real-time data processing techniques and edge computing to reduce processing delays' and 'may consider deploying our VD-Net model on more powerful edge devices or cloud servers with GPUs'. The deployment is future work described in the present tense.",
      },
      notes: [
        "T6's column heading reads 'Parameters (MB)', which is a unit error: parameters are a count. The arithmetic settles what was meant — 49.28 million parameters at 4 bytes each is 197 MB, within rounding of the 188.00 MB in the neighbouring Size column, whereas 49.28 MB of parameters could not produce a 188 MB model. Read the column as millions.",
        "Against the baselines it lists, the compute claim holds: 49.28 M parameters against 89.85–297.56 M, 188 MB against 369.93–2647.70 MB, and 15.30 GFLOPs against 33.47 for AR-Net and 98 for TSM. That is a real and substantial reduction, and it is the part of the paper best supported by its own numbers.",
        "The text says the model's 'computation complexity is lower than ViT large [52], which is shown in the subsequent section'. The subsequent section is T6, and T6 contains no ViT row. The comparison is asserted and never shown.",
        "No power draw, no memory footprint at inference, no batch-1 measurement — the three numbers that decide whether a model fits on a camera.",
      ],
    },

    evaluation: {
      datasets: [
        {
          name: "Hockey Fight",
          role: "evaluation",
          note: "1000 clips, 25 fps, 360×240, 1.6 s each; 500 violent and 500 not (T1 and §IV-A). Broadcast sport, not surveillance.",
        },
        {
          name: "Movies",
          role: "evaluation",
          note: "Called 'movie fight' throughout the paper. 200 clips, 25 fps, 360×240, 1–1.9 s (T1). Fight scenes cut from action films, with non-fight clips drawn from public action datasets. The furthest of the four from operational CCTV.",
        },
        {
          name: "Surveillance Camera Fight",
          role: "evaluation",
          note: "Called 'surveillance fight'. 300 clips, 20–30 fps, mixed resolutions, 3–5 s (T1), from Akti et al. [35]. Real surveillance-camera footage, and the dataset the paper positions as its target case.",
        },
        {
          name: "Crowd Violence",
          role: "evaluation",
          note: "Called 'violent flow'. The 246-clip count in T1 matches Hassner et al.'s Violent Flows / Crowd Violence set, but the paper cites [36] — Gao et al.'s OViF, a feature method rather than the dataset paper — and describes the footage as factory and office scenes, which is not what that dataset contains. Treated here as Crowd Violence on the clip count.",
        },
      ],
      split:
        "70:20:10 train / validation / test, stated once and applied to all four datasets. Each dataset is trained and tested on its own — there is no cross-dataset evaluation anywhere in the paper.",
      metrics: [
        "Accuracy",
        "Precision (per class)",
        "Recall (per class)",
        "F1 score",
        "Weighted and unweighted accuracy",
      ],
      protocolNotes: [
        "The reported accuracies do not fit the stated split. At 70:20:10 the test sets hold 100, 20, 30 and 25 clips; 92.50% of 30 clips is 27.75 clips and 99.00% of 20 is 19.8, neither of which is a possible count. Either the reported figures come from a different population than the 10% test slice, or the split is not what is stated. The paper never says which set the headline numbers are computed on.",
        "T2 and T3 disagree on the same model and the same dataset. The proposed model scores 98.50 on Hockey in T2 and 98.01 in T3's best column; the baseline scores 95.01 in T2 and at most 85.75 in T3, a 9.26-point gap that no stated difference in protocol accounts for.",
        "T4 and Fig. 5 disagree too. On Violent Flow, T4 gives violent recall 0.94 and non-violent 0.99, while the confusion matrix shows 1.0 and 0.93; on Surveillance Fight, T4 gives 0.99 and 0.90 against the matrix's 1.0 and 0.86. The Movie Fight matrix's top row reads 1.0 and 0.082, which sums to more than one and cannot be a row-normalised confusion matrix.",
        "Accuracy is not the only metric reported, which is worth crediting — and the per-class numbers are where the useful finding is. On Surveillance Fight, precision on the violent class is 0.85: roughly one in seven violence alarms is wrong, on the one dataset that actually looks like the deployment. That is invisible in the 92.50% headline.",
        "Validation is 20% of the data and training uses early stopping, so the stopping point is chosen on the validation set. Nothing states that the reported figures come from the untouched 10% rather than that same validation set.",
        "Ranked by distance from operational CCTV, the four datasets run Surveillance Fight and Violent Flow (real surveillance), then Hockey (broadcast sport), then Movie (film) — and the scores run the other way: 92.50 and 97.00 against 98.50 and 99.00. The model is weakest where it is meant to be deployed.",
        "Fig. 6 plots ROC curves for all four datasets and no AUC value is printed on the figure or stated in the text, so the curves cannot be compared numerically against anything.",
      ],
    },
  },

  concepts: [
    {
      id: "st-tcn",
      title: "Time without recurrence, and what depth has to buy",
      tagline: "ST-TCN blocks",
      highlight: {
        label: "Hockey, 20 frames vs 25",
        value: "+10.06",
        note: "98.01% at a 20-frame clip, 87.95% at 25 (T3)",
      },
      note: [
        "The paper's first move is to take the recurrence out. An LSTM or GRU carries a hidden state forward, so by construction it has seen every frame before the current one; the cost is that it has to walk the sequence one step at a time. Three stacked temporal convolution blocks can be computed for every timestep at once, which is why the paper proposes them for a device with limited compute.",
        "What that trade gives up is unlimited reach. A convolution sees exactly the window its kernels span. Stacking blocks with growing dilation widens that window quickly — three blocks of three taps at dilations 1, 2 and 4 reach fifteen frames — but the window is finite and set at design time, and any motion outside it is not attenuated so much as absent.",
        "T3 is where this stops being theory. Sweeping the clip length on Hockey, the proposed model climbs to 98.01% at 20 frames and then falls to 87.95% at 25 — a ten-point collapse from feeding it five more frames. Every one of the four methods peaks at 20 and drops at 25, so it is a property of the setup rather than of one model. The paper picks 20 and does not discuss the cliff.",
      ],
      takeaways: [
        "Receptive field is a design parameter here, not something the model learns. Depth and dilation fix how far back a unit can see before training starts.",
        "The sweep is single-dataset: Hockey only. Nothing shows that 20 frames is right for Surveillance Fight, whose clips run 3–5 seconds against Hockey's 1.6.",
        "Every method loses accuracy between 20 and 25 frames, the proposed one by 10.06 points. An unexplained cliff that steep is usually a clue about the data pipeline rather than the architecture.",
        "T3's numbers do not line up with T2's: the same model and dataset score 98.01 here and 98.50 there, and the baseline differs by 9.26 points between the two tables.",
      ],
      visual: {
        kind: "tcn-receptive-field",
        options: {
          hue: 175,
          frames: 20,
          blocks: [
            { name: "block 1", dilation: 1, kernel: 3 },
            { name: "block 2", dilation: 2, kernel: 3 },
            { name: "block 3", dilation: 4, kernel: 3 },
          ],
          // T3, the MB + ST-TCN row. Dilations are illustrative -- the paper
          // states three hierarchical blocks and never publishes their rates.
          sequenceLengths: [
            { frames: 10, accuracy: 85.16 },
            { frames: 15, accuracy: 90.5 },
            { frames: 20, accuracy: 98.01 },
            { frames: 25, accuracy: 87.95 },
          ],
          copy: { readout: "Hockey accuracy" },
        },
        caption:
          "One output unit's receptive field, drawn back down to the frames it reads. Switch the depth to see how far three blocks reach, and the clip length to see the accuracy the paper measured there. The dilation rates are illustrative: the paper states three hierarchical blocks and never publishes their rates.",
      },
      pdfPage: 5,
    },

    {
      id: "bottleneck-attention",
      title: "Two branches, one gate, and no way to tell them apart",
      tagline: "Bottleneck attention",
      highlight: {
        label: "Modified bottleneck, Surveillance Fight",
        value: "+3.94",
        note: "88.56% → 92.50% (T2) — the whole block, not any one branch",
      },
      note: [
        "The attention module has two halves that are usually named in one breath and are not the same kind of thing. The spatial branch produces one weight per position and applies it identically to every channel; the channel branch produces one weight per channel and applies it identically across the frame. Only together can the gate vary in both directions at once — the paper sums them and squashes the result, M(F) = σ(M_s(F) + M_c(F)).",
        "The form of the gate is worth reading carefully. It is F′ = (1 + M(F)) ⊗ F, not M(F) ⊗ F. With the residual 1, the smallest gain any feature can get is 1 — the module amplifies what it finds salient and leaves everything else exactly as it was. It cannot switch a region off, which is what 'attention learns to ignore the background' usually implies.",
        "What none of this comes with is an ablation. T2 measures the modified bottleneck as one block: swapping B + ST-TCN for MB + ST-TCN is worth +1.05 on Hockey, +3.30 on Movie, +3.03 on Violent Flow and +3.94 on Surveillance Fight. That is the paper's strongest evidence for attention, and it is also the only one — three mechanisms are inside that single delta and nothing separates them.",
      ],
      takeaways: [
        "Spatial and channel attention differ in the shape of the mask they can produce, not in strength. A channel weight cannot express 'this corner of the frame'.",
        "The residual form bounds the gain below at 1, so this gate only amplifies. Read (1 + M) ⊗ F literally.",
        "One ablation row covers three attention mechanisms. No branch, and no part of the parallel bottleneck modification, is measured on its own.",
        "The block earns most where the footage is hardest: +3.94 on Surveillance Fight against +1.05 on Hockey, which is the pattern you would want if it were finding salient motion in cluttered scenes.",
      ],
      visual: {
        kind: "attention-map",
        options: {
          hue: 175,
          gridSize: [5, 5],
          channels: 4,
          combine: "sum",
          residual: true,
          // `effect` is deliberately absent: no configuration here was ever run
          // on its own, and the readout says so rather than showing a number
          // borrowed from the whole-block ablation.
          copy: {
            readout: "Accuracy",
            branchLabel: "Branch",
            lines: {
              spatial:
                "One weight per position, identical on every channel. The mask varies across the frame and is flat through the stack.",
              channel:
                "One weight per channel, identical at every position. The mask varies through the stack and is flat across the frame.",
              both: "Summed, then squashed: M(F) = σ(M_s(F) + M_c(F)). Only now can the gate vary in both directions at once.",
            },
          },
        },
        caption:
          "The gate of equations (1)–(5). Cell size is the gain each feature receives; with the residual term the smallest cell is still the original feature. The mask shapes are illustrative — the paper publishes no attention maps — and the accuracy readout is empty because no branch was ever ablated alone.",
      },
      pdfPage: 6,
    },

    {
      id: "ablation",
      title: "What each piece buys, and where it buys the most",
      tagline: "Ablation (T2)",
      highlight: {
        label: "Surveillance Fight, baseline → full",
        value: "+14.55",
        note: "77.95% → 92.50%, against +3.49 on Hockey",
      },
      note: [
        "T2 walks the model up in three steps on all four datasets at once: the bottleneck transformer alone, plus off-the-shelf TCNs, plus the ST-TCN variant, then plus the modified bottleneck. Every step helps on every dataset, which is rarer in ablation tables than it should be.",
        "The interesting reading is not the total but its distribution. On Hockey the four rows span 95.01 to 98.50, a gain of 3.49 points; on Surveillance Fight they span 77.95 to 92.50, a gain of 14.55. The additions are worth four times as much on real surveillance footage as on broadcast sport — the easy benchmark had already been solved by the baseline, and the components are earning their place on the hard one.",
        "That also puts the headline numbers in proportion. A bare bottleneck transformer already reaches 95.01% on Hockey, so a paper reporting only Hockey could have claimed most of this result without any of the contributions in it.",
      ],
      takeaways: [
        "Both steps matter: plain TCNs → ST-TCN is worth 5.56 points on Surveillance Fight, and the modified bottleneck another 3.94.",
        "The gains concentrate where the baseline is weakest. On the two surveillance datasets the full model adds 14.55 and 8.55 points; on the two staged ones, 3.49 and 7.15.",
        "Every cell is accuracy alone. The per-class numbers in T4 exist only for the final model, so nothing shows whether the intermediate steps traded precision for recall.",
        "The 98.50 in this table's Hockey column is the same figure T3 reports as 98.01. Both are printed; the paper reconciles neither.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          hue: 175,
          mode: "outcome",
          metricLabel: "Accuracy",
          datasetLabel: "Dataset",
          baselineId: "b",
          // T2, p8.
          datasets: [
            {
              id: "surveillance",
              label: "Surveillance Fight",
              title: "300 real surveillance clips",
            },
            {
              id: "violent-flow",
              label: "Violent Flow",
              title: "246 unaltered surveillance clips",
            },
            {
              id: "hockey",
              label: "Hockey",
              title: "1000 broadcast sport clips, 500 violent / 500 not",
              floor: 50,
              floorLabel: "always-violent guess",
            },
            { id: "movie", label: "Movie", title: "200 film clips" },
          ],
          models: [
            {
              id: "b",
              label: "Baseline (bottleneck transformer)",
              metrics: {
                hockey: { accuracy: 95.01 },
                movie: { accuracy: 91.85 },
                surveillance: { accuracy: 77.95 },
                "violent-flow": { accuracy: 88.45 },
              },
            },
            {
              id: "b-tcn",
              label: "B + TCNs",
              metrics: {
                hockey: { accuracy: 96.2 },
                movie: { accuracy: 93.5 },
                surveillance: { accuracy: 83.0 },
                "violent-flow": { accuracy: 92.0 },
              },
            },
            {
              id: "b-sttcn",
              label: "B + ST-TCN",
              metrics: {
                hockey: { accuracy: 97.45 },
                movie: { accuracy: 95.7 },
                surveillance: { accuracy: 88.56 },
                "violent-flow": { accuracy: 93.97 },
              },
            },
            {
              id: "mb-sttcn",
              label: "MB + ST-TCN (VD-Net)",
              metrics: {
                hockey: { accuracy: 98.5 },
                movie: { accuracy: 99.0 },
                surveillance: { accuracy: 92.5 },
                "violent-flow": { accuracy: 97.0 },
              },
            },
          ],
        },
        caption:
          "The four rows of T2, one lane each. Switch datasets and watch how much of the total gain survives: on Hockey the baseline is already most of the way there, on Surveillance Fight it is not. Bars run from a true zero; sensitivity and specificity are not reported for these rows.",
      },
      pdfPage: 8,
    },

    {
      id: "sota",
      title: "The comparison table, read against the claim it supports",
      tagline: "Versus prior work",
      highlight: {
        label: "Abstract's claim, checked",
        value: "1 of 4",
        note: "the promised 1–4% gain over SoTA holds on Surveillance Fight and on no other dataset",
      },
      note: [
        "The abstract promises 'a 1–4% improvement in State-of-The-Art (SoTA) accuracy'. T5 lists seventeen prior methods and the proposed one, so the claim can be checked against the paper's own table without leaving the paper.",
        "On Surveillance Fight it holds comfortably: 92.50 against 88.70 for the next best, +3.80. On Hockey it is +0.45 over Two-cascade TSM's 98.05. On the other two it is negative — MiNet-3D reports 100.00 on Movie Fight against VD-Net's 99.00, and 3D-CNNs reports 98.00 on Violent Flow against 97.00, with SSHA's 97.90 also ahead. The improvement is real on one dataset of four, and it happens to be the one the paper cares most about.",
        "The discussion adds two more slips worth noting because they run the same direction. It says the model is 'just 0.351% lower' than ViT large on Movie Fight, but the ViT Large-16 row reads 99.50 against 99.00, a gap of 0.50, and the reference cited in the sentence ([52]) is not the one on the table row ([50]). It then says the model is higher than ViT on 'violence flows as well' — both are 97.00, a tie.",
      ],
      takeaways: [
        "Check 'we beat SoTA' claims against the paper's own comparison table. Two rows here beat the proposed model and neither is mentioned in the text.",
        "Where VD-Net genuinely leads is the dataset most like a deployment: +3.80 on Surveillance Fight over the next best, and +7.29 over ResNet-50, the strongest of the six methods that report all four datasets.",
        "Every entry is a number copied from another paper's protocol. Nothing in T5 is a re-run, so the margins carry whatever protocol differences those papers had.",
        "The comparison is accuracy-only, and eight of the seventeen prior rows have no Surveillance Fight entry at all — the hard dataset is the one fewest methods report.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          hue: 175,
          mode: "outcome",
          metricLabel: "Accuracy",
          datasetLabel: "Dataset",
          baselineId: "vdnet",
          // T5, p9. Six of the eighteen rows: the proposed model, the strongest
          // competitor on each dataset, and the one other surveillance-focused
          // method. A dash in the table means the method never ran on that set,
          // and is left undefined here rather than zero.
          datasets: [
            {
              id: "surveillance",
              label: "Surveillance Camera",
              title: "Where VD-Net leads by 3.80",
            },
            {
              id: "violent-flow",
              label: "Violent Flow",
              title: "Where 3D-CNNs leads by 1.00",
            },
            { id: "hockey", label: "Hockey", title: "Where VD-Net leads by 0.45" },
            {
              id: "movie",
              label: "Movie",
              title: "Where MiNet-3D leads by 1.00",
            },
          ],
          models: [
            {
              id: "vdnet",
              label: "Proposed VD-Net",
              metrics: {
                hockey: { accuracy: 98.5 },
                movie: { accuracy: 99.0 },
                surveillance: { accuracy: 92.5 },
                "violent-flow": { accuracy: 97.0 },
              },
            },
            {
              id: "vit",
              label: "ViT Large-16 [50]",
              metrics: {
                hockey: { accuracy: 98.0 },
                movie: { accuracy: 99.5 },
                surveillance: { accuracy: 84.6 },
                "violent-flow": { accuracy: 97.0 },
              },
            },
            {
              id: "minet",
              label: "MiNet-3D [44]",
              metrics: {
                hockey: { accuracy: 94.71 },
                movie: { accuracy: 100.0 },
                "violent-flow": { accuracy: 91.41 },
              },
            },
            {
              id: "cnn3d",
              label: "3D-CNNs [46]",
              metrics: {
                hockey: { accuracy: 96.0 },
                movie: { accuracy: 90.2 },
                "violent-flow": { accuracy: 98.0 },
              },
            },
            {
              id: "tsm2",
              label: "Two-cascade TSM [47]",
              metrics: {
                hockey: { accuracy: 98.05 },
                "violent-flow": { accuracy: 96.93 },
              },
            },
            {
              id: "vdnet3d",
              label: "3D CNN-based VDNet [51]",
              metrics: {
                surveillance: { accuracy: 88.7 },
                "violent-flow": { accuracy: 94.0 },
              },
            },
          ],
        },
        caption:
          "Six rows of T5, with the proposed model as the reference lane. Lanes go blank on datasets a method never ran — a dash in the table is not a zero. Switch to Movie or Violent Flow to see the two rows the discussion does not mention.",
      },
      pdfPage: 9,
    },

    {
      id: "edge-claim",
      title: "Designed for a device it was never run on",
      tagline: "The edge claim",
      highlight: {
        label: "Timing figures in the paper",
        value: "0",
        note: "no FPS, no latency, no inference time, on any hardware",
      },
      note: [
        "The compute story is the part of this paper best supported by its own evidence. T6 puts VD-Net at 49.28 M parameters, 188 MB and 15.30 GFLOPs, against 89.85–297.56 M parameters and 369.93–2647.70 MB for the six baselines it lists, and 33.47 GFLOPs for the nearest competitor on compute. A model between two and six times smaller than its comparators is a genuine result, and it is what the title is really about.",
        "It is also the wrong quantity for the claim being made. FLOPs and parameter counts are proxies; whether a model is real-time is a question about wall-clock time on a specific device, and the paper reports none. The Jetson AGX Orin 64 GB is named, its SoC and its ports described, and no number is ever produced on it — training happens on an RTX 3080-Ti and the evaluation is silent about where inference ran.",
        "The conclusion then answers the question the results section left open. The authors 'plan to further improve the proposed VD-Net framework by exploring real-time data processing techniques and edge computing to reduce processing delays', and 'may consider deploying our VD-Net model on more powerful edge devices or cloud servers with GPUs'. The edge deployment that gives the paper its title is future work.",
      ],
      takeaways: [
        "Smaller is measured; faster is asserted. Keep the two claims apart when reading any efficiency paper.",
        "T6's 'Parameters (MB)' is a unit error. 49.28 M parameters at 4 bytes is 197 MB, which matches the 188 MB Size column; 49.28 MB of parameters could not. The column means millions.",
        "The text says the complexity comparison against ViT large is 'shown in the subsequent section'. It is not — T6 has no ViT row.",
        "Nothing reports power, inference memory or batch-1 behaviour, which are the numbers that decide whether a model fits on a camera.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          hue: 175,
          mode: "architecture",
          // T6, p10. One block per lane, because the paper publishes one total
          // per model and never breaks it down by stage -- inventing a split
          // would put numbers in the picture that are not in the paper.
          models: [
            {
              id: "vdnet",
              label: "VD-Net — 188.00 MB, 15.30 GFLOPs",
              blocks: [
                {
                  label: "whole model",
                  params: 49_280_000,
                  trained: true,
                  note: "49.28 M parameters, 188.00 MB, 15.30 GFLOPs (T6)",
                },
              ],
            },
            {
              id: "ptsm",
              label: "P-TSM [53] — 369.93 MB",
              blocks: [
                {
                  label: "whole model",
                  params: 89_850_000,
                  trained: true,
                  note: "89.85 M parameters, 369.93 MB, GFLOPs not reported",
                },
              ],
            },
            {
              id: "tsm",
              label: "TSM [42] — 397.71 MB, 98 GFLOPs",
              blocks: [
                {
                  label: "whole model",
                  params: 89_930_000,
                  trained: true,
                  note: "89.93 M parameters, 397.71 MB, 98 GFLOPs (T6)",
                },
              ],
            },
            {
              id: "tea",
              label: "TEA [43] — 479.78 MB, 70 GFLOPs",
              blocks: [
                {
                  label: "whole model",
                  params: 91_950_000,
                  trained: true,
                  note: "91.95 M parameters, 479.78 MB, 70 GFLOPs (T6)",
                },
              ],
            },
            {
              id: "i3d",
              label: "I3D [40] — 1000.20 MB",
              blocks: [
                {
                  label: "whole model",
                  params: 146_880_000,
                  trained: true,
                  note: "146.88 M parameters, 1000.20 MB, GFLOPs not reported",
                },
              ],
            },
            {
              id: "cnn3d",
              label: "3D-CNN [46] — 2647.70 MB",
              blocks: [
                {
                  label: "whole model",
                  params: 297_560_000,
                  trained: true,
                  note: "297.56 M parameters, 2647.70 MB, GFLOPs not reported",
                },
              ],
            },
            {
              id: "arnet",
              label: "AR-Net [41] — 33.47 GFLOPs",
              emptyNote:
                "T6 gives AR-Net GFLOPs only — its size and parameter count are left blank",
            },
          ],
        },
        caption:
          "T6 at log scale, one block per model because that is all the paper publishes per model. The readout is the parameter count; AR-Net has none because its row reports GFLOPs alone. Nothing here is a speed: no timing figure exists in the paper to draw.",
      },
      pdfPage: 10,
    },
  ],
};
