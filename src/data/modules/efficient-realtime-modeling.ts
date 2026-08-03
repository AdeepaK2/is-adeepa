import type { StudyModule } from "@/types/study";

/**
 * Kang, Park & Park (2021), "Efficient Spatio-Temporal Modeling Methods for
 * Real-Time Violence Recognition". IEEE Access 9:76270-76285.
 * DOI 10.1109/ACCESS.2021.3083273. Published 24 May 2021.
 *
 * Every number here is from the paper's own tables. Its tables are raster
 * images rather than text, so each was read off a rendered page.
 *
 * This is the most internally consistent paper in the review so far, and two
 * of its numbers were checked by reconstruction rather than taken on trust:
 *   - MSM's 2,661 parameters (T5) follow exactly from T1's layer spec --
 *     7x7 kernels over 1->3->8->3->1 channels give 150+1184+1179+148 = 2661.
 *   - T-SE's 900 parameters without frame-grouping and 100 with it follow from
 *     two FC layers halving and restoring the time axis: 30->15->30 = 900,
 *     10->5->10 = 100.
 * Both check out. The one place the tables disagree with each other is
 * EfficientNet-B0's FLOPS column, recorded under efficiency.
 *
 * Table and figure map (physical PDF pages, 1-based):
 *   F1  p4   RGB channels, viridis        T3  p9   four models on RWF-2000
 *   F2  p5   overall pipeline             F8  p9   first-layer features vs I3D
 *   F3  p5   the MSM module               F9  p9   features with/without MSM
 *   T1  p5   MSM layer parameters         T4  p10  six-dataset comparison
 *   F4  p6   MSM outputs                  T5  p10  module ablation
 *   F5  p6   frame-grouping toy example   T6  p10  backbone ablation
 *   F6  p7   2D vs 3D vs frame-grouping   T7  p10  frame-grouping vs TSM
 *   F7  p7   the T-SE block               T8  p11  measured latencies
 *   T2  p8   dataset descriptions         T9  p11  UCF-Crime cross-dataset AUC
 *                                         F10 p12  MSM on moving cameras
 *                                         F11 p13  uniform sampling examples
 *                                         F12 p14  Grad-CAM
 */
export const moduleEfficientRealtime: StudyModule = {
  slug: "efficient-realtime-modeling",

  premise:
    "Most papers here answer 'how does motion enter the representation?' by adding something — a third convolutional dimension, an optical flow stream, a recurrent state. This one answers it by taking something away. Average an RGB frame's three colour channels into one, then stack three consecutive frames into the three-channel slot an ordinary 2D CNN already expects. The first convolution's third dimension now spans time instead of colour, and the network is unmodified. It costs zero parameters, cuts FLOPS to exactly a third, and is worth +7.8 points. Two small attention modules are bolted on top, and the paper's own ablation shows most of what they buy is already bought by the substitution.",

  results: [
    { label: "RWF-2000", value: "92.0%", note: "accuracy, EfficientNet-B0, T3/T4" },
    { label: "FLOPS", value: "4.2 G", note: "against I3D's 55.7 G, T3" },
    { label: "Frame-grouping", value: "+7.8", note: "points for zero parameters, T5" },
  ],

  review: {
    architecture: {
      family: "2D CNN + Attention",
      backbone:
        "Four interchangeable ImageNet-pretrained 2D CNNs, all chosen for embedded use: SqueezeNet 1.1, MobileNetV2 at width multiplier 1.0, MobileNetV3-Large, and EfficientNet-B0. No architecture is modified — the whole contribution sits before the backbone, around it, or in what is fed to it. Kinetics-pretrained I3D is run alongside as the 3D CNN comparison.",
      motionEncoding:
        "By frame-grouping: a substitution of the channel axis for the time axis, done in the middle of the forward path. The three RGB channels of each frame are averaged to one, and three consecutive channel-averaged frames are then stacked into the three-channel input an ordinary 2D CNN already expects (Eqs. 4-5). The first convolutional layer's three kernels therefore span three frames rather than three colours, so a standard 2D convolution becomes a temporal convolution without a single change to the network. T = 30 frames are sampled at uniform intervals, giving 10 groups. Motion also enters a second time through MSM, which computes the Euclidean distance between consecutive raw frames and uses it as a spatial gate.",
      inputs: [
        "RGB frames resized to 224×224, T = 30 sampled at uniform intervals across the clip (T must be divisible by 3)",
        "Frame interval therefore varies with clip length — Appendix B measures it at about 0.5 s per group on RWF-2000 and 0.1 s on Movie-Fight",
        "No optical flow, no pose, no audio, no second stream",
      ],
      fusion:
        "None in the usual sense — there is one stream throughout. The only combination of information across frames is the channel-to-time substitution itself, which the first convolution then sums over exactly as it would sum over colour.",
      supervision:
        "Supervised binary violence classification. The T-SE block's recalibrated features are summed along the time axis and fed to a single fully connected layer for a video-level score (Eq. 10).",
      notes: [
        "The mechanism costs nothing, and the paper's own table proves it rather than asserting it. In T5 the parameter count with frame-grouping is P_b, identical to without it, and in T6 the FLOPS fall to almost exactly a third on all four backbones — 10.6→3.5, 9.4→3.1, 6.7→2.2, 0.4→0.1. That is what Section III-C's operation count predicts: K·O operations become (K/3)·O for the same P parameters.",
        "The trade is explicit and unusual: colour for time. The paper states the assumption plainly — 'we squeeze the channel dimension to reduce the computational load, assuming that motion information is more important than the richness of color information to detect violent actions'. It does not run a control with colour retained and time added some other way, so the assumption is argued and measured in aggregate but never isolated.",
        "Channels are averaged rather than converted to greyscale, and the paper explains why: the input is already normalised per channel, and the goal is speed rather than a perceptually faithful monochrome image.",
        "The three modules are deliberately separable, and the reason given is deployment rather than science: 'frame-grouping as an essential module, while MSM or T-SE block can be excluded depending on memory capacity and computational speed of a hardware'. Designing the ablation to double as a deployment menu is rare in this set.",
        "MSM assumes a fixed camera by construction — it reads motion boundaries from the difference between consecutive raw frames, which only means what it is supposed to mean if the background is still. The paper says so up front and returns to it in Appendix A.",
        "I3D is not reported with the T-SE block, and the paper gives a structural reason: the number of time steps is already shrunk by the 3D convolutional layers, leaving too little for a temporal attention module to recalibrate.",
      ],
    },

    attention: {
      used: true,
      kinds: ["spatial", "temporal"],
      mechanisms: [
        {
          name: "Motion Saliency Map (MSM) — spatial attention",
          placement:
            "Before the backbone, on the raw input image rather than on a feature map. It takes the Euclidean distance between consecutive RGB frames summed over the channel axis (Eq. 1), passes it through two 15×15 average pools and four 7×7 convolutions with ReLU (T1 p5) to dilate the sharp motion boundaries into regions, applies a sigmoid, and multiplies the result element-wise with frame X_{t+1} (Eqs. 2-3).",
          reportedEffect:
            "T5 (p10), MobileNetV3 on RWF-2000: +3.0 points alone (81.0 → 84.0), but only +0.5 once frame-grouping is present (88.8 → 89.3). Costs 2,661 parameters. It also improves I3D — T3 shows MSM + I3D at 89.3 against I3D's 88.8.",
        },
        {
          name: "Temporal Squeeze-and-Excitation (T-SE) block — temporal attention",
          placement:
            "At an intermediate layer of the backbone. Global average pooling squeezes the spatial dimensions (Eq. 6), a further average squeezes the channel dimension (Eq. 7), and two fully connected layers halve and then restore the time axis before a sigmoid produces one weight per timestep (Eq. 8), which multiplies the temporal features (Eq. 9). It is the SE block with time substituted for channels.",
          reportedEffect:
            "T5 (p10): +2.8 points alone (81.0 → 83.8), and +0.5 once frame-grouping is present (88.8 → 89.3). Costs 900 parameters without frame-grouping and 100 with it, because grouping reduces the time axis from 30 steps to 10.",
        },
      ],
      notes: [
        "The single most informative reading of T5 is one the paper never states. Both attention modules are worth roughly three points on their own — MSM +3.0, T-SE +2.8, together +3.8 — and roughly half a point each once frame-grouping is present: +0.5, +0.5, +1.2 together. Their marginal value drops about six-fold. The prose says only that they 'consistently improved the performance', which is true, and never remarks that most of what they buy is already bought more cheaply by the channel-to-time substitution. All three are reaching for the same short-term motion signal.",
        "MSM is a pre-backbone gate on the input image, not a re-weighting of feature maps. That is unusual — CBAM, SE and self-attention in the other papers here all operate inside the network. It makes MSM backbone-independent, which is why its cost is the same flat figure whichever backbone it is attached to.",
        "The parameter cost is genuinely tiny and stated exactly rather than rounded: 2,661 for MSM and 100 for T-SE against a 2,976,635-parameter MobileNetV3 baseline, under 0.1% together. Both figures reconstruct correctly from the paper's own layer specifications, which is a good sign for the rest of the table.",
        "Cheap in parameters is not cheap in compute, and this is where 'lightweight' stops being true. T6 shows the attention modules adding a near-constant ~4.0 GFLOPS to every backbone — 3.5→7.5, 3.1→7.1, 2.2→6.2 — because MSM runs four 7×7 convolutions at full 224×224 resolution on all 30 frames. On MobileNetV3 that nearly triples the model's FLOPS for +1.2 points of accuracy. The abstract calls the modules 'lightweight'; T5, the table that supports the word, reports parameters only.",
        "The compute cost has a measured consequence the paper's own table records. In T8, MobileNetV3 with frame-grouping runs at 35.3 ms on a Jetson TX2 and is bolded as meeting the 25 fps requirement; adding the attention modules takes it to 51.2 ms, and that cell is not bolded. The attention modules are what breaks real time on the edge device.",
        "MSM is spatial and T-SE is temporal, and neither is self-attention or channel attention. Both are cheap deterministic gates rather than learned pairwise comparisons — which is the point, and worth holding against the transformer and self-attention papers elsewhere in this review.",
      ],
    },

    efficiency: {
      parameters:
        "Full models on 30 frames (T3 p9): SqueezeNet 1.1 1.2 M, EfficientNet-B0 1.3 M, MobileNetV2 2.2 M, MobileNetV3 2.9 M, against I3D at 12.3 M. The MobileNetV3 baseline is given exactly as 2,976,635 (T5 caption). MSM adds 2,661 parameters; T-SE adds 900 without frame-grouping and 100 with it. Frame-grouping adds none.",
      flops:
        "Full models on 30 frames (T3 p9): EfficientNet-B0 4.2 G, MobileNetV3 6.2 G, MobileNetV2 7.1 G, SqueezeNet 7.5 G, against I3D at 55.7 G and MSM + I3D at 61.9 G. T6 (p10) breaks it down per stage: frame-grouping cuts the backbone to a third, the attention modules add a flat ~4.0 G.",
      modelSize: undefined,
      throughput:
        "Reported as latency rather than frame rate. T8 (p11), for processing 30 frames, Jetson TX2 / RTX 3090 in ms — SqueezeNet 9.8 / 2.1, MobileNetV2 21.9 / 5.3, MobileNetV3 35.3 / 6.8, EfficientNet-B0 47.3 / 9.4; with the attention modules 28.0 / 5.8, 39.2 / 8.0, 51.2 / 10.2, 62.2 / 12.4. The paper's real-time bar is 25 fps, i.e. 40 ms, and it bolds every cell that clears it.",
      hardware:
        "Training on a single Nvidia RTX Titan (PyTorch, Adam, lr 0.001, batch 16). Latency measured on two named devices: an NVIDIA RTX 3090 desktop GPU and a Jetson TX2 embedded module. Both are GPUs; no CPU figure is given.",
      realTime: {
        status: "measured-and-supported",
        note: "The claim is made in the title and measured on real hardware against a stated threshold. T8 gives per-inference latency on two named devices for 30 frames, defines real time as 25 fps (40 ms), and marks each configuration that clears it. Seven of the sixteen cells clear it on the Jetson TX2 and all eight clear it on the RTX 3090. One qualification the paper makes itself: the configuration with attention modules does not clear 25 fps on the TX2 (51.2 ms for MobileNetV3), so for that mode it re-defines the operating point — a frame is pushed into the queue every fifth frame to get about 6 fps, and 'real time' means keeping up with that. The word is doing two jobs at two thresholds in the same subsection.",
      },
      edgeDeployment: {
        status: "measured-and-supported",
        note: "Genuine edge evidence, and the strongest in this review so far. Latency is measured on a Jetson TX2, an actual embedded module rather than a desktop GPU standing in for one; two webcam demo systems are implemented and described, one minimum-delay and one attention-enabled; and code plus demo videos are published to a named GitHub repository. The whole design brief is stated up front as on-device operation 'by embedding our algorithm on a camera module'.",
      },
      notes: [
        "EfficientNet-B0's FLOPS column does not fit the rest of the paper, and it is the one place the tables disagree. Its T6 entries are 0.4 G as a plain 2D CNN and 0.1 G with frame-grouping, roughly seventeen times below MobileNetV3's 6.7 G and 2.2 G. The other three backbones' figures scale as per-clip counts should; EfficientNet-B0's look like per-image counts. The disagreement is checkable without leaving the paper: 0.1 G is bolded in T6 as the smallest FLOPS in the table, while in T8 the same model is the slowest of the four on both devices — the only backbone that fails the 25 fps bar on the Jetson TX2 without any attention modules. A FLOPS column and a latency column cannot rank four models in opposite orders and both be measuring the deployed system.",
        "Model size in megabytes is never given, only parameter counts, so the paper's own second criterion for on-device operation — 'sufficiently compact model size' — is served by a proxy rather than measured.",
        "The latency measurements do not state a batch size, a precision, or whether any runtime optimisation was applied on the Jetson. For an embedded GPU those change the number substantially.",
        "No power draw, thermal behaviour or sustained-throughput figure appears, which for a camera-module deployment is the constraint that usually bites after latency.",
        "Quantization, pruning and knowledge distillation are surveyed in the introduction as the standard model-compression toolkit and then not used. The efficiency here is entirely architectural, which makes it orthogonal to those techniques rather than competing with them — the paper does not say so, but nothing in it has been compressed.",
        "MSM's FLOPS cost is backbone-independent because it runs at full input resolution before the network. That is a real design consequence: on a heavier backbone MSM is nearly free, and on the lightest one it dominates. EfficientNet-B0's full model is 4.2 G of which roughly 4.0 G is MSM.",
      ],
    },

    evaluation: {
      datasets: [
        {
          name: "RWF-2000",
          role: "evaluation",
          note: "2000 clips of 5 s (T2 p8). The primary benchmark, chosen because it is 'not only the largest violence dataset but also well splitted to train/test partitions' — the only one of the six not run under cross-validation. Every ablation (T3, T5, T6, T7) and every latency measurement is on this dataset.",
        },
        {
          name: "Hockey Fight",
          role: "evaluation",
          note: "1000 clips of about 1 s (T2 p8). 5-fold cross-validation. Broadcast ice hockey — one environment, similar objects throughout.",
        },
        {
          name: "Movies",
          role: "evaluation",
          note: "Listed as 'Movie (Peliculas)', 200 clips of about 1 s (T2 p8). 5-fold cross-validation. At ceiling: four rows of T4 including three prior methods all score 100.0.",
        },
        {
          name: "Crowd Violence",
          role: "evaluation",
          note: "The Violent Flows dataset, 246 clips of 3-5 s (T2 p8). 5-fold cross-validation.",
        },
        {
          name: "Surveillance Camera Fight",
          role: "evaluation",
          note: "300 clips of 1-3 s (T2 p8). 5-fold cross-validation. The hardest of the six by some margin — the best prior result in T4 is 72.0%, and this paper reports 92.0%.",
        },
        {
          name: "RLVS",
          role: "evaluation",
          note: "Real Life Violence Situations, 2000 clips of 5 s (T2 p8). 5-fold cross-validation. Only one prior method in T4 reports on it at all (86.8%).",
        },
        {
          name: "UCF-Crime",
          role: "evaluation",
          note: "Used only as a cross-dataset generalisation test (T9 p11): models trained on RWF-2000 with no additional training, evaluated on the violence-related classes of the test set. Eight videos in total — three assault, five fighting. AUC 0.82-0.87.",
        },
        {
          name: "ImageNet",
          role: "pre-training",
          note: "Source of the weights for all four 2D CNN backbones.",
        },
        {
          name: "Kinetics",
          role: "pre-training",
          note: "Source of the I3D weights, used for the 3D CNN comparison in T3.",
        },
      ],
      split:
        "5-fold cross-validation on Hockey, Movie, Crowd, Surv and RLVS. RWF-2000 uses its own published split, described as 'train/test partitions' in Section IV-A and as 'train/validation sets' in T4's caption — the two are not the same claim, and which one produced the headline 92.0% is left unresolved. No validation set is described for the cross-validated datasets, and no separate hyperparameter-selection protocol is given for any of them.",
      metrics: ["Accuracy", "AUC (UCF-Crime cross-dataset test only)"],
      protocolNotes: [
        "T4 mixes two protocols and says so in its caption, which is more than most papers here manage: rows above the double line are figures quoted from the original authors' own reports, rows below are this paper's 5-fold cross-validation. Different splits, different augmentation, different implementations. Being told this is what makes the table usable; it also means the margins are not like-for-like.",
        "No standard deviation is reported for any 5-fold result — only the mean. Several margins in T4 are wide enough that spread is unlikely to matter (Surv 72.0 → 92.0, RLVS 86.8 → 97.8), but Hockey's 98.0 → 99.6 and Movie's tie cannot be tested at all.",
        "'Our approach achieved the best performances for all the six datasets' is very nearly right by the paper's own table. Five of the six are clear wins. Movie is a tie at the ceiling — 100.0 for this method and for three prior ones — so 'best' there means 'joint best on a saturated benchmark', which the bolding shows correctly and the sentence does not qualify.",
        "The cross-dataset test is real, deliberate and almost the only one in this review — a model trained on RWF-2000 and evaluated on UCF-Crime with no further training. It is also very small: eight videos, three assault and five fighting.",
        "The UCF-Crime labels are the authors' own. T9's AUCs were measured against frame-level labels the authors wrote themselves, and the paper states this openly — 'although the frame-level labels were provided for the test videos, we labeled our own for the violence-related classes to define the violent actions accurately'. The reason is defensible and the disclosure is good practice, but it means these AUCs are not comparable with any other UCF-Crime number in the literature, and the paper does not compare them to one.",
        "Accuracy alone on all six datasets. No precision, recall, F1, confusion matrix or ROC curve appears anywhere for the main results, so nothing here can be read for false-alarm behaviour — the property that decides whether an alert reaching surveillance personnel is worth acting on, which is the paper's own stated use case.",
        "MSM's fixed-camera assumption is acknowledged and then only qualitatively addressed. Appendix A concedes that the six datasets 'contain many videos captured with moving cameras' and answers with visualisations in Fig. 10 showing MSM still highlighting the right regions under slow camera motion. There is no accuracy breakdown for moving-camera against fixed-camera subsets, so the size of the penalty is never measured.",
        "Data provenance across the six spans staged and real: broadcast sport (Hockey), film (Movie), YouTube crowd footage (Crowd), and surveillance or real-world clips (Surv, RLVS, RWF-2000). The paper is explicit that RWF-2000 is the one it targets, and every ablation runs there rather than on the easier sets.",
        "Code, demo videos and the authors' UCF-Crime labels are published to a named GitHub repository. That is unusual in this review and makes these results checkable in principle. Nothing in this extraction has been verified against that repository — every number here comes from the PDF.",
      ],
    },
  },

  concepts: [
    {
      id: "frame-grouping",
      title: "Give the colour channels to time instead",
      tagline: "A 2D kernel that spans three frames",
      highlight: {
        label: "Cost of the mechanism",
        value: "0 parameters",
        note: "and a third of the FLOPS",
      },
      note: [
        "A 2D convolution reads one multi-channel image. Its kernel has a third dimension, and that dimension is spent on colour: three weights per filter, one each for red, green and blue, summed. Motion between frames is invisible to it, which is the whole reason 3D convolution exists.",
        "Frame-grouping notices that the third dimension is already there and simply puts something else in it. Average each frame's three colour channels into one greyscale-ish image, then stack three consecutive such images into the slot the network expects to hold R, G and B. The first convolutional layer now sums three weights across three *frames*. It is a temporal convolution, and not one line of the backbone has changed.",
        "Because nothing was added, nothing is paid for. Table 5's parameter column reads P_b both with and without frame-grouping — identical. And because 30 frames become 10 groups, the backbone runs 10 forward passes instead of 30, so the FLOPS fall to a third: Table 6 shows 10.6→3.5, 9.4→3.1, 6.7→2.2 across three backbones, exactly the K/3 the paper's operation count predicts. For that, accuracy on RWF-2000 rises from 81.0% to 88.8%.",
        "What is given up is colour, and the paper is direct about the bet: it assumes 'motion information is more important than the richness of color information to detect violent actions'. For punching and kicking in surveillance footage that is plausible, and Table 6 says it pays on four different backbones. It is still an assumption the paper never isolates — there is no control that keeps colour and adds time some other way.",
      ],
      takeaways: [
        "The colour axis and the time axis are both size 3. Frame-grouping swaps what occupies it, and the network cannot tell.",
        "Zero added parameters (T5) and exactly one third of the FLOPS (T6), on all four backbones.",
        "Worth +7.8 points on RWF-2000 — more than either attention module, and the largest single effect in the paper.",
        "The cost is colour, on the stated assumption that motion matters more. That assumption is never tested on its own.",
      ],
      visual: {
        kind: "volume-grid",
        options: {
          mode: "kernel",
          hue: 190,
          size: [8, 5, 9],
          kernel: [3, 3, 3],
          interactive: true,
          speed: 0.55,
        },
        caption:
          "The problem frame-grouping sidesteps, in the usual framing: toggle to a 2D kernel and it only ever covers one frame of the volume, so nothing that happens between frames can reach it. Frame-grouping's trick is to reach the 3D case without a 3D kernel — the depth here is spent on colour in an ordinary 2D CNN, and the paper simply fills it with three frames instead.",
      },
      pdfPage: 7,
    },

    {
      id: "attention-collapse",
      title: "Both attention modules lose most of their value once frame-grouping is there",
      tagline: "Reading Table 5",
      highlight: {
        label: "MSM's contribution",
        value: "+3.0 → +0.5",
        note: "without, then with frame-grouping",
      },
      note: [
        "Table 5 runs all eight combinations of the three modules on MobileNetV3 and RWF-2000, which is more thorough than most ablations in this review. Read down the top half, without frame-grouping: the bare backbone scores 81.0%, MSM alone 84.0%, T-SE alone 83.8%, both together 84.8%. The two attention modules are worth about three points each. That is a good result for 2,661 and 900 parameters.",
        "Now read the bottom half, with frame-grouping. The baseline is 88.8%, MSM takes it to 89.3%, T-SE to 89.3%, both together to 90.0%. The same two modules are now worth half a point each. Their marginal contribution has dropped roughly six-fold.",
        "The natural reading is that all three modules are reaching for the same signal. MSM finds where motion is by differencing consecutive frames; frame-grouping lets the first convolution see three frames at once, which is a differencing operation the network can learn for itself. Once one of them has extracted the short-term motion structure, there is much less left for the other to add.",
        "The paper reports every cell honestly and then describes the result as the modules having 'consistently improved the performance' — which is true in all four comparisons, and is also the least interesting thing the table says. Nothing in the prose notes that the headline contribution shrinks by a factor of six in the presence of the module the paper itself calls essential.",
      ],
      takeaways: [
        "Without frame-grouping: MSM +3.0, T-SE +2.8, both +3.8. With it: +0.5, +0.5, +1.2.",
        "Frame-grouping alone is worth +7.8 — more than both attention modules combined, in either regime.",
        "The redundancy makes mechanical sense: MSM differences consecutive frames, and frame-grouping lets the first conv layer do the same thing implicitly.",
        "All eight combinations are reported, which is what makes the collapse visible at all. Most ablations in this review report two rows.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          mode: "outcome",
          hue: 190,
          baselineId: "none",
          metricLabel: "Accuracy",
          datasetLabel: "Frame-grouping",
          // T5 p10, MobileNetV3 on RWF-2000. Chance floor is 50% -- RWF-2000
          // is balanced between violent and non-violent clips.
          datasets: [
            {
              id: "nofg",
              label: "off",
              title: "The 2D CNN reading one frame at a time",
              floor: 50,
              floorLabel: "always predict one class",
            },
            {
              id: "fg",
              label: "on",
              title: "Three channel-averaged frames per forward pass",
              floor: 50,
              floorLabel: "always predict one class",
            },
          ],
          models: [
            {
              id: "none",
              label: "backbone only",
              metrics: { nofg: { accuracy: 81.0 }, fg: { accuracy: 88.8 } },
            },
            {
              id: "msm",
              label: "+ MSM",
              metrics: { nofg: { accuracy: 84.0 }, fg: { accuracy: 89.3 } },
            },
            {
              id: "tse",
              label: "+ T-SE",
              metrics: { nofg: { accuracy: 83.8 }, fg: { accuracy: 89.3 } },
            },
            {
              id: "both",
              label: "+ MSM + T-SE",
              metrics: { nofg: { accuracy: 84.8 }, fg: { accuracy: 90.0 } },
            },
          ],
        },
        caption:
          "All eight cells of Table 5, split by whether frame-grouping is on. Everything is measured against the bare backbone lane. Switch frame-grouping on: every lane jumps, and the gaps between them almost close — the attention modules had been supplying something the substitution now supplies for free.",
      },
      pdfPage: 10,
    },

    {
      id: "what-lightweight-costs",
      title: "Lightweight in parameters, expensive in FLOPS",
      tagline: "Two different meanings of cheap",
      highlight: {
        label: "MSM on MobileNetV3",
        value: "+2,661 params",
        note: "and +4.0 GFLOPS",
      },
      note: [
        "The attention modules really are tiny by parameter count, and the paper states the figures exactly rather than rounding: 2,661 for MSM, 100 for T-SE with frame-grouping, against a 2,976,635-parameter baseline. Under a tenth of a percent. Both numbers reconstruct correctly from the layer specifications in Table 1, which is a good sign for the rest of the paper's arithmetic.",
        "Table 6 tells the other half. Adding the attention modules costs a near-constant 4.0 GFLOPS on every backbone — 3.5→7.5, 3.1→7.1, 2.2→6.2. On MobileNetV3 that nearly triples the model's compute for the +1.2 points the previous table measured. The cost is flat across backbones because MSM sits before the network, running four 7×7 convolutions at full 224×224 resolution on all 30 frames; it does not care what it is attached to.",
        "That distinction has a measured consequence, and Table 8 records it. MobileNetV3 with frame-grouping runs at 35.3 ms on a Jetson TX2 and is bolded as clearing the paper's 25 fps bar. Add the attention modules and it is 51.2 ms — the same cell, unbolded. The modules the abstract calls lightweight are exactly what breaks real time on the edge device, and the paper handles it by redefining the operating point: infer every fifth frame instead of every frame, about 6 fps, which the 51.2 ms comfortably serves.",
        "None of this is hidden — every number above is in the paper's own tables, and it is one of the few papers here that measures latency on real embedded hardware at all rather than asserting efficiency from a parameter count. The point is narrower: 'lightweight' is supported by the table that counts parameters and qualified by the two tables that count operations and milliseconds, and the abstract quotes only the first.",
      ],
      takeaways: [
        "Parameters and FLOPS disagree about the same modules: under 0.1% of the model by weight, roughly 3× its compute.",
        "MSM's cost is backbone-independent (~4.0 G) because it runs at full resolution before the network.",
        "T8 shows the attention modules pushing MobileNetV3 past the 25 fps bar on Jetson TX2 — 35.3 ms to 51.2 ms.",
        "EfficientNet-B0 is bolded in T6 as having the smallest FLOPS (0.1 G) and is the slowest model in T8 on both devices. Those two columns rank it in opposite orders.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          mode: "outcome",
          hue: 190,
          baselineId: "mobilenetv3",
          metricLabel: "Accuracy",
          datasetLabel: "Pipeline stage",
          // T6 p10, RWF-2000. Accuracy only -- the FLOPS column of the same
          // table is in the note, since this visual renders percentages.
          datasets: [
            {
              id: "base",
              label: "2D CNN",
              title: "Backbone alone, one frame per forward pass",
              floor: 50,
              floorLabel: "always predict one class",
            },
            {
              id: "f",
              label: "+ frame-grouping",
              title: "Three channel-averaged frames per forward pass",
              floor: 50,
              floorLabel: "always predict one class",
            },
            {
              id: "fa",
              label: "+ attention",
              title: "MSM and T-SE added on top of frame-grouping",
              floor: 50,
              floorLabel: "always predict one class",
            },
          ],
          models: [
            {
              id: "squeezenet",
              label: "SqueezeNet 1.1",
              metrics: {
                base: { accuracy: 78.3 },
                f: { accuracy: 86.3 },
                fa: { accuracy: 89.0 },
              },
            },
            {
              id: "mobilenetv2",
              label: "MobileNetV2",
              metrics: {
                base: { accuracy: 82.8 },
                f: { accuracy: 88.5 },
                fa: { accuracy: 89.3 },
              },
            },
            {
              id: "mobilenetv3",
              label: "MobileNetV3",
              metrics: {
                base: { accuracy: 81.0 },
                f: { accuracy: 88.8 },
                fa: { accuracy: 90.0 },
              },
            },
            {
              id: "efficientnet",
              label: "EfficientNet-B0",
              metrics: {
                base: { accuracy: 83.0 },
                f: { accuracy: 89.5 },
                fa: { accuracy: 92.0 },
              },
            },
          ],
        },
        caption:
          "Table 6's accuracy column, one lane per backbone. Step through the stages: frame-grouping moves every backbone by six to eight points, the attention modules by one to three. The same table's FLOPS column, not drawable here, runs 10.6 → 3.5 → 7.5 for SqueezeNet — down by two thirds, then back up by more than double.",
      },
      pdfPage: 10,
    },

    {
      id: "cross-dataset",
      title: "The generalisation test almost nobody runs, on eight videos",
      tagline: "RWF-2000 → UCF-Crime",
      highlight: {
        label: "Cross-dataset AUC",
        value: "0.87",
        note: "EfficientNet-B0, 8 test videos",
      },
      note: [
        "Nearly every paper in this review trains and tests inside one dataset. This one does that too, on six of them, and then does something else: it takes a model trained on RWF-2000, applies it to UCF-Crime with no additional training of any kind, and reports what happens. That is the question a surveillance operator actually has — will this work on my cameras, which are not the ones it was trained on — and it is asked here and almost nowhere else.",
        "The setup is honest about the mismatch. RWF-2000 clips are 5 seconds long and trimmed to the event; UCF-Crime videos run for minutes with violence occupying a short window inside them. So the sliding-window inference scheme from the deployment section is used, and AUC replaces accuracy because the positives are rare. MobileNetV3 reaches 0.82 without attention and 0.86 with it; EfficientNet-B0 reaches 0.83 and 0.87.",
        "Then the size of the test: eight videos. Three assault and five fighting, the violence-related classes of the UCF-Crime test set. An AUC computed over eight videos carries very little weight regardless of what it says, and the paper does not attach an interval to it or repeat it.",
        "There is one more thing to hold. The frame-level labels used to compute these AUCs are the authors' own. UCF-Crime provides frame-level test labels; the paper says it wrote replacements — 'we labeled our own for the violence-related classes to define the violent actions accurately' — and published them. The reason is reasonable and the disclosure is exactly right, but it means the numbers in Table 9 cannot be compared with anyone else's UCF-Crime AUC. The paper does not try to, which is consistent; it also means the one genuinely cross-dataset result in the review sits on ground nobody else is standing on.",
      ],
      takeaways: [
        "Trained on RWF-2000, evaluated on UCF-Crime with no additional training — a real zero-shot transfer test.",
        "Eight test videos in total. The AUCs are 0.82-0.87 and no spread is reported.",
        "The frame-level labels are the authors' own replacements for the provided ones, disclosed in the text and published.",
        "Attention helps more here than anywhere else: +0.04 AUC on both backbones, against +0.5 accuracy points within RWF-2000.",
      ],
      pdfPage: 11,
    },
  ],
};
