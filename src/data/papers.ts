import type { ArchitectureFamily, Paper } from "@/types/paper";

/**
 * The paper library, in IN3901 reading-list order.
 *
 * `code` is the reading list's own identifier (V001-V018, with V005 and V014
 * unassigned) and the array is sorted by it, because the home page's default
 * "Reading list order" is just this array's order. It is also the PDF's filename
 * prefix in /public/papers, so a file on disk can be matched to an entry here
 * without opening it.
 *
 * Metadata was taken from each PDF's own front matter. `status: "planned"` means
 * the interactive study module has not been authored yet -- the paper still
 * opens, it just shows the PDF and its overview.
 *
 * One caution about `datasets` on `planned` papers: it is read from the abstract
 * and experimental section, not yet checked against the result tables, and that
 * check has caught errors on every paper reviewed so far -- a dataset named in
 * Related Works and never run is easy to pick up by mistake. The field is
 * corrected when the review extraction is written, and the corrections are
 * recorded in comments next to the entry.
 */
export const papers: Paper[] = [
  {
    code: "V001",
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
    pdf: "/papers/V001-3d-cnn.pdf",
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
    code: "V002",
    slug: "ai-violent-incident-detection",
    title:
      "AI-based Violent Incident Detection in Surveillance Videos to Enhance Public Safety",
    shortTitle: "AI Violent Incident Detection",
    authors: ["Khaled Merit", "Mohammed Beladgham"],
    venue: "Journal of Telecommunications and Information Technology",
    year: 2025,
    doi: "10.26636/jtit.2025.4.2328",
    pageCount: 13,
    pdf: "/papers/V002-ai-violent-incident-detection.pdf",
    summary:
      "A benchmark grid: seven per-frame feature extractors crossed with three temporal classifiers on the same three sets. Nearly every deep combination reaches 1.000, which says more about the benchmarks than about the models.",
    architecture: "CNN-LSTM",
    datasets: ["Hockey Fight", "Movies", "Crowd Violence"],
    tags: ["benchmark", "early alerting", "public safety"],
    hue: 12,
    status: "ready",
  },
  {
    code: "V003",
    slug: "kiannet-cnn-lstm",
    title:
      "KianNet: A Violence Detection Model Using an Attention-Based CNN-LSTM Structure",
    shortTitle: "KianNet",
    authors: ["Soheil Vosta", "Kin-Choong Yow"],
    venue: "IEEE Access",
    year: 2024,
    doi: "10.1109/ACCESS.2023.3339379",
    pageCount: 12,
    pdf: "/papers/V003-kiannet-cnn-lstm.pdf",
    summary:
      "A CNN reads each frame, an LSTM carries the story across frames, and attention decides which moments deserve weight — the classic recipe, tuned for surveillance footage.",
    architecture: "CNN-LSTM",
    // Results are reported on UCF-Crime (four cuts) and RWF-2000; RWF was
    // missing here. Hockey Fight, Movies and Crowd Violence appear in the
    // paper's Table 2 but no experiment is run on any of them -- see the
    // review extraction, which records that distinction per dataset.
    datasets: ["UCF-Crime", "RWF-2000"],
    tags: ["LSTM", "attention", "sequence modelling"],
    hue: 320,
    status: "ready",
  },
  {
    code: "V004",
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
    pdf: "/papers/V004-vd-net-edge-surveillance.pdf",
    // Not to be confused with V010, a different paper by a different group that
    // also names its model VD-Net. This one is ST-TCN based; V010 is ConvLSTM
    // plus a GRU.
    summary:
      "Designs for the camera rather than the datacentre: a compact model that runs on edge hardware, so footage never has to leave the device to be classified. It names the Jetson it targets and never reports a measurement from it.",
    architecture: "Edge / Lightweight",
    // Results are reported on all four in T2, T4 and T5; only Hockey Fight was
    // listed here before. The paper's own names for the last two are "movie
    // fight" and "violent flow" -- see the review extraction, which records the
    // aliases and why the last one is filed as Crowd Violence.
    datasets: [
      "Hockey Fight",
      "Movies",
      "Surveillance Camera Fight",
      "Crowd Violence",
    ],
    tags: ["edge computing", "deployment", "efficiency"],
    hue: 175,
    status: "ready",
  },
  {
    code: "V006",
    slug: "spatio-temporal-model",
    title:
      "A spatio-temporal model for violence detection based on spatial and temporal attention modules and 2D CNNs",
    shortTitle: "Spatial + Temporal Attention",
    authors: ["Javad Mahmoodi", "Hossein Nezamabadi-pour"],
    venue: "Pattern Analysis and Applications",
    year: 2024,
    doi: "10.1007/s10044-024-01265-0",
    pageCount: 18,
    pdf: "/papers/V006-spatio-temporal-model.pdf",
    summary:
      "Keeps the cheap 2D CNN backbone and adds two attention modules — one choosing where to look in the frame, one choosing when in the clip — to recover 3D-level accuracy.",
    architecture: "2D CNN + Attention",
    // Results are reported on all four in T4; Surveillance Camera Fight was
    // missing here before, and it is the dataset the paper actually wins on.
    // The paper's own names for the last three are "Violent Flows", "Action
    // Movies" and "Surveillance Fight" -- see the review extraction.
    datasets: [
      "Hockey Fight",
      "Movies",
      "Crowd Violence",
      "Surveillance Camera Fight",
    ],
    tags: ["spatial attention", "temporal attention", "2D CNN"],
    hue: 25,
    status: "planned",
  },
  {
    code: "V007",
    slug: "scan-convlstm-fight-detection",
    title:
      "Fight detection with spatial and channel wise attention-based ConvLSTM model",
    shortTitle: "SCan-ConvLSTM",
    authors: ["Kunal Chaturvedi", "Chhavi Dhiman", "Dinesh Kumar Vishwakarma"],
    venue: "Expert Systems",
    year: 2024,
    doi: "10.1111/exsy.13474",
    pageCount: 11,
    pdf: "/papers/V007-scan-convlstm-fight-detection.pdf",
    summary:
      "Puts the attention inside the recurrence rather than in front of it: a ConvLSTM encoder re-weights its own activation maps by location and by channel at every step, so where the model looks is refined as the clip plays.",
    architecture: "CNN-LSTM",
    datasets: ["RWF-2000", "Crowd Violence", "Hockey Fight", "Movies"],
    tags: ["ConvLSTM", "spatial attention", "channel attention"],
    hue: 300,
    status: "planned",
  },
  {
    code: "V008",
    slug: "cbam-ubi-fights",
    title:
      "Violence Detection Enhancement by Involving Convolutional Block Attention Modules Into Various Deep Learning Architectures: Comprehensive Case Study for UBI-Fights Dataset",
    shortTitle: "CBAM on UBI-Fights",
    authors: ["Mahmoud Abdelkader Bashery Abbass", "Hyun-Soo Kang"],
    venue: "IEEE Access",
    year: 2023,
    doi: "10.1109/ACCESS.2023.3267409",
    pageCount: 12,
    pdf: "/papers/V008-cbam-ubi-fights.pdf",
    // The summary here previously said the paper isolates the contribution of
    // attention. It does the opposite: all six architectures contain a CBAM and
    // no CBAM-free variant is ever trained -- see the review extraction.
    summary:
      "Drops the same attention block (CBAM) into six architectures, three built from scratch and three wrapping a pre-trained backbone, and argues the small ones match the big ones. Never trains a variant without the block it is named for.",
    // Was "2D CNN + Attention". Every one of the six models pairs a convolutional
    // feature extractor with a recurrent temporal encoder -- ConvLSTM2D, or
    // Conv2D into an LSTM, or a backbone into a BiConvLSTM. None is a plain 2D
    // CNN. The CBAM identity is carried by the tags instead.
    architecture: "CNN-LSTM",
    datasets: ["UBI-Fights"],
    tags: ["CBAM", "attention", "ablation study"],
    hue: 45,
    status: "planned",
  },
  {
    code: "V009",
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
    pdf: "/papers/V009-airtlab-deep-learning.pdf",
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
    code: "V010",
    slug: "edge-vision-iiot",
    title:
      "AI-Assisted Edge Vision for Violence Detection in IoT-Based Industrial Surveillance Networks",
    shortTitle: "Edge Vision for IIoT",
    authors: [
      "Fath U Min Ullah",
      "Khan Muhammad",
      "Ijaz Ul Haq",
      "Noman Khan",
      "Ali Asghar Heidari",
      "Sung Wook Baik",
      "Victor Hugo C. de Albuquerque",
    ],
    venue: "IEEE Transactions on Industrial Informatics",
    year: 2022,
    doi: "10.1109/TII.2021.3116377",
    pageCount: 12,
    pdf: "/papers/V010-edge-vision-iiot.pdf",
    // Also calls its model VD-Net, but it is not V004's model -- different
    // authors, different design, three years earlier.
    summary:
      "Splits the work across the network: a lightweight model on the edge device looks for people and weapons and raises the early alert, and only those frames travel to the cloud for a ConvLSTM and GRU to make the final call.",
    architecture: "Edge / Lightweight",
    datasets: [
      "Surveillance Camera Fight",
      "RWF-2000",
      "Hockey Fight",
      "Industrial Surveillance",
    ],
    tags: ["edge computing", "IIoT", "early alerting"],
    hue: 250,
    status: "planned",
  },
  {
    code: "V011",
    slug: "efficient-realtime-modeling",
    title:
      "Efficient Spatio-Temporal Modeling Methods for Real-Time Violence Recognition",
    shortTitle: "Real-Time Spatio-Temporal Modeling",
    authors: ["Min-Seok Kang", "Rae-Hong Park", "Hyung-Min Park"],
    venue: "IEEE Access",
    year: 2021,
    doi: "10.1109/ACCESS.2021.3083273",
    pageCount: 16,
    pdf: "/papers/V011-efficient-realtime-modeling.pdf",
    summary:
      "Targets the cost of watching many cameras at once, replacing expensive 3D convolutions and optical flow with cheaper motion modelling that still runs in real time.",
    architecture: "2D CNN + Attention",
    // Six evaluation datasets plus UCF-Crime, which carries a reported
    // cross-dataset AUC (T9) rather than being named only. Movies was missing.
    datasets: [
      "RWF-2000",
      "RLVS",
      "Hockey Fight",
      "Movies",
      "Crowd Violence",
      "Surveillance Camera Fight",
      "UCF-Crime",
    ],
    tags: ["real-time", "efficiency", "motion modelling"],
    hue: 190,
    status: "ready",
  },
  {
    code: "V012",
    slug: "violence-4d",
    title:
      "Violence 4D: Violence detection in surveillance using 4D convolutional neural networks",
    shortTitle: "Violence 4D",
    authors: ["Mai Magdy", "Mohamed Waleed Fakhr", "Fahima A. Maghraby"],
    venue: "IET Computer Vision",
    year: 2023,
    doi: "10.1049/cvi2.12162",
    pageCount: 13,
    pdf: "/papers/V012-violence-4d.pdf",
    summary:
      "Adds a fourth dimension on top of 3D convolution so the network models interaction between clips as well as inside them, with a ResNet50 backbone and dense optical flow picking the region of interest.",
    architecture: "3D CNN",
    // All four checked against T2 and T3 (p9-p10) and all four carry results --
    // no correction needed here, the first paper in this review where that was
    // true. Note the optical flow is not a dataset-level input: it selects the
    // crop and is then discarded, so this stays a single-stream RGB model.
    datasets: ["RWF-2000", "Crowd Violence", "Movies", "Hockey Fight"],
    tags: ["4D convolution", "optical flow", "residual blocks"],
    hue: 75,
    status: "ready",
  },
  {
    code: "V013",
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
    pdf: "/papers/V013-multi-frame-feature-fusion.pdf",
    summary:
      "Takes equally spaced frames rather than consecutive ones, extracts features at several depths, and fuses them so both fine detail and broad motion survive into the classifier.",
    // No attention anywhere in the paper -- it is a frozen VGG-16 feeding an
    // LSTM. BEHAVE is its fourth evaluation dataset and was missing here.
    architecture: "CNN-LSTM",
    datasets: ["Hockey Fight", "Movies", "Crowd Violence", "BEHAVE"],
    tags: ["feature fusion", "multi-level features", "frame sampling"],
    hue: 95,
    status: "ready",
  },
  {
    code: "V015",
    slug: "spiking-neural-networks",
    title:
      "Integrating Spatial and Temporal Information for Violent Activity Detection from Video Using Deep Spiking Neural Networks",
    shortTitle: "Deep Spiking Neural Networks",
    authors: ["Xiang Wang", "Jie Yang", "Nikola K. Kasabov"],
    venue: "Sensors",
    year: 2023,
    doi: "10.3390/s23094532",
    pageCount: 17,
    pdf: "/papers/V015-spiking-neural-networks.pdf",
    summary:
      "Swaps continuous activations for neurons that fire in discrete spikes, so time is encoded in the network itself rather than bolted on — a natural fit for low-power hardware.",
    architecture: "Spiking Neural Network",
    datasets: ["RWF-2000", "Hockey Fight", "Movies", "Crowd Violence"],
    tags: ["spiking neurons", "neuromorphic", "temporal coding"],
    hue: 135,
    status: "planned",
  },
  {
    code: "V016",
    slug: "cnn-convlstm-temporal-attention",
    title:
      "Spatiotemporal violence detection in surveillance video via CNN-ConvLSTM with temporal attention fusion",
    shortTitle: "CNN-ConvLSTM + Temporal Attention",
    authors: [
      "Azza El-Fiky",
      "Nawal El-Fishawy",
      "Athar A. Ein-Shoka",
      "Randa Mohamed Bayoumi",
      "Rasha Shoitan",
    ],
    venue: "Results in Engineering",
    year: 2026,
    doi: "10.1016/j.rineng.2026.111076",
    pageCount: 16,
    pdf: "/papers/V016-cnn-convlstm-temporal-attention.pdf",
    summary:
      "Argues a purpose-built small CNN beats a pretrained backbone for this task: a custom lightweight extractor feeds a ConvLSTM and a temporal attention module, and is measured against VGG-16, VGG-19 and MobileNetV2 on the same four sets.",
    architecture: "CNN-LSTM",
    // All four checked against T4 (p8) and T5 (p13) and all four carry results.
    // "Surveillance Camera Fight" is the paper's "Surveillance Fight" -- the
    // same 300-clip Akti et al. set V011 evaluates on, kept under the library's
    // name. No correction needed.
    datasets: [
      "Hockey Fight",
      "RLVS",
      "Surveillance Camera Fight",
      "AIRTLab",
    ],
    tags: ["ConvLSTM", "temporal attention", "lightweight"],
    hue: 345,
    status: "ready",
  },
  {
    code: "V017",
    slug: "bidirectional-motion-attention",
    title:
      "Lightweight Violence Detection Model Based on 2D CNN with Bi-Directional Motion Attention",
    shortTitle: "Bi-Directional Motion Attention",
    authors: ["Jingwen Wang", "Daqi Zhao", "Haoming Li", "Deqiang Wang"],
    venue: "Applied Sciences",
    year: 2024,
    doi: "10.3390/app14114895",
    pageCount: 20,
    pdf: "/papers/V017-bidirectional-motion-attention.pdf",
    summary:
      "Keeps a 2D CNN and recovers the missing time axis with a motion attention module that reads change in both temporal directions, aiming at 3D-model accuracy without paying 3D-model cost.",
    architecture: "2D CNN + Attention",
    datasets: ["RWF-2000", "Hockey Fight", "Movies", "Crowd Violence"],
    tags: ["motion attention", "lightweight", "2D CNN"],
    hue: 115,
    status: "planned",
  },
  {
    code: "V018",
    slug: "dynamic-3d-attention-maps",
    title:
      "A temporal–spatial deep learning framework leveraging dynamic 3D attention maps for violence detection",
    shortTitle: "Dynamic 3D Attention Maps",
    authors: [
      "Elizabeth B. Varghese",
      "Almiqdad Elzein",
      "Yin Yang",
      "Marwa Qaraqe",
    ],
    venue: "Neural Computing and Applications",
    year: 2025,
    doi: "10.1007/s00521-025-11641-4",
    pageCount: 21,
    pdf: "/papers/V018-dynamic-3d-attention-maps.pdf",
    summary:
      "Rejects whole-clip classification: violence occupies small regions in space and time, so the model predicts where, when and for how long to attend, and reasons over several attended regions at once.",
    // Family is provisional. The framework is attention-first over spatiotemporal
    // volumes with a residual 3D backbone, which the closed family list has no
    // exact slot for -- confirm against the architecture when the review
    // extraction is written.
    architecture: "3D CNN",
    datasets: [
      "Surveillance Camera Fight",
      "Hockey Fight",
      "RLVS",
      "Crowd Violence",
      "MSV",
    ],
    tags: ["3D attention maps", "region attention", "interpretability"],
    hue: 230,
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
