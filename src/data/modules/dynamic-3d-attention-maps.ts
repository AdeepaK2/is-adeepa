import type { StudyModule } from "@/types/study";

/**
 * Varghese, Elzein, Yang & Qaraqe (2025), "A temporal-spatial deep learning
 * framework leveraging dynamic 3D attention maps for violence detection".
 * Neural Computing and Applications 37(32):26689-26709.
 *
 * Review extraction and study module.
 *
 * Table map, for anyone checking the numbers against the PDF:
 *   T1 p9   sample annotation table (MSV)      T3 p11 accuracy/mAP by n and d
 *   T2 p10  the five datasets                  T4 p14-15 comparison with prior work
 *
 *   F1 p2  motivating misclassifications   F6  p12 inference time and throughput
 *   F2 p5  network architecture            F7  p13 benchmark top-1 accuracy
 *   F3 p6  attention-map generation        F8  p16 attended regions, n = 2
 *   F4 p8  MSV class samples               F9  p17 Grad-CAM, n = 2 and n = 3
 *   F5 p11 confusion matrices              F10 p17 effect of the global feature
 *   Algorithm 1 p7                         F11 p17 accuracy by backbone
 *
 * Caution on T4: its "Proposed" rows extract with adjacent cells fused --
 * n=2,d=4 reads as "100 91 .89 5 9 6 .5 85". The split used below is
 * 100 / 91.8 / 95 / 96.5 / 85, which is confirmed independently: the MSV column
 * of every Proposed row matches T3's accuracy column exactly (77.2, 75, 85,
 * 82.28, 82.54, 81).
 *
 * Several quantities the rest of this library records are simply absent here:
 * no parameter count, no FLOPs, no model size, no memory figure, and no test
 * partition distinct from the validation set every number is reported on.
 */
export const moduleDynamic3dAttentionMaps: StudyModule = {
  slug: "dynamic-3d-attention-maps",

  premise:
    "Every other attention paper in this library weights features it has already computed. This one crops. Small networks regress the corners of a cuboid in space and time -- where to look, when, and for how long -- the video is physically cut there, and only those cuboids plus one global view reach the classifier. Nothing supervises the cropping: the boxes are learned from the clip label alone. It is the most interesting attention mechanism in the corpus and the thinnest evaluation of one, reporting no parameter count, no FLOPs, and no test set separate from the set every headline number is measured on.",

  results: [
    { label: "MSV", value: "85.0%", note: "top-1 on the authors' own 4-class dataset, n=2 d=4 (T3)" },
    { label: "Hockey Fight", value: "100%", note: "T4 — and again at n=3, d=4" },
    { label: "Violent Flows", value: "95.0%", note: "T4 — below Qaraqe et al.'s 98.5 in the same table" },
    { label: "Throughput", value: "79.1 fps", note: "F6, RTX 3090 Ti at batch size 4; 3.8 fps on CPU" },
  ],

  review: {
    architecture: {
      family: "3D CNN",
      backbone:
        "Three separate residual CNN backbones with distinct jobs, plus a classifier. A global backbone -- a 3D CNN pre-trained on Kinetics-400 -- consumes the whole clip and produces one context vector f_g. Each of n attention prediction networks is its own 3D CNN followed by two sigmoid-activated linear layers. Each cropped cuboid then goes through its own dedicated local backbone f_Li. The fused volume is classified by a 2D convolution feeding a pre-trained ResNet-18 and a dense head. The paper says only \"residual CNN\" for the first three throughout, and never states which one produced T4 -- F11 (p17) compares R(2+1)D, ResNet3D, transformer and LSTM+attention variants and reports R(2+1)D best at 85%, matching T3's headline, which is the strongest available hint but not a statement.",
      motionEncoding:
        "3D convolution, twice over, at two scales. The global path runs 3D kernels across the entire clip. The local path runs them across a learned sub-volume: each APN regresses five numbers (t_x, t_y, t_z, t_lx, t_ly) -- a centre in space and in time, and two spatial half-widths -- and the temporal extent is the fixed hyperparameter d, so the extracted patch spans 2d frames of the clip at a position the network chose. Motion inside the attended window is therefore modelled by convolution, while which window to model is modelled by regression. No optical flow, no skeletons, no recurrence; the paper makes \"eliminating auxiliary data\" an explicit contribution against the two-stream and pose-based work it reviews.",
      inputs: [
        "RGB clips as a tensor B x T x C x H x W, mean/std normalised. T is per-dataset: 20 frames for MSV, SCF and RLV, 16 for Hockey Fight, 11 for Violent Flows",
        "Training samples are fixed 2-second windows -- MSV is resampled to 10 fps, so 20 frames -- cut with a sliding window at stride 10 and capped at 200 samples per annotated instance",
        "Training augmentation is random scaling then a 224 x 224 random crop; at inference frames are resized to 256 x 256 and centre-cropped to 224 x 224",
        "Extracted cuboids are bilinearly resized to 224 x 224 regardless of the size they were cropped at",
      ],
      fusion:
        "A volumetric tensor V in R^(B x N x N x N) whose every voxel is the plain average of one local feature from each APN and the global feature: V_(b,i,j,k) = (1/(n+1))(f_1^(b,i) + f_2^(b,j) + f_g^(b,k)), with the symmetric permutations of (i, j, k) all filled with the same value so the representation is invariant to which APN found which region. The result is passed to a 2D convolution and a ResNet-18. The construction is unusual and expensive-looking -- it materialises an N-cubed tensor to hold what n+1 feature vectors already contain -- and N is never given a value, nor is the memory or compute it implies ever reported.",
      supervision:
        "Fully supervised end to end on clip labels alone, categorical cross-entropy, 150 epochs. The three backbones use SGD with cosine annealing at momentum 0.9 and an initial learning rate of 0.01; the classification module uses Adam. Two or four classes depending on the dataset. No box, region or frame annotation is used anywhere: the APNs learn where and when to look purely from the gradient of the clip-level loss, which is the paper's most substantial claim.",
      notes: [
        "The framing is scale, not just attention. The paper's opening argument is that violence occupies a small fraction of the frame and of the clip, and that a model averaging over the whole video dilutes it -- F1 (p2) shows two clips misclassified because the fight is at the edge of the frame. The cuboid is the response: crop first, classify second.",
        "Section 3.2 says training is end to end \"using the Adam optimizer with a fixed learning rate\"; section 4.2.1 says the backbones use SGD with cosine annealing and Adam is for the classification module only. Both cannot be right. Section 4.2.1 is the more specific and is the one recorded above.",
        "The classifier's output activation is given as sigmoid (§4.2.1), while §3.2 describes a fully connected head mapping to class logits. On four-class MSV a sigmoid head is not what a categorical cross-entropy normally sits on, and the paper does not explain the combination.",
        "The APN's temporal extent is not learned. t_z chooses when, but the depth 2d is a hyperparameter fixed per run, so \"how long to observe\" -- one of the three things the abstract claims the model learns -- is set by the experimenter and swept in T3 rather than predicted. Where and when are learned; how long is not.",
      ],
    },

    attention: {
      used: true,
      kinds: ["spatial", "temporal"],
      mechanisms: [
        {
          name: "Dynamic 3D attention prediction network (APN)",
          placement:
            "In parallel with the global backbone, n of them, each seeing the whole input tensor. Each is a 3D CNN plus two sigmoid-activated linear layers regressing (t_x, t_y, t_z, t_lx, t_ly); the coordinates are scaled to frame dimensions, clamped to valid bounds, and the cuboid between them physically sliced out of the video (Eqs. 2-4, Algorithm 1, p7). Each cuboid then has its own local backbone.",
          reportedEffect:
            "T3, on MSV at d = 4: one APN gives 77.2% accuracy and 79.5 mAP, two give 85.0% and 86.3, three give 82.54% and 82.9. The 7.8-point jump from one to two is the paper's central experimental result. A one-way ANOVA over n in {1, 2, 3} gives F(2,3) = 12.662, p = 0.0345 for accuracy and F(2,3) = 9.013, p = 0.0539 for mAP.",
        },
        {
          name: "Global context path",
          placement:
            "A Kinetics-400 pre-trained 3D residual backbone over the uncropped clip, fused with the local features at every voxel of V (Eq. 6).",
          reportedEffect:
            "Ablated in F10 (p17) with and without f_g on MSV. The paper reports that including it \"notably contributes to the robust stratification of violent patterns\" but prints the result as a figure and quotes no number for it in the text, so the size of the contribution cannot be read off the article.",
        },
      ],
      notes: [
        "This is hard attention, and the distinction from everything else in the library is the point. A CBAM or a Bi-LTMA gate re-weights features that have already been computed, so nothing is discarded and a weight of zero still leaves the tensor intact. Here the crop is executed: pixels outside the cuboid are not down-weighted, they are absent from the local path entirely, and the only thing standing between the model and a missed region is the global branch running alongside.",
        "It is also a learned crop, which is what separates it from the fixed spatiotemporal crop of V001. There the window is a hand-set augmentation prior; here five numbers are predicted per clip per APN from the input itself. That is attention by any reasonable definition even though no softmax appears anywhere in it.",
        "There is no channel attention and no self-attention. The comparison against ViT, ViViT, Video Transformer and Video Swin in T4 is a comparison against those mechanisms, not an adoption of them.",
        "The ANOVA supporting n = 2 rests on six observations. F(2,3) means three groups and three residual degrees of freedom -- the two d values at each n -- which is the smallest sample that permits the test at all. The mAP result at p = 0.0539 does not clear the 0.05 threshold the paper itself names, and is described as \"marginally significant\" and then as empirical support.",
      ],
    },

    efficiency: {
      parameters: undefined,
      flops: undefined,
      modelSize: undefined,
      throughput:
        "F6 (p12), on MSV: 79.1 fps on the GPU and 3.8 fps on the CPU, both at batch size 4, with inference time stated as under one second for both. The figures are plotted rather than tabulated, so no exact per-configuration values appear in the text. Note that the GPU and CPU figures cannot both be reconciled with the one-second statement: a batch of four 20-frame samples is 80 frames, which is about 1.0 s at 79.1 fps but about 21 s at 3.8 fps.",
      hardware:
        "NVIDIA GeForce RTX 3090 Ti for training and GPU inference; AMD Ryzen Threadripper 3960X, 24 cores, for the CPU figure. Both are workstation-class. No embedded or edge hardware is used anywhere in the paper.",
      realTime: {
        status: "measured-and-supported",
        note: "The claim is specifically GPU real-time -- \"with dedicated GPU acceleration, the framework can efficiently handle real-time video streams\" -- and 79.1 fps supports it against any surveillance frame rate, including the 10 fps MSV is resampled to, with roughly eight times the headroom. The paper is also careful not to overclaim the CPU side, noting that \"performance varies on CPU-only configurations\" rather than calling 3.8 fps real-time. Two qualifications: the number is a clip-classification throughput on pre-trimmed two-second samples, so it says nothing about time-to-alert on continuous footage, and the CPU figure contradicts the same sentence's one-second inference-time claim.",
      },
      edgeDeployment: {
        status: "not-addressed",
        note: "No edge or embedded deployment is claimed, attempted or measured. The word \"edge\" appears in the paper only in the phrase \"edge cases\" and in two reference titles. The closest thing to a claim is a future-work sentence about \"paving the way for broader deployment across city-scale and resource-constrained environments\", which is an aspiration for later work rather than a statement about this model.",
      },
      notes: [
        "This is the thinnest efficiency accounting in the library. There is no parameter count, no FLOPs figure, no model size and no memory number anywhere in the article -- only a throughput plot and a sentence about inference time. For an architecture that runs n+2 separate deep backbones per clip and materialises an N-cubed fusion tensor, the absence is conspicuous rather than incidental.",
        "The design's cost scales with n by construction: each additional APN adds both an attention backbone and a local feature backbone. So the paper's own finding that n = 2 beats n = 3 is convenient -- the best configuration is also the cheaper one -- but no measurement is offered for what either costs, which is exactly the comparison that would make the finding actionable.",
        "N, the side length of the fusion tensor V, is never assigned a value. Since V is B x N x N x N and is built by populating symmetric permutations, its memory grows cubically in a quantity the reader cannot see.",
        "Nothing outside the network forward pass is timed. Decoding, resizing to 256, centre-cropping, and the bilinear resize applied to each extracted cuboid are all part of what has to run per clip and none of them appear in F6.",
      ],
    },

    evaluation: {
      datasets: [
        {
          name: "MSV",
          role: "evaluation",
          note: "The authors' own multi-scale violence dataset, introduced here: 1413 videos, about 30 hours, YouTube-sourced by crawling for violence, demonstration and clash, plus footage of the Capitol riot, Hong Kong protests and George Floyd protests. Four classes -- Fighting, Natural, Large Violent Gathering, Large Peaceful Gathering -- annotated as time segments rather than whole-video labels (T1, p9). Class counts are 523 / 405 / 113 / 372, so Large Violent Gathering is a fifth the size of the largest class.",
        },
        {
          name: "Hockey Fight",
          role: "evaluation",
          note: "1000 clips, 16 frames sampled. Reported at 100% for both n = 2 and n = 3 in T4.",
        },
        {
          name: "Crowd Violence",
          role: "evaluation",
          note: "The paper's \"violent flows (VF)\": 246 videos, about 14 minutes, 11 frames sampled. This is the dataset where T4 shows the model losing to a prior method.",
        },
        {
          name: "Surveillance Camera Fight",
          role: "evaluation",
          note: "300 videos, about 11 minutes, 20 frames sampled. Also the source of 150 fight-labelled videos that were re-annotated into MSV, so the two sets are not independent.",
        },
        {
          name: "RLVS",
          role: "evaluation",
          note: "The paper's \"real life violence (RLV)\": 2000 videos, 20 frames sampled.",
        },
        {
          name: "Kinetics-400",
          role: "pre-training",
          note: "Weights only, for the global 3D CNN backbone. No Kinetics result is reported. ResNet-18 in the classifier is also described as pre-trained, without a source.",
        },
        {
          name: "UBI-Fights",
          role: "mentioned-only",
          note: "216 fight-labelled videos were taken from it and re-annotated into MSV. It is never evaluated on as a dataset in its own right, so no UBI-Fights number exists here to compare against V008's or V018's.",
        },
      ],
      split:
        "Each dataset split 8:2, described as train and validation and stated to be disjoint. Training draws fixed 2-second sliding-window samples; validation instead feeds whole videos one at a time at batch size 1, so evaluation runs on complete sequences rather than on the trimmed samples the model was trained on. There is no third partition -- the phrase \"test set\" does not occur in the paper.",
      metrics: [
        "Top-1 accuracy",
        "mAP (MSV only, T3)",
        "Per-class accuracy via confusion matrices (F5, p11)",
        "One-way ANOVA over the number of APNs",
        "Throughput in fps and inference time in seconds (F6)",
      ],
      protocolNotes: [
        "Every number in the paper is a validation number, and the validation set is what the configuration was chosen on. T3 sweeps n and d on MSV and selects n = 2, d = 4; F11 sweeps four backbone families on MSV; F10 ablates the global path on MSV. The winning configuration then supplies the headline 85% on MSV and all four benchmark figures in T4. With no held-out partition, the reported accuracies are selected-best figures rather than clean out-of-sample ones.",
        "The paper's claim to beat prior work is contradicted by its own T4 on two of five datasets. The text says the approach \"consistently provided better performance than existing methods\" and \"invariably outperformed the current methods\". T4 gives the proposed model 95.0 on Violent Flows against Qaraqe et al.'s 98.5, and 85.0 on MSV against the same method's 88.89. Wins on Hockey Fight (100 vs 98.8), Surveillance Camera Fight (91.8 vs 91.7) and RLVS (96.5 vs 96.25) are real but two of them are margins of 0.1 and 0.25. Note also that the method beating it on both columns shares an author with this paper.",
        "100% on Hockey Fight, reported for two separate configurations, deserves the scepticism any perfect score does -- particularly on a 1000-video single-scenario benchmark evaluated on a 200-video validation split with no independent test partition.",
        "Accuracy and mAP are the whole of the classification reporting. There is no precision, recall, F1, ROC or AUC anywhere, so the false-alarm behaviour that decides whether a surveillance alarm is usable cannot be read out -- the confusion matrices in F5 are the only route to it, and they cover MSV configurations only.",
        "MSV is moderately imbalanced (523 / 405 / 113 / 372) and top-1 accuracy is the headline metric on it, which flatters a model on the three larger classes; the paper acknowledges the imbalance and the bias it may introduce.",
        "The central contribution is evaluated only qualitatively. The claim is that the model learns where, when and for how long to attend, and the evidence for it is F8 and F9 -- drawn boxes and Grad-CAM heatmaps on hand-picked MSV clips. No localisation metric is computed: no IoU against annotated regions, no temporal AP, nothing that would show the cuboids land on the violence more often than chance. Accuracy improving with n is consistent with the mechanism working, but does not demonstrate that the boxes are where the paper says they are.",
        "Both the motivation and the dataset are built around untrimmed video and small localised events, yet all reported metrics are whole-video or whole-clip classification. MSV's segment-level annotations (T1) would support a localisation evaluation and none is run.",
        "No cross-dataset test. Every figure is train and validate within one dataset.",
        "Realism is mixed and mostly favourable: MSV and RLVS are YouTube-sourced, Surveillance Camera Fight and Crowd Violence are surveillance or crowd footage, and only Hockey Fight is broadcast sport. MSV's protest and riot footage is closer to the crowd-scale scenario the paper targets than anything else in the library.",
      ],
    },
  },

  concepts: [
    {
      id: "the-cuboid",
      title: "Attention that cuts rather than weights",
      tagline: "The APN (§3.1, Algorithm 1)",
      highlight: {
        label: "What each APN predicts",
        value: "5 numbers",
        note: "t_x, t_y, t_z, t_lx, t_ly — a centre in space and time, and two half-widths",
      },
      note: [
        "Every other attention mechanism in this library computes a feature map and then multiplies it by a mask. Nothing is thrown away: a weight of zero still leaves the tensor there, and downstream layers can recover from a bad mask.",
        "This one runs a small 3D CNN over the clip, ends it in two sigmoid layers, and reads off five numbers: where in the frame, when in the clip, and how wide. Those numbers are scaled to pixel and frame indices, clamped to the video's bounds, and the cuboid between them is sliced out and resized to 224 x 224. The rest of the video never reaches the local backbone. It is not down-weighted; it is gone.",
        "That is a strong bet, and the architecture hedges it in one place only: a global backbone runs over the uncropped clip in parallel, so whatever the crops miss can still arrive through the context vector. Ablating that hedge is F10, and the paper reports it as helping without printing a number.",
        "The name over-promises slightly. The abstract says the model learns where, when and for how long to attend; t_z learns when, but the depth 2d is a hyperparameter the experimenter fixes and T3 sweeps. Two of the three are learned.",
      ],
      takeaways: [
        "The cuboid spans 2d frames — d = 4 in the winning configuration, so 8 of a 20-frame MSV clip.",
        "Nothing supervises the box. No region or frame annotation is used; the five coordinates are shaped entirely by the gradient of the clip-level classification loss.",
        "Every crop is resized to 224 x 224 whatever size it was cut at, so a small tight box and a large loose one arrive at the local backbone looking the same scale.",
      ],
      visual: {
        kind: "volume-grid",
        options: {
          hue: 358,
          // 20 frames deep: the MSV sampling rate of 10 fps over a 2 s window.
          // The kernel stands in for the extracted cuboid, 2d = 8 frames deep at
          // the paper's d = 4. Spatial extent is illustrative -- t_lx and t_ly
          // are predicted per clip and the paper reports no typical value.
          size: [7, 5, 20],
          mode: "kernel",
          kernel: [3, 3, 8],
          interactive: false,
        },
        caption:
          "A 20-frame clip as a spatiotemporal volume, with the attended cuboid moving through it. Depth is 8 frames because d = 4; the spatial extent is illustrative, since the half-widths are regressed per clip and no typical size is reported. In the shipped model two of these run at once, each with its own backbone.",
      },
      pdfPage: 6,
    },

    {
      id: "how-many-places",
      title: "Two places to look, and the case for stopping there",
      tagline: "Sweeping n and d (T3)",
      highlight: {
        label: "One APN → two",
        value: "+7.8",
        note: "77.2% → 85.0% on MSV at d = 4; three gives 82.54%",
      },
      note: [
        "T3 is the paper's central experiment: six configurations, n in {1, 2, 3} crossed with d in {4, 8}, on MSV. Two attention maps at depth 4 win on both accuracy and mAP, and the margin over one map is large -- 7.8 points, far more than the differences the rest of the corpus fights over.",
        "The shape of the result is the interesting part. Performance does not increase with n; it peaks and falls. A third cuboid makes things worse by 2.5 points, and the same inversion shows in the d = 8 rows.",
        "The paper explains the peak by analogy to human visual attention, citing work that people track two to three focal points before returning diminishing results. That is a pleasant story and it is not evidence. A more mundane explanation sits in the architecture: each APN brings its own local backbone, so n = 3 is a substantially larger model fitted to the same 1413 videos, and the drop is what overfitting looks like. The paper reports no parameter count, so neither reading can be checked.",
        "The statistical support is thinner than its presentation. The ANOVA has six observations; F(2,3) = 12.662, p = 0.0345 on accuracy clears the threshold, and the mAP test at p = 0.0539 does not, though the text describes it as supporting the same conclusion.",
      ],
      takeaways: [
        "Depth 4 beats depth 8 at every value of n, so a shorter attended window is better on 2-second samples — the model wants a sharp temporal cut, not a broad one.",
        "The best configuration is also the second-cheapest, since cost scales with n. Convenient, and unverifiable: no cost is reported for any row.",
        "Six data points support the ANOVA. It is the smallest design that permits the test, and the mAP half of it does not reach the significance level the paper names.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          mode: "outcome",
          hue: 358,
          baselineId: "n1d4",
          metricLabel: "Top-1 accuracy",
          datasetLabel: "Temporal depth",
          // T3, p11. Split by d so the two sweeps over n can be read side by
          // side. mAP is reported in the same table but ModelMetrics has no
          // field for it, so it stays in the note: 79.5 / 86.3 / 82.9 at d = 4.
          datasets: [
            { id: "d4", label: "d = 4", title: "cuboid spans 8 frames of the clip" },
            { id: "d8", label: "d = 8", title: "cuboid spans 16 frames — nearly the whole 20-frame sample" },
          ],
          models: [
            {
              id: "n1d4",
              label: "one APN",
              metrics: { d4: { accuracy: 77.2 }, d8: { accuracy: 75 } },
            },
            {
              id: "n2d4",
              label: "two APNs",
              metrics: { d4: { accuracy: 85 }, d8: { accuracy: 82.28 } },
            },
            {
              id: "n3d4",
              label: "three APNs",
              metrics: { d4: { accuracy: 82.54 }, d8: { accuracy: 81 } },
            },
          ],
        },
        caption:
          "All six rows of T3, on MSV. Accuracy peaks at two attended regions and falls at three, in both depth settings — the paper reads that as an echo of human attentional capacity; a third backbone fitted to 1413 videos is the duller explanation, and no parameter count exists to separate them.",
      },
      pdfPage: 11,
    },

    {
      id: "what-it-costs",
      title: "Fast on a 3090 Ti, and that is the whole accounting",
      tagline: "Throughput (F6)",
      highlight: {
        label: "Reported efficiency figures",
        value: "2",
        note: "throughput and inference time — no parameters, no FLOPs, no memory",
      },
      note: [
        "The GPU number is good and it supports what the paper claims with it: 79.1 fps at batch size 4 on an RTX 3090 Ti, against MSV footage resampled to 10 fps. That is roughly eight times the headroom needed, and it holds against 25 or 30 fps sources too.",
        "It is also everything. There is no parameter count in this article, no FLOPs figure, no model size, no memory measurement. For an architecture running n+2 deep backbones per clip and building an N-cubed fusion tensor whose N is never stated, that leaves no way to reason about what it would take to run this anywhere other than the workstation it was measured on.",
        "The CPU figure does not reconcile with the sentence it appears in. 3.8 fps at batch size 4 means 80 frames take about 21 seconds; the same sentence says inference time is under one second for both GPU and CPU. One of the two is describing something other than what it appears to describe, and the paper does not say which.",
        "Nothing outside the forward pass is timed anywhere: not decoding, not the resize to 256, not the centre crop, and not the bilinear resize applied to every extracted cuboid.",
      ],
      takeaways: [
        "Both machines are workstation-class. No embedded hardware appears in the paper, and none is claimed — \"edge\" occurs only as \"edge cases\" and in two reference titles.",
        "The throughput is for classifying pre-trimmed 2-second samples. Time-to-alert on continuous footage is a different quantity and is not measured.",
        "F6 is a plot, not a table, so the two figures quoted in the text are the only exact numbers available.",
      ],
      visual: {
        kind: "throughput-budget",
        options: {
          hue: 358,
          budgetSeconds: 1,
          // F6, p12. Per-frame cost is the reciprocal of the reported GPU
          // throughput: 1 / 79.1 = 12.64 ms. MSV is resampled to 10 fps and
          // sampled in 2-second windows, so a clip is 20 frames.
          clipSeconds: 2,
          frameRates: [10, 25, 30],
          stages: [
            {
              id: "forward",
              label: "full forward pass, RTX 3090 Ti",
              perFrame: 0.012642,
              countedInClaim: true,
              note: "79.1 fps at batch size 4 — global backbone, two APNs, two local backbones, fusion and ResNet-18 classifier, all together. On the Threadripper CPU the same pass runs at 3.8 fps.",
            },
          ],
          copy: {
            readout: "GPU compute per second of video",
            scopeLabel: "Counting",
            rateLabel: "Input frame rate",
            chips: { claimed: "forward pass only", full: "whole pipeline" },
            lines: {
              claimed:
                "The measured pass. At MSV's own 10 fps it uses about an eighth of the budget, and it still fits at 30 fps — the GPU real-time claim is sound.",
              full: "Identical, because nothing else was measured. Decoding, resizing, centre-cropping and the per-cuboid bilinear resize are all unpriced, so the gap here is unknown rather than absent.",
            },
          },
        },
        caption:
          "One second of video against the compute owed for it, on the GPU F6 reports. The claim holds comfortably at every plausible source rate. What no chart can show is the rest of the accounting — this paper reports no parameters, no FLOPs and no memory, so the only thing known about its cost is how fast one machine ran it.",
      },
      pdfPage: 12,
    },

    {
      id: "beaten-in-its-own-table",
      title: "\"Invariably outperformed\" — except twice, in T4",
      tagline: "Comparison with prior work (T4)",
      highlight: {
        label: "Violent Flows",
        value: "−3.5",
        note: "95.0% against Qaraqe et al.'s 98.5% in the same table",
      },
      note: [
        "T4 is a forty-row comparison across five datasets, and on three of them the proposed model comes out on top: Hockey Fight at 100 against 98.8, Surveillance Camera Fight at 91.8 against 91.7, and RLVS at 96.5 against 96.25. Two of those three margins are a tenth of a point and a quarter of a point.",
        "On the other two it loses. Violent Flows gives Qaraqe et al. 98.5 against this model's 95.0. MSV -- the authors' own dataset, introduced in this paper -- gives the same method 88.89 against this model's 85.0. Both numbers are printed in the paper's own table, four lines above the row that loses to them.",
        "The text nonetheless says the approach \"consistently provided better performance than existing methods\" and that it \"invariably outperformed the current methods even in these richer settings\". Those sentences are contradicted by the table they refer to.",
        "One detail sharpens it: Qaraqe et al. [64], the method that wins both columns, shares an author with this paper, and it is the only prior method in T4 carrying a number on MSV -- which is a dataset first published here. So the comparison the paper loses is against its own group's earlier work, evaluated on a dataset only that group has.",
        "The 100% on Hockey Fight is the other figure to sit with. It appears twice, for n = 2 and n = 3, on a validation split of about 200 videos from a single-scenario benchmark, with no independent test partition anywhere in the paper.",
      ],
      takeaways: [
        "Three wins, two of them by 0.1 and 0.25 points; two losses, by 3.5 and 3.89 points. The wins are inside the noise the paper never quantifies — no standard deviations, no repeated runs.",
        "The transformer baselines are strong and close: Video Swin reaches 98.8 / 91.7 / 94.7 / 94.5 / 83.9 across the five columns.",
        "Every one of these figures comes from the same 20% partition that n, d, the backbone family and the global-path ablation were all selected on.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          mode: "outcome",
          hue: 358,
          baselineId: "proposed",
          metricLabel: "Top-1 accuracy",
          datasetLabel: "Dataset",
          // T4, pp14-15. Six of about forty rows: the proposed model at its
          // chosen configuration, the three strongest transformer baselines, the
          // method that beats it twice, and the RLVS leader. Blank cells in T4
          // are omitted rather than filled.
          datasets: [
            { id: "hf", label: "Hockey Fight", title: "1000 broadcast clips, single scenario", floor: 50, floorLabel: "coin flip on a balanced set" },
            { id: "scf", label: "Surveillance Camera Fight", title: "300 clips — 150 of them also folded into MSV", floor: 50, floorLabel: "coin flip on a balanced set" },
            { id: "vf", label: "Crowd Violence", title: "the paper's Violent Flows: 246 videos, ~14 min", floor: 50, floorLabel: "coin flip on a balanced set" },
            { id: "rlv", label: "RLVS", title: "2000 YouTube videos", floor: 50, floorLabel: "coin flip on a balanced set" },
            { id: "msv", label: "MSV", title: "the authors' own 4-class set, 1413 videos", floor: 37, floorLabel: "always answer Natural (523 of 1413)" },
          ],
          models: [
            {
              id: "proposed",
              label: "This paper (n=2, d=4)",
              metrics: {
                hf: { accuracy: 100 },
                scf: { accuracy: 91.8 },
                vf: { accuracy: 95 },
                rlv: { accuracy: 96.5 },
                msv: { accuracy: 85 },
              },
            },
            {
              id: "qaraqe",
              label: "Qaraqe et al.",
              metrics: {
                hf: { accuracy: 98.5 },
                scf: { accuracy: 81.51 },
                vf: { accuracy: 98.5 },
                msv: { accuracy: 88.89 },
              },
            },
            {
              id: "swin",
              label: "Video Swin Transformer",
              metrics: {
                hf: { accuracy: 98.8 },
                scf: { accuracy: 91.7 },
                vf: { accuracy: 94.7 },
                rlv: { accuracy: 94.5 },
                msv: { accuracy: 83.9 },
              },
            },
            {
              id: "vidtrans",
              label: "Video Transformer",
              metrics: {
                hf: { accuracy: 98.8 },
                scf: { accuracy: 91.5 },
                vf: { accuracy: 94.5 },
                rlv: { accuracy: 93 },
                msv: { accuracy: 83.8 },
              },
            },
            {
              id: "abdali",
              label: "Abdali et al.",
              metrics: { rlv: { accuracy: 96.25 } },
            },
            {
              id: "i3d",
              label: "I3D",
              metrics: {
                hf: { accuracy: 94.5 },
                scf: { accuracy: 84.6 },
                vf: { accuracy: 88.5 },
                msv: { accuracy: 78.5 },
              },
            },
          ],
        },
        caption:
          "Six rows of T4. Switch to Crowd Violence or MSV and the proposed model is not the top lane — which is what the surrounding text says never happens. Missing lanes are cells T4 leaves blank; the MSV floor is the majority class, which top-1 accuracy on an imbalanced four-class set is measured against.",
      },
      pdfPage: 14,
    },

    {
      id: "no-test-set",
      title: "The word \"test\" does not appear in this paper",
      tagline: "Protocol (§4.2.1)",
      highlight: {
        label: "Partitions per dataset",
        value: "2",
        note: "8:2 train and validation — every reported number is on the second",
      },
      note: [
        "Each dataset is split 8:2 into train and validation. There is no third partition, and the phrase \"test set\" occurs nowhere in the article. Every accuracy in T3, T4, F5, F7, F10 and F11 is a validation number.",
        "That would matter less if the validation set had been used once. It was not. T3 selects n and d on it, F11 selects the backbone family on it, F10 justifies the global path on it, and the configuration those three converge on then produces the headline 85% on MSV and all four benchmark figures in T4. The set that chose the model is the set that scored it.",
        "The effect is not that the model is bad -- it is that the reported margins are upper bounds. When three of the five wins in T4 are 0.1, 0.25 and 3.5 points, a selection bias of unknown size sitting underneath them is the difference between a result and a ranking.",
        "One part of the protocol is better than most of the library, and deserves saying. Training uses trimmed 2-second sliding-window samples, but validation feeds whole videos through one at a time at batch size 1, whatever their length. Evaluating on complete sequences rather than on the same trimmed windows the model was fitted to is the harder and more honest choice, and the paper makes it deliberately.",
        "The larger gap is what is never evaluated at all. The contribution is a model that learns where and when to look; the evidence that it does is a handful of drawn boxes in F8 and Grad-CAM heatmaps in F9. MSV is annotated with start and end times per behaviour instance, which is exactly what a localisation metric needs, and none is computed.",
      ],
      takeaways: [
        "No cross-dataset test anywhere: every figure is train and validate inside one dataset.",
        "Accuracy and mAP only. No precision, recall, F1 or AUC, so nothing in the paper shows what the false-alarm rate would be.",
        "MSV carries segment-level time annotations that would support an IoU or temporal-AP evaluation of the attention cuboids. The paper publishes the annotations and evaluates classification.",
      ],
      pdfPage: 10,
    },
  ],
};
