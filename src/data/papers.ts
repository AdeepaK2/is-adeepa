import type { ArchitectureFamily, Paper } from "@/types/paper";

/**
 * The paper library. Metadata was taken from each PDF's own front matter.
 * `status: "planned"` means the interactive study module has not been authored
 * yet — the paper still opens, it just shows the PDF and its overview.
 */
export const papers: Paper[] = [
  {
    slug: "3d-cnn",
    title:
      "Violence recognition on videos using two-stream 3D CNN with custom spatiotemporal crop",
    shortTitle: "Two-Stream 3D CNN",
    authors: [
      "Raka Aditya Pratama",
      "Novanto Yudistira",
      "Fitra Abdurrachman Bachtiar",
    ],
    venue: "Multimedia Tools and Applications",
    year: 2024,
    doi: "10.1007/s11042-023-15599-0",
    pageCount: 23,
    pdf: "/papers/3d-cnn.pdf",
    summary:
      "Runs RGB frames and optical flow through two parallel 3D CNNs, then adds a custom spatiotemporal crop so the network trains on the region where the action actually happens.",
    architecture: "Two-Stream",
    // Results are reported on RWF-2000 only. Crowd Violence and UCF-Crime are
    // named in the introduction as existing datasets and never run -- see the
    // review extraction, which records that distinction per dataset.
    datasets: ["RWF-2000"],
    tags: ["3D convolution", "optical flow", "data augmentation"],
    hue: 210,
    status: "ready",
  },
  {
    slug: "accurate-violence-detection",
    title:
      "An accurate violence detection framework using unsupervised spatial–temporal action translation network",
    shortTitle: "Action Translation Network",
    authors: [
      "Tahereh Zarrat Ehsan",
      "Manoochehr Nahvi",
      "Seyed Mehdi Mohtavipour",
    ],
    venue: "The Visual Computer",
    year: 2024,
    doi: "10.1007/s00371-023-02865-3",
    pageCount: 21,
    pdf: "/papers/accurate-violence-detection.pdf",
    summary:
      "Sidesteps the small-dataset problem by learning without labels: a translation network maps an action's appearance to its motion, and violence shows up as the cases the model cannot reproduce.",
    architecture: "Unsupervised / Generative",
    datasets: ["Hockey Fight", "Movies", "Crowd Violence"],
    tags: ["unsupervised", "action translation", "limited data"],
    hue: 280,
    status: "planned",
  },
  {
    slug: "ai-violent-incident-detection",
    title:
      "AI-based Violent Incident Detection in Surveillance Videos to Enhance Public Safety",
    shortTitle: "AI Violent Incident Detection",
    authors: ["Khaled Merit", "Mohammed Beladgham"],
    venue: "Journal of Telecommunications and Information Technology",
    year: 2025,
    doi: "10.26636/jtit.2025.4.2328",
    pageCount: 13,
    pdf: "/papers/ai-violent-incident-detection.pdf",
    summary:
      "A comparison study: several modern recognition backbones are applied to the same three benchmark sets to see which combination is realistic for an alerting system in the field.",
    architecture: "3D CNN",
    datasets: ["Hockey Fight", "Movies", "Crowd Violence"],
    tags: ["benchmark", "early alerting", "public safety"],
    hue: 12,
    status: "planned",
  },
  {
    slug: "airtlab-deep-learning",
    title:
      "Deep Learning for Automatic Violence Detection: Tests on the AIRTLab Dataset",
    shortTitle: "AIRTLab Benchmark",
    authors: [
      "Paolo Sernani",
      "Nicola Falcionelli",
      "Selene Tomassini",
      "Paolo Contardo",
      "Aldo Franco Dragoni",
    ],
    venue: "IEEE Access",
    year: 2021,
    doi: "10.1109/ACCESS.2021.3131315",
    pageCount: 16,
    pdf: "/papers/airtlab-deep-learning.pdf",
    summary:
      "Introduces the AIRTLab dataset, built specifically to expose false positives, and measures how well established detectors hold up when non-violent action looks superficially violent.",
    architecture: "3D CNN",
    // RWF-2000 and Movies are discussed in Related Works only; no experiment is
    // run on either. This lists the three datasets results are reported on.
    datasets: ["AIRTLab", "Hockey Fight", "Crowd Violence"],
    tags: ["dataset", "false positives", "evaluation"],
    hue: 160,
    status: "ready",
  },
  {
    slug: "cbam-ubi-fights",
    title:
      "Violence Detection Enhancement by Involving Convolutional Block Attention Modules Into Various Deep Learning Architectures: Comprehensive Case Study for UBI-Fights Dataset",
    shortTitle: "CBAM on UBI-Fights",
    authors: ["Mahmoud Abdelkader Bashery Abbass", "Hyun-Soo Kang"],
    venue: "IEEE Access",
    year: 2023,
    doi: "10.1109/ACCESS.2023.3267409",
    pageCount: 12,
    pdf: "/papers/cbam-ubi-fights.pdf",
    summary:
      "Drops the same attention block (CBAM) into a range of backbones and measures what it buys in each, isolating the contribution of attention rather than of the architecture around it.",
    architecture: "2D CNN + Attention",
    datasets: ["UBI-Fights"],
    tags: ["CBAM", "attention", "ablation study"],
    hue: 45,
    status: "planned",
  },
  {
    slug: "efficient-realtime-modeling",
    title:
      "Efficient Spatio-Temporal Modeling Methods for Real-Time Violence Recognition",
    shortTitle: "Real-Time Spatio-Temporal Modeling",
    authors: ["Min-Seok Kang", "Rae-Hong Park", "Hyung-Min Park"],
    venue: "IEEE Access",
    year: 2021,
    doi: "10.1109/ACCESS.2021.3083273",
    pageCount: 16,
    pdf: "/papers/efficient-realtime-modeling.pdf",
    summary:
      "Targets the cost of watching many cameras at once, replacing expensive 3D convolutions and optical flow with cheaper motion modelling that still runs in real time.",
    architecture: "2D CNN + Attention",
    datasets: [
      "RWF-2000",
      "RLVS",
      "Hockey Fight",
      "Crowd Violence",
      "Surveillance Camera Fight",
      "UCF-Crime",
    ],
    tags: ["real-time", "efficiency", "motion modelling"],
    hue: 190,
    status: "planned",
  },
  {
    slug: "kiannet-cnn-lstm",
    title:
      "KianNet: A Violence Detection Model Using an Attention-Based CNN-LSTM Structure",
    shortTitle: "KianNet",
    authors: ["Soheil Vosta", "Kin-Choong Yow"],
    venue: "IEEE Access",
    year: 2024,
    doi: "10.1109/ACCESS.2023.3339379",
    pageCount: 12,
    pdf: "/papers/kiannet-cnn-lstm.pdf",
    summary:
      "A CNN reads each frame, an LSTM carries the story across frames, and attention decides which moments deserve weight — the classic recipe, tuned for surveillance footage.",
    architecture: "CNN-LSTM",
    datasets: ["UCF-Crime"],
    tags: ["LSTM", "attention", "sequence modelling"],
    hue: 320,
    status: "planned",
  },
  {
    slug: "lightweight-vit-cbam-lstm",
    title:
      "Lightweight Vision Transformer with CBAM and LSTM for Efficient Violence Detection in Image Sequences",
    shortTitle: "Lightweight ViT + CBAM + LSTM",
    authors: ["Aishvarya Garg", "Swati Nigam", "Rajiv Singh"],
    venue: "Signal, Image and Video Processing",
    year: 2026,
    doi: "10.1007/s11760-026-05207-7",
    pageCount: 9,
    pdf: "/papers/lightweight-vit-cbam-lstm.pdf",
    summary:
      "Cuts a Vision Transformer down to a size that can actually be deployed, then leans on CBAM and an LSTM to recover the spatial and temporal detail the smaller model gives up.",
    architecture: "Vision Transformer",
    datasets: ["RWF-2000", "Hockey Fight", "AIRTLab"],
    tags: ["transformer", "CBAM", "lightweight"],
    hue: 265,
    status: "planned",
  },
  {
    slug: "multi-frame-feature-fusion",
    title: "Multi-frame feature-fusion-based model for violence detection",
    shortTitle: "Multi-Frame Feature Fusion",
    authors: [
      "Mujtaba Asad",
      "Jie Yang",
      "Jiang He",
      "Pourya Shamsolmoali",
      "Xiangjian He",
    ],
    venue: "The Visual Computer",
    year: 2021,
    doi: "10.1007/s00371-020-01878-6",
    pageCount: 17,
    pdf: "/papers/multi-frame-feature-fusion.pdf",
    summary:
      "Takes equally spaced frames rather than consecutive ones, extracts features at several depths, and fuses them so both fine detail and broad motion survive into the classifier.",
    architecture: "2D CNN + Attention",
    datasets: ["Hockey Fight", "Movies", "Crowd Violence"],
    tags: ["feature fusion", "multi-level features", "frame sampling"],
    hue: 95,
    status: "planned",
  },
  {
    slug: "spatio-temporal-model",
    title:
      "A spatio-temporal model for violence detection based on spatial and temporal attention modules and 2D CNNs",
    shortTitle: "Spatial + Temporal Attention",
    authors: ["Javad Mahmoodi", "Hossein Nezamabadi-pour"],
    venue: "Pattern Analysis and Applications",
    year: 2024,
    doi: "10.1007/s10044-024-01265-0",
    pageCount: 18,
    pdf: "/papers/spatio-temporal-model.pdf",
    summary:
      "Keeps the cheap 2D CNN backbone and adds two attention modules — one choosing where to look in the frame, one choosing when in the clip — to recover 3D-level accuracy.",
    architecture: "2D CNN + Attention",
    datasets: ["Hockey Fight", "Movies", "Crowd Violence"],
    tags: ["spatial attention", "temporal attention", "2D CNN"],
    hue: 25,
    status: "planned",
  },
  {
    slug: "spiking-neural-networks",
    title:
      "Integrating Spatial and Temporal Information for Violent Activity Detection from Video Using Deep Spiking Neural Networks",
    shortTitle: "Deep Spiking Neural Networks",
    authors: ["Xiang Wang", "Jie Yang", "Nikola K. Kasabov"],
    venue: "Sensors",
    year: 2023,
    doi: "10.3390/s23094532",
    pageCount: 17,
    pdf: "/papers/spiking-neural-networks.pdf",
    summary:
      "Swaps continuous activations for neurons that fire in discrete spikes, so time is encoded in the network itself rather than bolted on — a natural fit for low-power hardware.",
    architecture: "Spiking Neural Network",
    datasets: ["RWF-2000", "Hockey Fight", "Movies", "Crowd Violence"],
    tags: ["spiking neurons", "neuromorphic", "temporal coding"],
    hue: 135,
    status: "planned",
  },
  {
    slug: "vd-net-edge-surveillance",
    title: "VD-Net: An Edge Vision-Based Surveillance System for Violence Detection",
    shortTitle: "VD-Net",
    authors: [
      "Mustaqeem Khan",
      "Abdulmotaleb El Saddik",
      "Wail Gueaieb",
      "Giulia De Masi",
      "Fakhri Karray",
    ],
    venue: "IEEE Access",
    year: 2024,
    doi: "10.1109/ACCESS.2024.3380192",
    pageCount: 13,
    pdf: "/papers/vd-net-edge-surveillance.pdf",
    summary:
      "Designs for the camera rather than the datacentre: a compact model that runs on edge hardware, so footage never has to leave the device to be classified.",
    architecture: "Edge / Lightweight",
    datasets: ["Hockey Fight"],
    tags: ["edge computing", "deployment", "efficiency"],
    hue: 175,
    status: "planned",
  },
];

export const architectureFamilies: ArchitectureFamily[] = [
  "3D CNN",
  "Two-Stream",
  "2D CNN + Attention",
  "CNN-LSTM",
  "Vision Transformer",
  "Spiking Neural Network",
  "Unsupervised / Generative",
  "Edge / Lightweight",
];

export function getPaper(slug: string): Paper | undefined {
  return papers.find((paper) => paper.slug === slug);
}

/** Every dataset referenced across the library, sorted by how often it appears. */
export function allDatasets(): string[] {
  const counts = new Map<string, number>();
  for (const paper of papers) {
    for (const dataset of paper.datasets) {
      counts.set(dataset, (counts.get(dataset) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);
}
