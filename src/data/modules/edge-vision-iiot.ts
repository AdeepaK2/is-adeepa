import type { StudyModule } from "@/types/study";

/**
 * Ullah, Muhammad, Haq, Khan, Heidari, Baik & de Albuquerque (2022),
 * "AI-Assisted Edge Vision for Violence Detection in IoT-Based Industrial
 * Surveillance Networks". IEEE Trans. Industrial Informatics 18(8):5359-5370.
 *
 * Review extraction only -- no study module has been authored for this paper.
 *
 * Not to be confused with V004, a different paper by different authors that
 * also names its model VD-Net.
 *
 * Table map, for anyone checking the numbers against the PDF:
 *   T1 p5   guns/knives detection dataset      T3 p7   ConvLSTM vs VD-Net
 *   T2 p7   VD dataset statistics              T4 p10  comparison to prior work
 *
 * T2, T3 and T4 are raster images and do not extract as text. Their accuracy
 * columns are restated in the prose of §IV-C-1, §IV-C-2 and §IV-D and are used
 * here; T3's AUC, precision, recall and F1 columns appear nowhere in the text
 * and are therefore not quoted in this extraction.
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
        "Sequence length, frame resolution and frame rate for VD-Net's input are never stated anywhere in the paper",
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
        "The RWF-2000 comparison is not like-for-like. This paper uses its own 60/20/20 split while Flow Gated Network's 87.25% is the published figure on RWF-2000's official 80/20 split — different training-set size and a different test set. The 0.95-point margin is smaller than that discrepancy can be assumed to be worth.",
        "The industrial surveillance dataset is self-collected, self-annotated and not released, and the only method ever run on it besides VD-Net is the paper's own unspecified ConvLSTM baseline. Its 80% cannot be verified or reproduced, and it supports no comparison against anyone else's work.",
        "The metric set is genuinely good — AUC, precision, recall, F1 and per-dataset confusion matrices, not accuracy alone — but only the accuracy column is restated in the prose. T3's other columns are a raster image, so the false-positive behaviour the paper did measure is not recoverable from the text without reading the page by eye.",
        "A validation set exists, at 20%, which is more than most papers here manage. Nothing states what was selected on it, so whether the reported test figures are clean or hyperparameter-selected is not determinable.",
        "The abstract reports 'improving 3.9% increase in the accuracy compared with the state-of-the-art' without naming a dataset; it is the best of three margins. The conclusion reports all three honestly — 3.9%, 0.95% and 0.5% for Surveillance Fight, RWF-2000 and Hockey Fight — so the overstatement is confined to the abstract.",
        "Three of the four datasets are real surveillance footage, which is unusually well-matched to the deployment claim, and the results fall in the expected direction: 98.5% on broadcast hockey against 75.9% on real surveillance camera fights. The paper does not editorialise about the gap, but it does not hide it either.",
        "No cross-dataset test. Each dataset is trained and tested on itself, so nothing establishes that a model trained on scraped YouTube industrial clips transfers to an actual factory's cameras — the paper's own use case.",
      ],
    },
  },
};
