import type { StudyModule } from "@/types/study";

/**
 * Wang, Zhao, Li & Wang (2024), "Lightweight Violence Detection Model Based on
 * 2D CNN with Bi-Directional Motion Attention". Applied Sciences 14(11), 4895.
 *
 * Review extraction and study module.
 *
 * Table map, for anyone checking the numbers against the PDF:
 *   T1 p8   EfficientNet-B0 stage table        T5 p14 auxiliary-loss lambda sweep
 *   T2 p13  ablation on the three modules      T6 p15 recall/precision/F1/accuracy
 *   T3 p14  Bi-LTMA architecture ablation      T7 p16 inference time, three devices
 *   T4 p14  Bi-LTMA fusion ablation            T8 p17 comparison with prior work
 *
 *   F1 p4   pipeline          F5 p9  Bi-LTMA module
 *   F2 p8   EfficientNet-B0   F6 p10 TSM principle
 *   F3 p8   inverted residual F7 p11 auxiliary branch
 *   F4 p8   modified block    F8 p15 confusion matrices    F9 p17 Grad-CAM
 *
 * T1, T3 and T4 extract with their tick marks collapsed into the numbers -- T3
 * reads "87.75%  89.75%  90.25%" against three unlabelled check columns. Both
 * were read back against the surrounding prose, which states each figure
 * explicitly, so the row-to-configuration mapping below is the paper's own.
 *
 * Cross-reference worth keeping in view: this paper's frame-grouping comes from
 * Kang, Park & Park [15], which is V011 in this library, and V011 is also the
 * model it beats by 1.0 point on RWF-2000 in T8.
 */
export const moduleBiDirectionalMotionAttention: StudyModule = {
  slug: "bi-directional-motion-attention",

  premise:
    "The cheapest model in the library, and it wins the hardest benchmark in its own comparison table: 1.21 GFLOPs against RWF-2000, where a C3D spends 154. It gets there by refusing 3D convolution, optical flow and recurrence outright, and reconstructing motion from three cheaper tricks stacked on a stock EfficientNet-B0. Two things are worth holding onto while reading it. Four fifths of that 1.21 GFLOPs is spent by the one module the paper actually proposes. And the \"edge devices\" it validates on are a desktop CPU and two desktop GPUs.",

  results: [
    { label: "RWF-2000", value: "90.25%", note: "accuracy, T6 — best in T8's fourteen-model comparison" },
    { label: "Compute", value: "1.21 GFLOPs", note: "T2 — lowest in T8; 0.23 without Bi-LTMA" },
    { label: "Parameters", value: "4.48 M", note: "T2 — third lowest in T8" },
    { label: "Inference", value: "20.1 ms/clip", note: "T7, RTX 3080Ti; 323.3 ms on an i7-8700 CPU" },
  ],

  review: {
    architecture: {
      family: "2D CNN + Attention",
      backbone:
        "EfficientNet-B0, unmodified in shape: nine stages, the second to eighth built from mobile inverted bottleneck blocks (MBConv) with depthwise separable convolutions, as tabulated in T1 (p8). The paper's changes are all insertions into those seven MBConv stages -- a Bi-LTMA module before the block's first convolution and a residual TSM after it (F4, p8). The classifier stage and the stem are untouched. 4.26 M parameters before the insertions, 4.48 M after.",
      motionEncoding:
        "Three separate mechanisms stacked, none of which is a 3D kernel, an optical-flow field or a recurrent state. (1) Frame-grouping at the input: 3T sparsely sampled RGB frames are converted to greyscale with the standard luminance weights (0.30/0.59/0.11), then taken three at a time and packed into the R, G and B channels of one image, so a plain 2D convolution over that image already reaches across three consecutive instants. (2) TSM inside the backbone: a small fraction of channels is shifted one step forward and one step back along the temporal axis and the vacancies zero-padded, which fuses each time step's features with t-1 and t+1 at no parameter and no FLOP cost. (3) Bi-LTMA: feature-level differences between adjacent time steps, computed in both directions, turned into a gate. Long-range structure comes from the sparse sampling itself -- the 3T frames are drawn one per segment across the whole clip, so eight grouped images span the whole 150-frame RWF-2000 clip rather than a contiguous window of it.",
      inputs: [
        "Sparsely sampled RGB frames, one per segment: 24 frames for RWF-2000, 18 for Movie Fight, 15 for Hockey Fight and Surveillance Camera",
        "Converted to single-channel greyscale, then frame-grouped into T three-channel images -- T = 8 for RWF-2000, 6 and 5 for the others",
        "Cropped to 224 x 224 and normalised; random horizontal flip and random crop at training time",
        "No optical flow, no skeleton, no second stream, no audio",
      ],
      fusion:
        "Two places. Inside Bi-LTMA the forward and backward attention maps are averaged with fixed equal weights, A = 0.5W_f + 0.5W_b (Eq. 5), and the gated feature is folded back residually through a DropConnect layer, F' = F + G(A (.) F) (Eq. 6) -- so the module can only add to the original feature, never suppress it below itself. At the loss, the main and auxiliary softmax heads run in parallel over the same T images and their per-image cross-entropies are average-pooled into L_total = L_main + lambda L_aux with lambda = 0.5 (Eq. 7, T5).",
      supervision:
        "Fully supervised binary clip classification, cross-entropy, trained end to end for 120 epochs with Adam at learning rate 5e-5, weight decay 0.01, batch size 8, on an RTX 3080Ti. Deep supervision via an auxiliary softmax head attached after stage 7, built to mirror the structure of stage 9 so the two heads optimise in the same direction; it is discarded at inference and costs nothing at test time.",
      notes: [
        "Only one of the four named contributions is architecturally the authors' own. Frame-grouping is taken from Kang, Park & Park [15] -- V011 in this library. TSM is Lin, Gan & Han's [20], adopted unchanged apart from the choice to place it on the residual branch. The auxiliary-head idea comes from [19,42]. Bi-LTMA is the new module, and the paper is straightforward about the lineage rather than obscuring it.",
        "Bi-LTMA's own novelty is stated precisely and is worth stating as precisely back: against the ME module of TEA [41], which pools away the spatial dimension and gates channels only, Bi-LTMA (a) runs the difference in both directions and (b) keeps H and W, so the map varies over position as well as channel. T3 measures both halves separately and they are not equal in value -- the bidirectional half is worth 2.00 points, the spatial half 0.50.",
        "EfficientNet-B0's MBConv blocks already contain Squeeze-and-Excitation channel attention (F3, p8). The paper inherits it, names it once in a figure caption, and never ablates it, so every accuracy in T2 -- the 87.5% baseline included -- is a number for a model that already has channel attention in every stage.",
        "The reduction ratio inside Bi-LTMA is r = 2 and the mapping convolution is 3 x 3, chosen to absorb spatial misalignment between adjacent frames. Neither is swept. The motion at the final time step is defined as exactly zero in both directions, so the last of the T grouped images is gated by nothing.",
      ],
    },

    attention: {
      used: true,
      kinds: ["channel", "spatial", "temporal"],
      mechanisms: [
        {
          name: "Bi-LTMA (bi-directional long-term motion attention)",
          placement:
            "Inserted before the first convolution of every inverted residual block in stages 2 to 8 of EfficientNet-B0 (F4, p8). Internally: a 1 x 1 convolution reduces channels by r = 2; a 3 x 3 convolution maps the feature-level difference between adjacent time steps, taken as F_r(t+1) - F_r(t) forward and F_r(t) - F_r(t+1) backward; a 1 x 1 convolution and a concatenation restore the input shape; sigmoids produce W_f and W_b; the two are averaged into A, applied by Hadamard product, passed through DropConnect and added back to the input (F5, p9, Eqs. 2-6).",
          reportedEffect:
            "The largest single contributor in T2: +1.00 over the baseline alone (87.50 -> 88.50 on RWF-2000), against +0.75 for TSM and +0.50 for the auxiliary classifier. T3 then splits the module's own design: channel-only and unidirectional, i.e. ME as published, gives 87.75; adding the second direction gives 89.75; adding the spatial dimension gives 90.25. T4 splits the fusion: the bare gate A (.) F gives 87.00, DropConnect raises it to 87.75, and the residual shortcut raises it to 90.25 -- so the shortcut alone is worth 2.50 points, more than the bidirectional design it wraps.",
        },
        {
          name: "Temporal shift module (TSM), residual placement",
          placement:
            "After the first convolution of the same seven stages' inverted residual blocks, on the residual branch rather than in place, which the paper adopts from [20] to avoid degrading the backbone's spatial features. A small number of channels shift one step forward, another small number one step back, vacancies zero-padded (F6, p10).",
          reportedEffect:
            "+0.75 alone in T2 (87.50 -> 88.25), and +0.75 again on top of Bi-LTMA (88.50 -> 89.25). T2's cost columns confirm the claim that it is free: the rows with and without TSM both read 0.23 GFLOPs and 4.26 M parameters.",
        },
        {
          name: "Squeeze-and-Excitation, inherited",
          placement:
            "Inside every MBConv block of the stock EfficientNet-B0 backbone, named in the F3 caption (p8).",
          reportedEffect:
            "Never isolated. It is present in every row of T2 including the baseline, so the ablation measures what the three new modules add to a backbone that already gates channels, not what attention adds to a model without it.",
        },
      ],
      notes: [
        "Bi-LTMA is a soft gate, not a crop or a frame selection -- every position keeps a weight and the residual term means a weight of zero still passes the original feature through untouched. That is a materially weaker claim than \"the model ignores the rest of the frame\", and the Grad-CAM panels in F9 (p17) should be read with it in mind.",
        "The temporal element here is a difference between adjacent steps, not a weighting over the clip. Nothing in the model scores one of the T grouped images as more informative than another, which is what V006's temporal attention and V016's temporal attention fusion do. Filed under temporal because the quantity being gated on is motion between instants, but the distinction matters when this row is read across the library.",
        "The paper's related-work section surveys self-attention (non-local, ViT, StNet) and rejects it explicitly on cost. There is no self-attention anywhere in the proposed model.",
      ],
    },

    efficiency: {
      parameters:
        "4.48 M for the full model; 4.26 M for the backbone with TSM and the auxiliary head, which add none (T2, p13). Third lowest of the fourteen models in T8, behind Flow Gated Network's 0.248 M and FightCNN's 4.074 M.",
      flops:
        "1.21 GFLOPs for the full model; 0.23 GFLOPs without Bi-LTMA (T2). Lowest in T8, where the next lowest is 4.26 and C3D is 154.19. The paper's claim that this is \"only 28% of that of the second-placed model\" checks out: 1.21 / 4.26 = 28.4%.",
      modelSize: undefined,
      throughput:
        "Per-clip inference time on RWF-2000 (T7, p16): 323.3 ms on an Intel Core i7-8700 CPU at 3.2 GHz with 16 GB RAM, 22.6 ms on an RTX 2080Ti, 20.1 ms on an RTX 3080Ti. The three easier datasets run faster on the CPU -- 198.9 to 240.8 ms -- and almost identically on both GPUs. No FPS figure is given for the model itself; the paper converts to \"three inferences per second\" on CPU and \"higher than 40 times per second\" on the 2080Ti.",
      hardware:
        "Trained and tested on an Nvidia GeForce RTX 3080Ti. Inference timed on three devices: Intel Core i7-8700 CPU at 3.2 GHz with 16 GB RAM, RTX 2080Ti and RTX 3080Ti. All three are desktop-class; the paper describes them as simulating \"edge servers with limited resources\" serving several cameras each.",
      realTime: {
        status: "measured-and-supported",
        note: "The claim is made throughout and T7 backs it, with the paper's own arithmetic laid out rather than asserted: at 22.6 ms per clip an RTX 2080Ti runs about 40 inferences per second, so for 25 fps video and an accepted 960 ms decision latency one card can serve 40 cameras; the CPU manages three inferences per second and three cameras at the same latency. That is an honest framing, and it is also an admission that the decision latency is roughly a second by construction -- each inference consumes a whole clip, so the model's speed and the system's time-to-alert are different quantities. The 960 ms figure is a design choice the paper picks, not something it measures.",
      },
      edgeDeployment: {
        status: "claimed-without-evidence",
        note: "The paper's stated scope is edge-device violence detection and its introduction reviews the embedded hardware other groups use -- Jetson TX2 [15], Jetson Xavier NX [16], Jetson AGX Orin [17]. It then defines its own target as \"an edge device with limited resources, e.g., a desktop computer with a GPU card\" and tests on an i7-8700, a 2080Ti and a 3080Ti. No embedded board is run, and no measurement on constrained hardware exists in the paper. The lightweight design is real and measured in GFLOPs; the deployment claim it is offered in support of is not.",
      },
      notes: [
        "The cost is concentrated in exactly one place, and T2 shows it plainly: Bi-LTMA takes the model from 0.23 to 1.21 GFLOPs. Four fifths of the compute budget belongs to the proposed module, and it buys 1.00 point alone or 1.75 in combination. Everything else about the design -- frame-grouping, greyscale conversion, TSM, the auxiliary head -- is free or nearly so.",
        "That makes the 0.23 GFLOPs configuration the more interesting number for anyone actually deploying this. Backbone plus TSM plus auxiliary head reaches 89.25% on RWF-2000 at a fifth of the compute, which is still above every 2D model in T8 except this paper's own full version, and above every 3D model in it.",
        "No memory footprint, no model size in MB and no energy figure appears anywhere, although the introduction sets out \"low memory complexity\" as a design requirement alongside low computational cost. FLOPs and parameters are the whole of the efficiency accounting.",
        "T7's times are for the model on a prepared clip. Video decoding, sparse sampling, the RGB2Gray conversion and frame-grouping are never timed. They are cheap operations and unlikely to change the conclusion, but the number that supports the camera-count arithmetic covers the forward pass only.",
        "T8's comparison figures are, unusually, all verifiable against the table they sit under: 1.21 as 28% of 4.26, third place on parameters, +1.00 over the second-best RWF-2000 result, -0.50 from the best on Hockey and -0.83 from the best on Surveillance Camera all check out. The paper does not inflate its margins.",
      ],
    },

    evaluation: {
      datasets: [
        {
          name: "RWF-2000",
          role: "evaluation",
          note: "2000 surveillance clips of 150 frames, the authors' official 80/20 split. The paper names it the focus of its experiments and the closest of the four to real-world violence; every ablation in T2-T5 runs on it alone.",
        },
        {
          name: "Movies",
          role: "evaluation",
          note: "The paper's \"Movie Fight dataset\": 200 clips of 1-2 s at 360 x 240, 100 violent and 100 not, cut from films. Five-fold cross-validation. Saturated -- seven of the fourteen models in T8 reach 100%, this one included.",
        },
        {
          name: "Hockey Fight",
          role: "evaluation",
          note: "1000 clips of about 40 frames at 360 x 288 from NHL games. Five-fold cross-validation. The paper notes itself that it is a single scenario and \"lacks diversity of background\".",
        },
        {
          name: "Surveillance Camera Fight",
          role: "evaluation",
          note: "300 two-second clips from YouTube and surveillance cameras, 150 violent and 150 not, at mixed sizes and lengths. Five-fold cross-validation. The dataset where the model's false-alarm rate is worst.",
        },
      ],
      split:
        "RWF-2000 uses the dataset authors' published 80/20 train/test split. Movie Fight, Hockey Fight and Surveillance Camera all use five-fold cross-validation, adopted because the sets are small and, for Hockey, because no standard partition exists. No validation set distinct from the test set is described for any of the four.",
      metrics: [
        "Accuracy",
        "Recall",
        "Precision",
        "F1 score",
        "Normalised confusion matrices (F8, p15)",
        "GFLOPs",
        "Parameter count",
        "Per-clip inference time",
      ],
      protocolNotes: [
        "The headline RWF-2000 figure is a selected-best number on the set it is reported on. T5 sweeps the auxiliary-loss coefficient lambda across nine values on RWF-2000 and reports 90.25% at lambda = 0.5 as the best of them; that same 90.25% is the abstract's headline, T6's accuracy and T8's comparison entry. The module combination in T2 and the Bi-LTMA design in T3 and T4 were chosen the same way. There is no held-out set that was not used to make these choices, so the margin over the 89.25% second place in T8 is not a clean out-of-sample margin.",
        "T6's Surveillance Camera row does not reconcile with itself. It reports recall 97%, precision 98% and F1 95% at an accuracy of 91.67%; recall and precision of 97 and 98 give an F1 near 97.5, not 95, and on a balanced 150/150 set they cannot coexist with 91.67% accuracy. The confusion matrix the paper reads alongside it gives a 13% false-alarm rate against a 3% miss rate, which is consistent with the low accuracy but not with a precision of 98%. The paper notices the tension -- \"the corresponding accuracy of 91.67% is not as high as expected\" -- and explains it by false detections without resolving the arithmetic. The accuracy figure is corroborated by T8 and the confusion matrix; the precision and F1 in that row are not.",
        "That aside, the false-alarm finding is the most useful thing in the evaluation and the paper states it plainly: the false detection rate exceeds the miss rate on every dataset, and on Surveillance Camera it is more than four times higher. For an alarm that has to be believed, this is the number that decides deployability, and it is only visible because the paper published confusion matrices rather than accuracy alone.",
        "No cross-dataset test anywhere. Every figure is train and test within one dataset, so nothing in the paper speaks to whether a model tuned on RWF-2000 survives a move to another camera estate.",
        "Whether EfficientNet-B0 is initialised from pre-trained weights is never stated. ImageNet is not mentioned once in the paper, and Kinetics only in a reference title. For a backbone whose published accuracy is an ImageNet result, and for a training run of 120 epochs on as few as 200 clips, this is a material omission for reproduction.",
        "Dataset realism spans the full range and the results track it downward: film (100%), broadcast sport (98.5%), mixed YouTube and surveillance (91.67%), real surveillance (90.25%). Only the last two say much about a camera estate, and the paper is right to concentrate on RWF-2000.",
        "Everything is clip-level classification of pre-trimmed video. No temporal localisation, no untrimmed footage, no time-to-alert, and no report of training accuracy against which to judge overfitting.",
      ],
    },
  },

  concepts: [
    {
      id: "frame-grouping",
      title: "How a 2D network is made to see motion at all",
      tagline: "Frame-grouping (§3.1, F1)",
      highlight: {
        label: "Input tensor",
        value: "3T → T",
        note: "24 greyscale frames become 8 three-channel images on RWF-2000",
      },
      note: [
        "A 2D convolution has no time axis. The usual fixes are to give the network a third dimension (3D kernels), a memory (ConvLSTM), or a second input that already contains motion (optical flow) -- and all three are why the models in T8 cost 15 to 154 GFLOPs.",
        "Frame-grouping, borrowed here from V011, refuses all three by relabelling. Sample 3T frames across the clip, throw away colour with the standard luminance weights, then take the greyscale frames three at a time and put them where red, green and blue used to be. The tensor that reaches the backbone has exactly the shape EfficientNet-B0 expects. But a 3 x 3 kernel on the first layer now spans three channels that are three different instants, so its receptive field is 3 x 3 x 3 in space and time without a single 3D multiply.",
        "The cost of the trick is that colour is gone and the temporal reach is exactly three frames per image. Short-term motion is now free; long-term motion is still missing, and the other two modules exist to recover it.",
      ],
      takeaways: [
        "Sparse sampling does the long-range work: the 3T frames are one per segment across the whole clip, so eight grouped images cover all five seconds of an RWF-2000 video rather than a contiguous slice.",
        "Greyscale conversion is a three-to-one data reduction before the network starts, on the paper's argument that motion matters more than colour for this task.",
        "Nothing here is learned. Frame-grouping is fixed preprocessing, which is why it costs nothing and why it cannot adapt to a clip where the action is slower or faster than three frames.",
      ],
      visual: {
        kind: "volume-grid",
        options: {
          hue: 275,
          size: [7, 5, 3],
          mode: "kernel",
          kernel: [3, 3, 3],
          // No 2D/3D toggle here. The control's built-in copy argues that a 2D
          // kernel "sits inside one frame", which is the 3D-convolution case --
          // and the exact claim frame-grouping exists to sidestep.
          interactive: false,
        },
        caption:
          "Three consecutive greyscale frames stacked into one image's colour channels. The kernel sliding through spans all three at once — which is what frame-grouping buys: a 3×3×3 reach from a 2D convolution. Depth here is three because that is the group size the paper fixes, not a parameter it sweeps.",
      },
      pdfPage: 7,
    },

    {
      id: "both-directions",
      title: "Motion as a difference, computed both ways",
      tagline: "Bi-LTMA direction (T3)",
      highlight: {
        label: "Second direction",
        value: "+2.00",
        note: "87.75% → 89.75% on RWF-2000, channel-only in both rows",
      },
      note: [
        "Bi-LTMA's motion signal is a subtraction. Reduce the channels by half, map the feature through a 3 x 3 convolution to absorb misalignment, and take the difference between adjacent time steps. The published module this is built from -- ME, from TEA [41] -- does that in one direction only, forward.",
        "This paper computes both: F_r(t+1) - F_r(t) and F_r(t) - F_r(t+1). Each becomes its own sigmoid-gated map, and the two are averaged with fixed equal weights into the attention map that gets applied. T3 measures what the second pass is worth while holding everything else fixed, and 2.00 points is a large answer for a change that adds one convolution branch.",
        "Why it should help is intuitive and the paper does not spell it out: a forward difference marks where something is about to be, a backward difference marks where it just was. A punch leaves both, and gating on their average keeps the whole trajectory rather than its leading edge.",
      ],
      takeaways: [
        "The 87.75% row is ME as published, reimplemented here as the comparison point -- not a strawman the authors invented.",
        "At the last time step both differences are defined as zero, so the final grouped image of every clip is gated by an all-zero map and passes through on the residual term alone.",
        "The two directions are merged with hardcoded 0.5/0.5 weights. Whether a learned weighting would do better is not tested.",
      ],
      visual: {
        kind: "two-stream-flow",
        options: {
          hue: 275,
          mode: "streams",
          join: "sum",
          // T3, p14. Both rows hold the channel-only setting fixed and differ
          // only in whether the backward difference is computed, so `flow` --
          // the backward branch alone -- has no number and must stay absent.
          //
          // `bidirectional-sequence` would have been the obvious visual and is
          // the wrong one: it hardcodes a "frames before a verdict" readout
          // built for a backward *recurrence*, which cannot emit anything until
          // the clip ends. A backward difference only needs t and t+1, so that
          // latency claim is false here.
          accuracy: { rgb: 87.75, both: 89.75 },
          labels: { rgb: "forward difference", flow: "backward difference" },
          copy: {
            chips: {
              rgb: "forward only",
              flow: "backward only",
              both: "both ways",
            },
            backbone: "Conv2 3×3 over the reduced feature",
            join: "average with fixed weights · A = 0.5W_f + 0.5W_b",
            output: "sigmoid-gated attention map A, applied by Hadamard product",
            readout: "RWF-2000 accuracy",
            deltaLabel: "vs forward only",
            lines: {
              rgb: "One difference per step, forward: F_r(t+1) − F_r(t). This is the ME module of TEA reimplemented as the comparison point, and T3 puts it at 87.75%.",
              flow: "The backward branch on its own. The paper never runs it, so there is no number — only the pair and the forward lane alone were measured.",
              both: "Both differences, each through its own sigmoid, averaged with hardcoded equal weights. T3 puts it at 89.75% — the single largest gain in the paper's design ablation.",
            },
          },
        },
        caption:
          "Two lanes over the same reduced feature, differing only in the sign of the subtraction. Both configurations shown are channel-only, matching T3's first two rows; the spatial dimension arrives in the next concept. Neither lane is a separate input stream — they are two reads of one tensor, which is why the backward lane costs almost nothing.",
      },
      pdfPage: 9,
    },

    {
      id: "what-the-gate-varies-over",
      title: "What the gate is allowed to vary over",
      tagline: "Bi-LTMA dimensions and fusion (T3, T4)",
      highlight: {
        label: "Residual shortcut",
        value: "+2.50",
        note: "T4: 87.75% → 90.25%, worth more than the bidirectional design",
      },
      note: [
        "ME pools the spatial dimensions away before gating, so every position on a channel gets the same weight. Bi-LTMA keeps H and W, so the map varies over position and channel at once. T3 prices that at 0.50 points -- real, and a quarter of what the second direction was worth.",
        "The more interesting number is in T4, which ablates how the gate is applied rather than how it is computed. The bare Hadamard product A (.) F scores 87.00, below the model's own no-attention baseline of 87.50. Adding DropConnect recovers it to 87.75. Only the residual shortcut, F' = F + G(A (.) F), reaches 90.25.",
        "So the gate is worth 2.50 points more when it cannot suppress anything. With the residual term a weight of zero leaves the feature exactly as it was, and the module can only add. Applied multiplicatively -- allowed to attenuate -- it is worse than not attending at all. That is a caution about reading the Grad-CAM panels as evidence that the model discards the rest of the frame; it does not discard, it amplifies.",
      ],
      takeaways: [
        "T3's three rows are channel-only (87.75), plus bidirectional (89.75), plus spatial (90.25). The spatial dimension alone was never run, so what it is worth without the second direction is unknown.",
        "T4's three rows are the gate applied bare (87.00), with DropConnect (87.75), and residually (90.25). The first is below the model's own 87.50 baseline from T2.",
        "Every row in both tables already contains EfficientNet-B0's built-in Squeeze-and-Excitation channel attention, which is never ablated. These are gains on top of channel attention, not gains from adding it.",
      ],
      visual: {
        kind: "attention-map",
        options: {
          hue: 275,
          gridSize: [5, 5],
          channels: 4,
          combine: "sum",
          residual: true,
          // T3, p14. `spatial` is deliberately absent: the spatial dimension was
          // never run without the bidirectional architecture, so there is no
          // number for it alone and the readout should say so.
          effect: { channel: 87.75, both: 90.25 },
          copy: {
            readout: "RWF-2000 accuracy",
            branchLabel: "Gate varies over",
            lines: {
              spatial:
                "Position only, flat across channels. The paper never runs this configuration, so the readout has no number to show for it.",
              channel:
                "Channel only, flat across the frame — the spatial dimensions pooled away, as ME does. T3's first row, 87.75%.",
              both:
                "One map varying over position and channel together, not two branches summed. T3's last row, 90.25%. The residual term means the smallest weight still passes the original feature through unchanged.",
            },
          },
        },
        caption:
          "Bi-LTMA produces a single T×C×H×W map rather than two branches that get merged, so read the 'both' state as the shipped module and the other two as what it would collapse to if a dimension were pooled away. Cell size is the gain a feature receives; with the residual term of Eq. 6 the smallest cell is still the original feature. Mask shapes are illustrative — the paper publishes Grad-CAM heatmaps (F9) but no attention maps.",
      },
      pdfPage: 9,
    },

    {
      id: "where-the-cost-is",
      title: "Four fifths of the budget goes to one module",
      tagline: "Cost accounting (T2)",
      highlight: {
        label: "Bi-LTMA's share of compute",
        value: "81%",
        note: "0.98 of the model's 1.21 GFLOPs, for 1.00–1.75 points",
      },
      note: [
        "T2 runs all eight combinations of the three additions and prints GFLOPs and parameters beside each accuracy, which makes the cost attributable to the row rather than to the paper.",
        "TSM and the auxiliary classifier are genuinely free. Every row without Bi-LTMA reads 0.23 GFLOPs and 4.26 M parameters, whether one, both or neither of them is switched on -- the shift has no weights and costs nothing measurable, and the auxiliary head is deleted before inference. Together they are worth 1.75 points for nothing.",
        "Bi-LTMA costs 0.98 GFLOPs and 0.22 M parameters, taking the model from 0.23 to 1.21. It is the most valuable single module and it is also 81% of the compute the paper advertises. Which reframes the headline: the thing that makes this model the cheapest in T8 is not Bi-LTMA, it is everything Bi-LTMA was added to.",
        "The practical reading is the 0.23 GFLOPs configuration. Backbone plus TSM plus auxiliary head reaches 89.25% -- one point below the full model, at a fifth of the cost, and still above every other entry in T8.",
      ],
      takeaways: [
        "0.23 → 1.21 GFLOPs and 4.26 → 4.48 M parameters is the entire difference between the model with and without its proposed module.",
        "The 89.25% at 0.23 GFLOPs would beat all thirteen comparison models in T8 on RWF-2000 while costing 5% of the next-cheapest one.",
        "Parameters and FLOPs move almost independently here: Bi-LTMA adds 5% more weights and 5× more compute, because its cost is in the per-position convolutions it runs, not in what it stores.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          mode: "architecture",
          hue: 275,
          baselineId: "baseline",
          // T2, p13. Parameter counts are the table's own; the per-module split
          // is 4.48 M − 4.26 M = 0.22 M for Bi-LTMA, and zero for the other two,
          // which is what the identical rows in T2 report.
          models: [
            {
              id: "baseline",
              label: "EfficientNet-B0",
              blocks: [
                {
                  label: "EfficientNet-B0, 9 stages",
                  params: 4260000,
                  trained: true,
                  note: "0.23 GFLOPs, 87.5% on RWF-2000 — already contains Squeeze-and-Excitation in every MBConv block",
                },
              ],
            },
            {
              id: "free",
              label: "+ TSM + auxiliary head",
              blocks: [
                {
                  label: "EfficientNet-B0, 9 stages",
                  params: 4260000,
                  trained: true,
                  note: "unchanged backbone",
                },
                {
                  label: "TSM ×7 stages",
                  params: 0,
                  trained: false,
                  note: "channel shift on the residual branch — no weights, no measurable FLOPs",
                },
                {
                  label: "auxiliary head after stage 7",
                  params: 0,
                  trained: true,
                  note: "trained but discarded at inference, so it costs nothing at test time",
                },
              ],
            },
            {
              id: "full",
              label: "+ Bi-LTMA (full model)",
              blocks: [
                {
                  label: "EfficientNet-B0, 9 stages",
                  params: 4260000,
                  trained: true,
                  note: "unchanged backbone",
                },
                {
                  label: "TSM ×7 stages",
                  params: 0,
                  trained: false,
                  note: "still free",
                },
                {
                  label: "auxiliary head after stage 7",
                  params: 0,
                  trained: true,
                  note: "still discarded at inference",
                },
                {
                  label: "Bi-LTMA ×7 stages",
                  params: 220000,
                  trained: true,
                  note: "0.98 of the model's 1.21 GFLOPs — 81% of the compute for 5% of the weights",
                },
              ],
            },
          ],
        },
        caption:
          "Block size is parameter count, from T2. The compute story does not follow it: the two modules that add no parameters also add no FLOPs, while the one that adds 5% more weights adds five times the compute. T2's accuracies for these three rows are 87.5%, 89.25% and 90.25%.",
      },
      pdfPage: 13,
    },

    {
      id: "camera-arithmetic",
      title: "Real-time, and what the paper means by it",
      tagline: "Inference time (T7)",
      highlight: {
        label: "Decision latency",
        value: "960 ms",
        note: "the paper's own accepted figure, not a measured one",
      },
      note: [
        "T7 is better evidence than most of the library manages: three devices, four datasets, per-clip times, and an explicit derivation from them rather than the word \"real-time\" left to do the work.",
        "The derivation is worth following. On RWF-2000 the CPU takes 323.3 ms per clip, so about three inferences per second; the paper accepts a 960 ms latency budget and concludes one desktop can serve three 25 fps cameras. The 2080Ti takes 22.6 ms, so 40 inferences per second and 40 cameras at the same latency.",
        "The 960 ms is the part to notice. It is not measured -- it is chosen, and it follows from the design rather than the hardware. Each inference consumes a whole clip, so however fast the forward pass is, the system cannot decide anything about a clip until the clip exists. Model latency and time-to-alert are different quantities, and only the first is in T7.",
        "What T7 does not cover is the rest of the pipeline. Decoding the video, sampling 24 frames from it, converting them to greyscale and grouping them are all real work and none of it is timed. They are cheap enough that the conclusion almost certainly survives, but the number supporting the camera count is the forward pass alone.",
      ],
      takeaways: [
        "Three devices, all desktop-class. The paper calls them edge servers; no embedded board appears anywhere in the experiments.",
        "GPU generation barely matters: 22.6 ms on a 2080Ti against 20.1 ms on a 3080Ti. The model is small enough that neither card is working hard.",
        "The CPU is 14× slower than the GPU, and the CPU figure is the one that decides whether this runs anywhere without an accelerator.",
      ],
      visual: {
        kind: "throughput-budget",
        options: {
          hue: 275,
          budgetSeconds: 1,
          // T7, p16. RWF-2000 clips are 150 frames. The paper never gives the
          // dataset's frame rate, so 5 s is RWF-2000's own documented duration
          // rather than anything this paper states; the input rates on the chip
          // row are the 25 fps its camera arithmetic assumes, plus 30.
          clipSeconds: 5,
          frameRates: [25, 30],
          stages: [
            {
              id: "forward",
              label: "improved EfficientNet-B0 forward pass",
              perClip: 0.3233,
              countedInClaim: true,
              note: "323.3 ms per clip on the Intel i7-8700 CPU — the only figure behind the three-camera claim. On an RTX 2080Ti the same clip takes 22.6 ms.",
            },
          ],
          copy: {
            readout: "CPU compute per second of video",
            scopeLabel: "Counting",
            rateLabel: "Input frame rate",
            chips: { claimed: "forward pass only", full: "whole pipeline" },
            lines: {
              claimed:
                "The forward pass on the desktop CPU, which is the whole of T7. Even here it fits inside the budget with room to spare — the model is genuinely cheap.",
              full: "Identical, because there is nothing to add. Decoding, sparse sampling, RGB2Gray and frame-grouping are never timed, so the gap between these two rows is unmeasured rather than zero.",
            },
          },
        },
        caption:
          "One second of video against the compute owed for it, on the CPU — the hardest of the three devices in T7. The forward pass fits comfortably at both frame rates, which is the paper's point. What it does not show is time-to-alert: a clip has to finish before it can be classified, and the paper budgets 960 ms for that separately.",
      },
      pdfPage: 16,
    },

    {
      id: "the-comparison-and-its-caveat",
      title: "It wins the hard dataset — and picked its own hyperparameter on it",
      tagline: "Comparison and protocol (T8, T5)",
      highlight: {
        label: "RWF-2000 margin",
        value: "+1.00",
        note: "90.25% against V011's 89.25%, the best of thirteen comparisons",
      },
      note: [
        "T8's arithmetic is honest, which is rarer than it should be. Every margin the text claims survives checking against the table it sits beneath: 1.21 GFLOPs really is 28% of the next lowest, 4.48 M really is third, +1.00 on RWF-2000, -0.50 on Hockey and -0.83 on Surveillance Camera are all correct. Nothing is rounded in the paper's favour.",
        "The result itself is also the right shape. On the three easy datasets this model is second or third; on RWF-2000, the only one built from real surveillance footage, it is first. A cheap model that ranks best where the data is hardest is a more interesting claim than one that tops a saturated benchmark.",
        "The caveat is the protocol. T5 sweeps lambda over nine values on RWF-2000 and reports the best, 90.25% at lambda = 0.5. T2 chooses the module combination on RWF-2000. T3 and T4 choose Bi-LTMA's design on RWF-2000. RWF-2000 has one published split and no third partition, so every one of those choices was made by looking at the number that then became the headline.",
        "That does not make the model worse than its rivals -- several of them will have done the same -- but it does mean the +1.00 margin is a selected-best figure against reported figures, and a genuine held-out gap would be smaller by an unknown amount.",
      ],
      takeaways: [
        "The model it beats on RWF-2000 by 1.00 is V011, the same paper it takes frame-grouping from.",
        "Nine lambda values were swept on the test set; the best became the abstract. There is no partition in the paper that was not used for selection.",
        "No cross-dataset test exists, so nothing here says whether the ranking survives a change of camera estate.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          mode: "outcome",
          hue: 275,
          baselineId: "ours",
          metricLabel: "Accuracy",
          datasetLabel: "Dataset",
          // T8, p17. Six of the fourteen rows: this model, the two nearest 2D
          // competitors, and the three 3D models that beat it somewhere. A dash
          // in T8 means the paper reports nothing there, so those cells are
          // omitted rather than filled.
          datasets: [
            { id: "rwf", label: "RWF-2000", title: "2000 real surveillance clips — the only one built from CCTV", floor: 50, floorLabel: "coin flip on a balanced set" },
            { id: "hockey", label: "Hockey Fight", title: "1000 NHL broadcast clips, single scenario", floor: 50, floorLabel: "coin flip on a balanced set" },
            { id: "surveillance", label: "Surveillance Camera", title: "300 clips from YouTube and surveillance cameras", floor: 50, floorLabel: "coin flip on a balanced set" },
            { id: "movies", label: "Movies", title: "200 film clips — saturated, seven models reach 100%", floor: 50, floorLabel: "coin flip on a balanced set" },
          ],
          models: [
            {
              id: "ours",
              label: "This paper",
              metrics: {
                rwf: { accuracy: 90.25 },
                hockey: { accuracy: 98.5 },
                surveillance: { accuracy: 91.67 },
                movies: { accuracy: 100 },
              },
            },
            {
              id: "v011",
              label: "Efficient Spatiotemporal (V011)",
              metrics: {
                rwf: { accuracy: 89.25 },
                hockey: { accuracy: 99.0 },
                surveillance: { accuracy: 92.0 },
                movies: { accuracy: 100 },
              },
            },
            {
              id: "tsm2",
              label: "Two-cascade TSM",
              metrics: {
                rwf: { accuracy: 87.75 },
                hockey: { accuracy: 97.5 },
              },
            },
            {
              id: "vdnet",
              label: "VD-Net (V004)",
              metrics: {
                hockey: { accuracy: 98.5 },
                surveillance: { accuracy: 92.5 },
                movies: { accuracy: 99.0 },
              },
            },
            {
              id: "i3d",
              label: "I3D (RGB)",
              metrics: {
                rwf: { accuracy: 85.75 },
                hockey: { accuracy: 98.5 },
                surveillance: { accuracy: 84.67 },
                movies: { accuracy: 100 },
              },
            },
            {
              id: "c3d",
              label: "C3D",
              metrics: {
                rwf: { accuracy: 82.75 },
                hockey: { accuracy: 96.0 },
                movies: { accuracy: 100 },
              },
            },
          ],
        },
        caption:
          "Six of T8's fourteen rows. The ordering inverts with difficulty: on Movies and Surveillance Camera this model is mid-table, and on RWF-2000 — the only set built from real CCTV — it is first, at between 1% and 3% of the compute of the 3D models beside it. Missing lanes are cells T8 leaves blank.",
      },
      pdfPage: 17,
    },
  ],
};
