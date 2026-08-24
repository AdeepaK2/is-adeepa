import type { StudyModule } from "@/types/study";

/**
 * Ullah, Muhammad, Haq, Khan, Heidari, Baik & de Albuquerque (2022),
 * "AI-Assisted Edge Vision for Violence Detection in IoT-Based Industrial
 * Surveillance Networks". IEEE Trans. Industrial Informatics 18(8):5359-5370.
 *
 * Review extraction and study module.
 *
 * Not to be confused with V004, a different paper by different authors that
 * also names its model VD-Net.
 *
 * Table map, for anyone checking the numbers against the PDF:
 *   T1 p5   guns/knives detection dataset      T3 p7   ConvLSTM vs VD-Net
 *   T2 p7   VD dataset statistics              T4 p10  comparison to prior work
 *
 * T1-T4 do not extract as text; their cells were read off pages rendered at
 * 200 dpi. Only the accuracy columns are restated in the prose (§IV-C-1,
 * §IV-C-2, §IV-D), and every one of those matches the table. T3 also carries
 * per-dataset TP/TN/FP/FN counts, AUC, and columns labelled precision, recall
 * and F1 -- recomputing the counts shows the last three are not what their
 * headings say, which is recorded in the protocol notes.
 *
 * Figures: F1 p4 (the five-step framework), F2 p5 (detection samples), F3 p5
 * (ConvLSTM cell), F4 p7 (dataset samples), F5 p8 (ConvLSTM ROC/AUC), F6 p9
 * (VD-Net confusion matrices), F7 p9 (VD-Net ROC/AUC), F8 p10 (bar charts).
 */
export const moduleEdgeVisionIiot: StudyModule = {
  slug: "edge-vision-iiot",

  premise:
    "Most violence detection papers propose a network. This one proposes a division of labour across a network: a YOLOv3-tiny on a Raspberry Pi screens every sixth frame for people and weapons and fires an early alert the moment it sees a gun or a knife, and only the frames it flagged travel to a cloud GPU where a ConvLSTM feeding a GRU decides whether what is happening is violence. Both halves are timed on named hardware, which is rare in this library. The two halves are never evaluated joined together, which is the problem.",

  results: [
    { label: "Surveillance Fight", value: "75.9%", note: "+3.9 over Aktı et al.'s 72%, T4" },
    { label: "RWF-2000", value: "88.2%", note: "+0.95 over Flow Gated Network's 87.25%, T4" },
    { label: "Hockey Fight", value: "98.5%", note: "+0.5, non-surveillance, T4" },
    { label: "Cost", value: "4.47 M / 62 FPS", note: "parameters and cloud throughput, RTX 2080-Ti" },
  ],

  review: {
    architecture: {
      family: "Edge / Lightweight",
      backbone:
        "Two models in series. On the edge, YOLOv3-tiny fine-tuned from Darknet53 ImageNet weights, with the output filter count cut from 255 to 24 for N=3 new classes, trained 4000 epochs at batch 16. On the cloud, five ConvLSTM layers with 3×3 filters and a dropout layer after each, feeding a single GRU, then classification. Adam throughout; VD-Net trained 150 epochs at batch 8.",
      motionEncoding:
        "Recurrent, in two stages, with no convolution over time. The ConvLSTM's gates are convolutional, so the cell and hidden states keep their spatial dimensions as the sequence advances and short-range change is carried in the state rather than computed by a kernel; the GRU then runs over the resulting feature maps for the long-range structure. There is no 3D convolution, no optical flow and no frame differencing anywhere. Before any of that, the edge stage subsamples time by a fixed factor of six.",
      inputs: [
        "RGB frames from the vision sensor; every sixth frame is screened on the edge",
        "Only frames containing a detected human or a detected gun/knife are forwarded to VD-Net",
        "T2 gives each dataset's native frame resolution and frame rate -- variable for three of the four, 360×240 for Hockey Fight, 20-30 fps -- but what VD-Net resizes them to, and how many frames it reads per sequence, is never stated anywhere in the paper",
      ],
      fusion:
        "None in the multi-stream sense. The two models are a cascade, not parallel streams: the detector gates the classifier, and their outputs are never combined. Algorithm 2 makes the gate explicit — if no object is found, the frame is dropped and the loop repeats.",
      supervision:
        "Two different tasks. VD-Net is supervised binary clip classification, violent / nonviolent. The edge model is supervised object detection with annotated bounding boxes over 600 gun and knife images (T1), split 80/20.",
      notes: [
        "The contribution is a systems architecture, not a network. VD-Net itself is a conventional ConvLSTM-into-GRU stack; what is new is placing a cheap detector at the sensor, sending only interesting frames over the network, and raising an alert before the expensive model has run.",
        "The early alert and the final decision answer different questions. The alert fires on a weapon appearing, not on violence occurring — so a knife on a workbench alerts, and a fight with no weapon in frame produces no early alert at all. The paper presents the alert as 'earlier VD' without drawing that distinction.",
        "The gate can only lose recall. Anything the detector misses never reaches VD-Net, and the detector's reported mean average precision is 46.26. Whatever VD-Net's accuracy is, the deployed system's is bounded by the detector's ability to notice a person first.",
        "N is given as 3 for the newly added classes while T1's dataset is described as 600 images of knives and guns. The third class is presumably human, but the paper does not say and T1's contents cannot be read from the extracted text.",
        "Only the detector runs on the edge. VD-Net runs on an RTX 2080-Ti in the cloud, so the violence model itself is never deployed on constrained hardware — the framing as edge violence detection is about where the screening happens, not where the classification does.",
      ],
    },

    attention: {
      used: false,
      kinds: ["none"],
      notes: [
        "No attention module of any kind in either stage — no channel, spatial, temporal or self-attention. The word appears in the paper only in the ordinary sense ('attention has been paid towards VD in industrial surveillance') and once in §IV-D describing Aktı et al.'s method.",
        "That one mention is worth keeping for the attention axis. The method this paper beats by 3.9 points on Surveillance Fight — its headline margin and the number in the abstract — is Aktı et al.'s Xception plus BiLSTM plus attention model at 72%. Here an attention-free ConvLSTM-GRU takes it to 75.9%. It is a single comparison and the splits are not identical, but it is a data point against the assumption that attention is what closes the gap on surveillance footage.",
        "The object-detection gate is a selection mechanism and it is easy to file under attention by mistake. It is not: it is a hard, discrete decision made by a separate supervised model that drops frames entirely, with no soft weighting and no gradient flowing back from the classifier. Detection-then-classify is a cascade, not attention.",
        "Useful as a baseline for the review's attention axis, alongside V001: this is what a plain recurrent spatiotemporal model reaches on RWF-2000 (88.2%) and Surveillance Fight (75.9%) with no attention anywhere.",
      ],
    },

    efficiency: {
      parameters:
        "4,470,298 for VD-Net, against 18,976,770 for the paper's ConvLSTM baseline",
      flops: undefined,
      modelSize: undefined,
      throughput:
        "Cloud: 62 FPS for VD-Net (0.01612 s per frame) against 28 FPS for the ConvLSTM baseline, a 2.21× speedup. Edge: 6 FPS for the detector (1 s per six frames, 0.1666 s per frame); the same detector is given as 250 FPS on the cloud.",
      hardware:
        "Edge: Raspberry Pi 3 model B, Cortex-A53 @ 1.2 GHz, with an Intel Movidius NCS. Cloud: NVIDIA GeForce RTX 2080-Ti. Python 3.5, Keras 2.3.1 on TensorFlow 1.3.1.",
      realTime: {
        status: "measured-and-supported",
        note: "The paper claims real-time IIoT surveillance and then measures both halves on named hardware, which most papers in this library do not. 62 FPS on the cloud GPU, and 6 FPS on the edge while screening only every sixth frame — which is enough to keep pace with a stream of roughly 36 FPS. The numbers are internally consistent: 1/62 = 0.01612 s and 62/28 = 2.21, both as stated. What is not measured is the network round trip between the Pi and the cloud, which is part of the design and part of the end-to-end latency, so the compute is real-time and the system's response time is still unknown.",
      },
      edgeDeployment: {
        status: "measured-and-supported",
        note: "An actual constrained device is named and actually timed: a Raspberry Pi 3 model B at 1.2 GHz, 0.1666 s per frame, with the detector's mean average precision reported at 46.26. Two caveats. The Movidius NCS accelerator the timing depends on appears only in §IV-C-3, not in §IV-A's system configuration, so what the edge device is differs between two sections of the paper. And no power draw or memory footprint is given for the Pi.",
      },
      notes: [
        "The parameter comparison does not measure what it appears to. VD-Net is five ConvLSTM layers plus a GRU; the baseline is 'ConvLSTM'. Adding a GRU cannot remove 14.5 million parameters, so the baseline must differ in its classifier head as well — most likely a fully connected head that VD-Net replaces. The paper never specifies the baseline's architecture, so both the 4.2× parameter reduction and the 2.21× speedup are attributed to the GRU while confounding it with an unstated change the paper does not describe.",
        "mAP 46.26 is a weak detector and it sits in front of everything. The paper reports it in a single clause and never returns to it, never states which classes it is averaged over, and never measures what it costs the system.",
        "No FLOPs, no model size in megabytes, and no memory or power figure for the constrained device — the numbers that would establish the model actually fits the Pi rather than merely being small relative to a baseline.",
        "Throughput in FPS cannot be fully interpreted because the input resolution and sequence length are never given. 62 FPS at an unstated frame size is not a portable number.",
        "The '250 FPS on cloud' figure for the detector appears once, in the same sentence as the edge timing, with no context on batch size or input resolution.",
        "Still, this is the most complete efficiency reporting of the four papers extracted alongside it. Parameters, throughput on two named devices, and a detector accuracy figure — set against V006 and V007, which claim efficiency and measure nothing at all.",
      ],
    },

    evaluation: {
      datasets: [
        {
          name: "Surveillance Camera Fight",
          role: "evaluation",
          note: "Called 'surveillance fight', citing Aktı et al. Indoor, outdoor, night and daytime clips from real surveillance and other sources. The dataset closest to the paper's stated deployment, the lowest score of the four at 75.9%, and the source of the abstract's 3.9-point headline.",
        },
        {
          name: "RWF-2000",
          role: "evaluation",
          note: "Written 'RWF-200' throughout the paper, including in table and figure captions. Indoor and outdoor, day and night, factories and workplaces; entirely surveillance footage with no clips modified.",
        },
        {
          name: "Hockey Fight",
          role: "evaluation",
          note: "Broadcast National Hockey League footage. The paper is explicit that this is a non-surveillance dataset and includes it for its difficulty. Highest score of the four at 98.5%, and the smallest margin over prior work at +0.5.",
        },
        {
          name: "Industrial Surveillance",
          role: "evaluation",
          note: "The paper's own dataset, scraped from YouTube and Google on queries about violence in factories and steel mills, trimmed from 7-12 minute source videos into 5-second violent and nonviolent clips across factories, stores, offices and petrol pumps. Not released. VD-Net scores 80% against the ConvLSTM baseline's 73%; no prior method is run on it.",
        },
        {
          name: "Guns and Knives (600 images)",
          role: "evaluation",
          note: "Not a violence dataset — the training and test set for the edge detector, split 80/20 (T1). Carries the mAP 46.26 result.",
        },
        {
          name: "ImageNet (Darknet53 weights)",
          role: "pre-training",
          note: "The initialisation for YOLOv3-tiny before fine-tuning on the guns and knives images. VD-Net's own initialisation is never stated.",
        },
      ],
      split:
        "60% train, 20% validation, 20% test on all four violence datasets, described as 'a standard splitting procedure'. The detection dataset is split 80/20 with no validation set.",
      metrics: [
        "Accuracy",
        "AUC",
        "ROC curves (F5, F7)",
        "Precision",
        "Recall",
        "F1 score",
        "Confusion matrices (F6)",
        "Mean average precision (detector only)",
        "Frames per second",
        "Parameter count",
      ],
      protocolNotes: [
        "The cascade is never evaluated end to end, and that is the central gap. Every number in T3 and T4 comes from feeding a whole dataset directly to VD-Net. In the deployed system of Fig. 1 and Algorithm 2, VD-Net only ever sees frames a mAP-46.26 detector chose to forward, and anything the detector misses is dropped before classification. There is no experiment measuring the pipeline's accuracy, recall or false-alarm rate as assembled — so the accuracy figures describe one component, and the framework is what the paper is contributing.",
        "The ConvLSTM ablation baseline is never specified. It is the only comparison establishing that the GRU helps, it moves accuracy by 6.5 to 13.9 points across the four datasets, and its parameter count (18.98 M against 4.47 M) shows it differs from VD-Net by more than one GRU layer. Without knowing what changed, neither the accuracy gain nor the efficiency gain is attributable.",
        "On the two surveillance datasets, T4 contains exactly one prior method each: FightCNN + BD-LSTM at 72% on Surveillance Fight, and Flow Gated Network at 87.25% on RWF-2000. Both of the paper's headline margins — the abstract's 3.9 points and the 0.95 in the conclusion — are leads over a single baseline. The Hockey Fight column, where eleven methods are listed and the margin is 0.5, is the only one where the ranking has any depth to it.",
        "The RWF-2000 comparison is not like-for-like. This paper uses its own 60/20/20 split while Flow Gated Network's 87.25% is the published figure on RWF-2000's official 80/20 split — different training-set size and a different test set. The 0.95-point margin is smaller than that discrepancy can be assumed to be worth.",
        "The industrial surveillance dataset is self-collected, self-annotated and not released, and the only method ever run on it besides VD-Net is the paper's own unspecified ConvLSTM baseline. Its 80% cannot be verified or reproduced, and it supports no comparison against anyone else's work.",
        "The metric set is genuinely good on paper — AUC, precision, recall, F1 and TP/TN/FP/FN counts per dataset, not accuracy alone — and the accuracy column checks out exactly against those counts on all eight rows: 353/400 = 88.2 on RWF-2000, 44/58 = 75.9 on Surveillance Fight, and so on for the rest.",
        "The precision, recall and F1 columns are computed from TN rather than TP, so they describe the nonviolent class, and the two labels are swapped even for that class. On all eight rows, to three decimals, the printed precision equals TN/(TN+FP) — specificity, which is the nonviolent class's recall — and the printed recall equals TN/(TN+FN), the negative predictive value, which is its precision. The printed F1 is the harmonic mean of those two. The three rows where TP and TN differ enough to distinguish the readings all confirm it: VD-Net on RWF-2000 prints 0.849/0.930 where TN/(TN+FP) and TN/(TN+FN) give exactly 0.849 and 0.930, while the violent class gives 0.835 and 0.923.",
        "So the numbers a violence alarm is actually judged on are absent from the paper, and recoverable from it. Computed from T3's own counts, VD-Net's violent-class precision / recall / F1 are 0.742 / 0.793 / 0.767 on Surveillance Fight, 0.835 / 0.923 / 0.877 on RWF-2000, 0.990 / 0.980 / 0.985 on Hockey Fight and 0.774 / 0.828 / 0.800 on the industrial set. The error is not systematically flattering — it understates the model on Surveillance Fight and overstates it on both RWF-2000 rows — which is what you would expect from a mix-up rather than a thumb on the scale.",
        "Read the violent-class figures and the picture on real surveillance footage is harder than the accuracy column suggests. On Surveillance Fight, VD-Net's 75.9% accuracy comes with 8 false positives against 23 true positives on a 58-clip test set: roughly one false alarm for every three correct ones. On RWF-2000 it is 33 false positives against 167 true positives. Those are the ratios that decide whether an operator keeps the alarm switched on, and no sentence in the paper states them.",
        "A validation set exists, at 20%, which is more than most papers here manage. Nothing states what was selected on it, so whether the reported test figures are clean or hyperparameter-selected is not determinable.",
        "The abstract reports 'improving 3.9% increase in the accuracy compared with the state-of-the-art' without naming a dataset; it is the best of three margins. The conclusion reports all three honestly — 3.9%, 0.95% and 0.5% for Surveillance Fight, RWF-2000 and Hockey Fight — so the overstatement is confined to the abstract.",
        "Three of the four datasets are real surveillance footage, which is unusually well-matched to the deployment claim, and the results fall in the expected direction: 98.5% on broadcast hockey against 75.9% on real surveillance camera fights. The paper does not editorialise about the gap, but it does not hide it either.",
        "No cross-dataset test. Each dataset is trained and tested on itself, so nothing establishes that a model trained on scraped YouTube industrial clips transfers to an actual factory's cameras — the paper's own use case.",
      ],
    },
  },

  concepts: [
    {
      id: "cascade",
      title: "The contribution is a division of labour, not a network",
      tagline: "Two models, two machines",
      highlight: {
        label: "Frames reaching the cloud",
        value: "≤ 1 in 6",
        note: "and only those the detector flagged",
      },
      note: [
        "Almost every paper in this library proposes a network. This one proposes a place to put two of them. A YOLOv3-tiny fine-tuned on 600 gun and knife images runs on a Raspberry Pi at the camera, screening every sixth frame for people and weapons. Frames with nothing in them are dropped where they were captured. Frames with something in them travel to a cloud GPU, where VD-Net — five ConvLSTM layers into a GRU — decides whether what is happening is violence.",
        "Read as a network, VD-Net is unremarkable: convolutional recurrence for short-range change, a GRU over the resulting feature maps for longer structure, no 3D kernels, no optical flow, no attention anywhere. Read as a system, the design answers a question the network papers do not ask, which is what you do when the camera and the compute are in different buildings and the link between them is the expensive part.",
        "The early alert is the other half of the idea, and it is worth being precise about what it detects. Algorithm 2 fires the alert when the detector sees a gun or a knife — before VD-Net has run, and independently of anything VD-Net concludes. So a knife left on a workbench raises an alert, and a fistfight with no weapon in frame raises none. The paper describes this as earlier violence detection; it is earlier weapon detection, which is a useful thing and a different thing.",
        "The gate is one-directional and can only lose recall. Nothing the detector misses ever reaches VD-Net. The detector's reported mean average precision is 46.26, so whatever VD-Net scores in the tables, the deployed system's recall is bounded above by a component that finds fewer than half the objects it is looking for.",
      ],
      takeaways: [
        "Detection on the edge, classification in the cloud, and the network link between them is the resource being conserved.",
        "Only the detector runs on constrained hardware. VD-Net runs on an RTX 2080-Ti, so the violence model itself was never deployed at the edge.",
        "The early alert triggers on a weapon, not on violence. The two are presented as one capability.",
        "A cascade is not attention. The detector makes a hard, discrete drop decision with no soft weighting and no gradient flowing back from the classifier.",
      ],
      pdfPage: 4,
    },

    {
      id: "budget",
      title: "Both halves are timed on named hardware, and only one is in the headline",
      tagline: "62 FPS, and what it counts",
      highlight: {
        label: "Edge cost at 30 fps",
        value: "0.83 s",
        note: "of every second of video, before the cloud stage is added",
      },
      note: [
        "This paper measures things, which sets it apart from most of its neighbours here. VD-Net processes 62 frames per second on an RTX 2080-Ti — 0.01612 s per frame — against 28 FPS for the ConvLSTM baseline, a 2.21× speedup. The arithmetic checks: 1/62 = 0.01612 and 62/28 = 2.21. Parameters are given too, 4,470,298 against 18,976,770. The edge side is timed as well: 1 s per six frames on a Raspberry Pi 3 with a Movidius NCS, which the paper converts to 0.1666 s per frame.",
        "The 62 FPS is the number that travels. It describes the cloud stage alone, and the cloud stage is the cheaper of the two by a factor of roughly seventeen per frame. Because the Pi screens one frame in six, its cost per second of incoming video works out at about 0.028 s per stream frame — 0.83 s of compute for every second of video at 30 fps. That fits, with about 17% of headroom, and it stops fitting somewhere around 36 fps.",
        "So the real-time claim holds, and it holds because of the one-in-six subsampling rather than because either model is fast. This is the rare case in this library where a paper claims real time and its own numbers support it, and it is worth marking as such.",
        "Two things are missing from the budget. The network round trip between the Pi and the cloud is part of the design and is never timed, so end-to-end latency — the quantity an alarm is judged by — is not in the paper. And the input resolution and sequence length are never stated, which makes 62 FPS a number that cannot be compared against anyone else's.",
        "One more caution on the parameter comparison. VD-Net is five ConvLSTM layers plus a GRU; the baseline is called 'ConvLSTM' and never specified further. Adding a GRU cannot remove 14.5 million parameters, so the baseline must differ in its classifier head as well — most likely a fully connected head that VD-Net replaces. Both the 4.2× parameter reduction and the 2.21× speedup are credited to the GRU while confounded with a change the paper does not describe.",
      ],
      takeaways: [
        "62 FPS on the cloud GPU, 6 FPS on the Pi, both measured on hardware named to the model number.",
        "The real-time budget closes because five of every six frames are never looked at, not because either model is quick.",
        "The link between edge and cloud is untimed, so the system's actual response time is unknown.",
        "4.47 M against 18.98 M parameters is a real gap attributed to one GRU layer, which cannot account for it.",
      ],
      visual: {
        kind: "throughput-budget",
        options: {
          hue: 250,
          budgetSeconds: 1,
          frameRates: [25, 30, 36, 60],
          // §IV-C-3, p8. The edge figure is the paper's own 0.1666 s per screened
          // frame divided by six, because it screens one stream frame in six.
          // VD-Net is charged at the full rate, which is the worst case: it only
          // sees forwarded frames, and the forwarded fraction is never stated.
          stages: [
            {
              id: "cloud",
              label: "VD-Net on the cloud GPU",
              perFrame: 0.01612,
              countedInClaim: true,
              note: "62 FPS on an RTX 2080-Ti — the paper's headline throughput figure",
            },
            {
              id: "edge",
              label: "YOLOv3-tiny screening on the Raspberry Pi",
              perFrame: 0.02777,
              countedInClaim: false,
              note: "0.1666 s per screened frame, one frame in six, on a Pi 3 with a Movidius NCS",
            },
          ],
          copy: {
            readout: "Compute per second of video",
            scopeLabel: "Counting",
            rateLabel: "Input frame rate",
            chips: { claimed: "the 62 FPS figure", full: "edge + cloud" },
            lines: {
              claimed:
                "What the headline number describes: VD-Net alone, on the cloud GPU, ignoring the device that decides what reaches it.",
              full: "Both timed stages together. The edge screening is the larger of the two per second of video, and it is the reason the budget closes at all.",
            },
          },
        },
        caption:
          "Each solid block is a second of compute owed; the outline is the second available. The network round trip between the two machines is absent because the paper never times it — the pipeline is at least this expensive, not exactly this expensive. Push the frame rate past 36 and the edge stage alone stops fitting.",
      },
      pdfPage: 8,
    },

    {
      id: "gate",
      title: "The pipeline is never evaluated as a pipeline",
      tagline: "mAP 46.26, in front of everything",
      highlight: {
        label: "Detector mean average precision",
        value: "46.26",
        note: "reported in one clause, never revisited",
      },
      note: [
        "Every accuracy figure in this paper — the 75.9%, the 88.2%, the 98.5%, all of Table 3 and Table 4 — comes from feeding a whole dataset directly to VD-Net. In the system the paper is contributing, VD-Net never sees a whole dataset. It sees the frames a detector chose to forward.",
        "That detector's mean average precision is 46.26, reported in a single clause at the end of the edge timing paragraph and never mentioned again. The paper does not say which classes it is averaged over, does not break it down by gun, knife and person, and never measures what it costs the system downstream.",
        "The consequence is structural rather than a matter of degree. The gate is a hard drop: a frame the detector misses is deleted at the camera and cannot be recovered by anything cleverer later. So the deployed system's recall is the product of two recalls, and the paper measures one of them on a task the other one gates. There is no experiment anywhere that runs the two stages joined together and reports what comes out.",
        "This is the gap that matters most, because the framework is the contribution. A conventional ConvLSTM-GRU scoring 88.2% on RWF-2000 is a modest result on its own; the paper's case is that this model in this arrangement makes industrial surveillance practical. The arrangement is the thing that was not evaluated.",
        "It would not have been hard to close. Run the detector over a violence dataset's test clips, forward what it flags, classify those, and report accuracy, recall and false-alarm rate for the assembled system. Every component needed already exists in the paper.",
      ],
      takeaways: [
        "T3 and T4 measure VD-Net in isolation. Fig. 1 and Algorithm 2 describe a system whose classifier only sees pre-filtered frames.",
        "A detector at mAP 46.26 sets a ceiling on the whole system's recall, and that ceiling is never quantified.",
        "The drop is irreversible — no soft score, no second pass, no fallback path for a missed frame.",
        "The end-to-end experiment needs no new components. It was simply not run.",
      ],
      pdfPage: 9,
    },

    {
      id: "metrics",
      title: "The precision and recall columns describe the wrong class",
      tagline: "T3, recomputed",
      highlight: {
        label: "Surveillance Fight, violent class",
        value: "8 FP / 23 TP",
        note: "roughly one false alarm for every three correct ones",
      },
      note: [
        "Table 3 is the best-instrumented table in the paper: TP, TN, FP and FN counts per dataset, then accuracy, AUC, precision, recall and F1, for both the ConvLSTM baseline and VD-Net. Because the raw counts are printed, every derived column can be checked. The accuracy column checks out exactly on all eight rows — 353/400 = 88.2 on RWF-2000, 44/58 = 75.9 on Surveillance Fight.",
        "The precision, recall and F1 columns do not. On all eight rows, to three decimals, the printed precision equals TN/(TN+FP) and the printed recall equals TN/(TN+FN). Those are the nonviolent class's specificity and negative predictive value — computed from TN rather than TP, and with the two labels swapped even for that class. The printed F1 is the harmonic mean of the pair, so it inherits the same problem.",
        "The three rows where TP and TN differ enough to tell the readings apart all confirm it. VD-Net on RWF-2000 prints 0.849 and 0.930; TN/(TN+FP) and TN/(TN+FN) give exactly 0.849 and 0.930, while the violent class gives 0.835 and 0.923. The same holds for ConvLSTM on RWF-2000 and for VD-Net on Surveillance Fight.",
        "So the numbers a violence alarm is judged on are missing from the paper and recoverable from it. VD-Net's violent-class precision, recall and F1 are 0.742 / 0.793 / 0.767 on Surveillance Fight, 0.835 / 0.923 / 0.877 on RWF-2000, 0.990 / 0.980 / 0.985 on Hockey Fight, and 0.774 / 0.828 / 0.800 on the industrial set. The mistake is not systematically flattering — it understates the model on Surveillance Fight and overstates it on both RWF-2000 rows — which reads as a mix-up rather than a thumb on the scale.",
        "What the corrected figures show is a harder picture on real footage than the accuracy column suggests. On Surveillance Fight, 75.9% accuracy comes with 8 false positives against 23 true positives on a 58-clip test set. On RWF-2000, 33 false positives against 167 true positives. Those ratios decide whether an operator keeps an alarm switched on, and no sentence in the paper states them.",
      ],
      takeaways: [
        "Printed precision = TN/(TN+FP), printed recall = TN/(TN+FN), on every row. Both describe the nonviolent class, and both labels are swapped.",
        "The accuracy and AUC columns are unaffected; accuracy reproduces exactly from the printed counts.",
        "Corrected violent-class F1 runs 0.767 on Surveillance Fight to 0.985 on broadcast hockey — the same 20-point spread the accuracy column shows.",
        "Publishing the raw confusion counts is what makes the error findable. Most papers in this library publish neither the counts nor the rates.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          hue: 250,
          mode: "outcome",
          metricLabel: "Accuracy",
          datasetLabel: "Dataset",
          baselineId: "convlstm",
          // T3, p7, read off a rendered page. Accuracy is as printed; sensitivity
          // and specificity are computed from the same row's TP/TN/FP/FN counts,
          // because the columns the paper labels precision and recall are neither.
          datasets: [
            {
              id: "surveillance",
              label: "Surveillance Fight",
              title: "58 test clips of real surveillance footage",
              floor: 50,
              floorLabel: "balanced-class chance",
            },
            {
              id: "industrial",
              label: "Industrial Surveillance",
              title: "60 test clips, the paper's own unreleased dataset",
              floor: 50,
              floorLabel: "balanced-class chance",
            },
            {
              id: "rwf",
              label: "RWF-2000",
              title: "400 test clips of surveillance footage",
              floor: 50,
              floorLabel: "balanced-class chance",
            },
            {
              id: "hockey",
              label: "Hockey Fight",
              title: "200 test clips of broadcast sport",
              floor: 50,
              floorLabel: "balanced-class chance",
            },
          ],
          models: [
            {
              id: "vdnet",
              label: "VD-Net (proposed)",
              metrics: {
                surveillance: { accuracy: 75.9, sensitivity: 79.3, specificity: 72.4 },
                rwf: { accuracy: 88.2, sensitivity: 92.3, specificity: 84.9 },
                hockey: { accuracy: 98.5, sensitivity: 98.0, specificity: 99.0 },
                industrial: { accuracy: 80.0, sensitivity: 82.8, specificity: 77.4 },
              },
            },
            {
              id: "convlstm",
              label: "ConvLSTM baseline (unspecified)",
              metrics: {
                surveillance: { accuracy: 62.0, sensitivity: 66.7, specificity: 58.1 },
                rwf: { accuracy: 85.3, sensitivity: 90.3, specificity: 81.3 },
                hockey: { accuracy: 94.0, sensitivity: 93.9, specificity: 94.1 },
                industrial: { accuracy: 73.0, sensitivity: 74.2, specificity: 72.4 },
              },
            },
          ],
        },
        caption:
          "T3 with the rates recomputed from its own confusion counts. Sensitivity is TP/(TP+FN) on the violent class and specificity is TN/(TN+FP) — neither is what the paper's precision and recall columns contain. The gap between the two rates is the false-alarm story: widest on Surveillance Fight, where the model catches violence better than it leaves quiet footage alone.",
      },
      pdfPage: 7,
    },

    {
      id: "comparison",
      title: "Eleven baselines on broadcast hockey, one on each surveillance set",
      tagline: "T4",
      highlight: {
        label: "Surveillance Fight",
        value: "+3.9",
        note: "over the only other method anyone has run on it",
      },
      note: [
        "Table 4 lists eleven prior methods with their learning strategies, and the shape of the table says as much as the numbers in it. Every one of the eleven carries a Hockey Fight score. Exactly one carries a Surveillance Fight score, and exactly one carries an RWF-2000 score.",
        "So the abstract's headline — a 3.9-point improvement over the state of the art — is a lead over FightCNN + BD-LSTM's 72%, the only other published figure on that dataset. The 0.95 on RWF-2000 is a lead over Flow Gated Network's 87.25%, likewise the only one. The Hockey Fight column, where the margin is 0.5 over two methods tied at 98, is the only ranking in the table with any depth behind it.",
        "That is not a criticism of the authors so much as a description of the field in 2021: the surveillance benchmarks were new and almost nobody had reported on them. It does mean the two margins that matter most are each a comparison against a single number.",
        "The RWF-2000 comparison also is not like-for-like. This paper uses its own 60/20/20 split; Flow Gated Network's 87.25% is the published figure on RWF-2000's official 80/20 split. Different training-set size, different test set, and a 0.95-point margin that is smaller than the difference between two splits can casually be worth.",
        "The one comparison worth extracting for the review's attention axis is on Surveillance Fight. The method beaten there — Aktı et al.'s FightCNN + BD-LSTM — pairs an Xception backbone with a bidirectional LSTM and an attention layer. An attention-free ConvLSTM-GRU takes it from 72% to 75.9%. One comparison, non-identical splits, so not a conclusion; but it is a data point against the assumption that attention is what closes the gap on real surveillance footage.",
      ],
      takeaways: [
        "Eleven baselines on hockey, one each on the two surveillance datasets. Both headline margins are leads over a single method.",
        "Best on all three columns, but the two meaningful margins are 3.9 and 0.95 points against unrepeated baselines.",
        "The RWF-2000 comparison mixes a 60/20/20 split against a published 80/20 one and does not flag it.",
        "The abstract quotes the largest of the three margins without naming a dataset; the conclusion reports all three.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          hue: 250,
          mode: "outcome",
          metricLabel: "Accuracy",
          datasetLabel: "Dataset",
          baselineId: "vdnet",
          // T4, p10, read off a rendered page. Cells the table marks with a cross
          // are absent here, so the readout reports them as not reported.
          datasets: [
            {
              id: "surveillance",
              label: "Surveillance Fight",
              title: "one prior method reports on it",
            },
            {
              id: "rwf",
              label: "RWF-2000",
              title: "one prior method reports on it",
            },
            {
              id: "hockey",
              label: "Hockey Fight",
              title: "all eleven prior methods report on it",
            },
          ],
          models: [
            {
              id: "vdnet",
              label: "VD-Net (proposed)",
              metrics: {
                surveillance: { accuracy: 75.9 },
                rwf: { accuracy: 88.2 },
                hockey: { accuracy: 98.5 },
              },
            },
            {
              id: "fgn",
              label: "Flow Gated Network",
              metrics: { rwf: { accuracy: 87.25 }, hockey: { accuracy: 98 } },
            },
            {
              id: "fightcnn",
              label: "FightCNN + BD-LSTM (with attention)",
              metrics: { surveillance: { accuracy: 72 }, hockey: { accuracy: 98 } },
            },
            {
              id: "iwld",
              label: "IWLD",
              metrics: { hockey: { accuracy: 96.8 } },
            },
            {
              id: "mobsift",
              label: "MoBSIFT",
              metrics: { hockey: { accuracy: 96.5 } },
            },
            {
              id: "hog3d",
              label: "HOG3D + BoVW",
              metrics: { hockey: { accuracy: 95 } },
            },
            {
              id: "hf-2dcnn",
              label: "HF + 2D CNN",
              metrics: { hockey: { accuracy: 94.6 } },
            },
            {
              id: "mmpu",
              label: "MMPU",
              metrics: { hockey: { accuracy: 87.3 } },
            },
            {
              id: "ovif-homo",
              label: "OVIF + HOMO + SVM",
              metrics: { hockey: { accuracy: 89.3 } },
            },
            {
              id: "mobilenet",
              label: "Mobile-Net",
              metrics: { hockey: { accuracy: 87.2 } },
            },
            {
              id: "vf-svm",
              label: "VF-SVM",
              metrics: { hockey: { accuracy: 82.9 } },
            },
            {
              id: "cuboid",
              label: "Cuboid trajectories + HF",
              metrics: { hockey: { accuracy: 82.5 } },
            },
          ],
        },
        caption:
          "T4, measured against VD-Net. Switch to either surveillance dataset and nine of the twelve lanes go blank — those methods were never run on it. The depth of the comparison and the difficulty of the dataset run in opposite directions.",
      },
      pdfPage: 10,
    },
  ],
};
