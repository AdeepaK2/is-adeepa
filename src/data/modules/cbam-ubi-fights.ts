import type { StudyModule } from "@/types/study";

/**
 * Abbass & Kang (2023), "Violence Detection Enhancement by Involving
 * Convolutional Block Attention Modules Into Various Deep Learning
 * Architectures: Comprehensive Case Study for UBI-Fights Dataset".
 * IEEE Access 11:37096-37107.
 *
 * Review extraction only -- no study module has been authored for this paper.
 *
 * Table map, for anyone checking the numbers against the PDF:
 *   T1 p3   prior work on UBI-Fights, AUC and EER
 *   T2 p10  all six architectures: accuracy, CFL value, AUC, EER
 *   T3 p11  the three simple architectures against prior work
 *
 * All three tables are raster images and do not extract as text. Every figure
 * quoted below is taken from the running prose that restates them -- §I-A for
 * the prior-work values, §V-A for T2, §V-B for T3 -- so each is traceable to a
 * sentence as well as to a table. Where the prose and a table label disagree,
 * that disagreement is itself recorded in the protocol notes.
 *
 * Figures: F1 p4 (CBAM sub-modules), F2 p5 (the three from-scratch
 * architectures), F3 p6 (the three transfer-learning architectures), F4 p9
 * (ROC curves for all six), F5 p10 (overall layout).
 */
export const moduleCbamUbiFights: StudyModule = {
  slug: "cbam-ubi-fights",

  premise:
    "Six architectures, one dataset, one attention block. Three are built from scratch out of ConvLSTM2D or TimeDistributed Conv2D plus an LSTM; three wrap a pre-trained ResNet50, VGG16 or MobileNet in the same recurrent tail. Every one of them contains a CBAM, and the paper's case is that the small ones match the big ones, so attention plus a few layers is enough. The comparison it calls an ablation never removes the thing being ablated.",

  results: [
    { label: "Conv2D&LSTM", value: "0.9493", note: "AUC, best simple model; EER 0.0507" },
    { label: "VGG16-based", value: "0.9523", note: "AUC, best overall; EER 0.0477" },
    { label: "Best prior on UBI-Fights", value: "0.931", note: "Qi et al. — called ACC in §I-A, AUC in §V-B" },
    { label: "Cost", value: "not reported", note: "hardware named, nothing timed or counted" },
  ],

  review: {
    architecture: {
      family: "CNN-LSTM",
      backbone:
        "Six of them, all recurrent. Three from scratch (F2): stacked ConvLSTM2D at 4/8/8/16 filters with MaxPooling3D; TimeDistributed Conv2D at 8/16/32/32 filters into a 32-unit LSTM; and a ConvLSTM2D stack at 4/8/16/32 into the same 32-unit LSTM. Three transfer-learning (F3): ResNet50, VGG16 or MobileNet wrapped in TimeDistributed, then a Bidirectional ConvLSTM with 16 filters at 2×2, then the same flatten / 32-unit LSTM / softmax tail.",
      motionEncoding:
        "Recurrent in every variant -- ConvLSTM2D gates, or an LSTM over per-frame 2D features, or a BiConvLSTM after a frozen-or-not backbone. There is no 3D convolution, no optical flow and no frame differencing. What that recurrence is stepped over is the problem: each video is reduced to 25 frames spread across its entire duration, and UBI-Fights is 80 hours over 1000 videos, so the average clip runs about 4.8 minutes and consecutive sampled frames sit roughly eleven seconds apart. Short-range motion, which is what a fight is, cannot survive that sampling.",
      inputs: [
        "RGB frames, pixel values normalised to [0,1]",
        "Exactly 25 frames per video, 'distributed on overall video time interval', chosen to fit memory rather than to preserve motion",
        "Frame resolution is never stated for any of the six architectures",
      ],
      fusion:
        "None -- single stream throughout. CBAM applies its two attention maps sequentially, channel then spatial, within each block.",
      supervision:
        "Supervised binary classification, one label per video. Categorical focal loss with γ=2 and α=0.25, Adam at default parameters, batches of 50 videos, early stopping on validation loss. UBI-Fights carries frame-level annotations and the paper discards them.",
      notes: [
        "CBAM placement is the same recipe every time: one convolutional or recurrent layer, then the CBAM, then a pooling layer. In the simple architectures it appears in the last one or two feature blocks; in the transfer-learning ones it sits once, after the BiConvLSTM and before the final pooling.",
        "§II-A-1 justifies DenseNet at length as a component of the work, including how it would be lifted to video with TimeDistributed. No proposed architecture uses DenseNet. It appears in none of the six, in neither figure, and in no results table.",
        "The categorical focal loss is a second, unmeasured contribution. It is argued for on class-imbalance grounds, and the imbalance it addresses was already removed by augmenting the violence class to parity before training. No run compares it against categorical cross-entropy.",
        "The transfer-learning backbones' initialisation and whether they are frozen are never stated -- 'ready models' is as specific as the paper gets.",
      ],
    },

    attention: {
      used: true,
      kinds: ["channel", "spatial"],
      mechanisms: [
        {
          name: "Convolutional Block Attention Module (CBAM), unmodified from Woo et al.",
          placement:
            "After a feature-extraction layer and before pooling, in every one of the six architectures. Channel attention first — MLP over average- and max-pooled descriptors — then spatial attention, a 7×7 convolution over the concatenated pooled maps, each applied by element-wise multiplication (Eq. 3-4).",
          reportedEffect:
            "Not measured anywhere. No variant without CBAM is trained, on any architecture, so the paper reports no number for what its title claims to enhance.",
        },
      ],
      notes: [
        "This is the paper's central gap and it sits directly under its title. §IV opens by promising 'an ablation research ... to evaluate the value of proposed architectures based on the attention mechanism (i.e. CBAM)', and what §IV-C actually does is compare six architectures that all contain CBAM against each other. That measures which backbone is better, not what attention contributes. A single CBAM-free run of any one of the six would have answered it.",
        "So the comparison this paper supports is simple-versus-complicated, not attention-versus-none. On that question its evidence is decent: Conv2D&LSTM at 0.9493 AUC against ResNet50's 0.9460 and MobileNet's 0.9339, with only VGG16's 0.9523 ahead of it.",
        "CBAM is used off the shelf with no adaptation to video. It is a 2D image module applied inside a TimeDistributed or recurrent wrapper, so it attends within each frame independently. Nothing in either sub-module compares one frame to another, and there is no temporal attention of any kind.",
        "The equations are mislabelled. Eq. 1 gives the 7×7-convolution form, which is spatial attention, and Eq. 2 gives the MLP form, which is channel attention — but the prose assigns Eq. 1 to the channel module and Eq. 2 to the spatial one, and both are written as M_c(F). Eq. 3 and 4 then both apply M_c. The narrative description and F1 are correct; the formal specification is not.",
        "Attention is never visualised or localised. There is no saliency figure, no qualitative example and no check that the attention maps fall on the people fighting, which for a paper about attention on a frame-level-annotated dataset is a striking omission.",
      ],
    },

    efficiency: {
      parameters: undefined,
      flops: undefined,
      modelSize: undefined,
      throughput: undefined,
      hardware:
        "Intel Core i7-12700K @ 3.60 GHz, 32 GB RAM, NVIDIA GeForce RTX 3090, Windows 10, TensorFlow/Python. Named precisely, and used for no reported measurement.",
      realTime: {
        status: "claimed-without-evidence",
        note: "§V-A concludes that a simple architecture beating ResNet50 and MobileNet on AUC 'means saving in computation cost and fast response time in real life', and the conclusion repeats that the Conv2D&LSTM architecture's parity with the complicated ones 'means saving computation cost and memory size'. Both are inferences from accuracy, not measurements of cost. No inference time, frame rate or latency appears anywhere in the paper.",
      },
      edgeDeployment: {
        status: "not-addressed",
        note: "No edge, embedded or on-camera deployment is discussed. The only hardware named is a desktop workstation with an RTX 3090.",
      },
      notes: [
        "The efficiency claim is the paper's second headline and nothing in it is quantified. Not one parameter count, FLOP figure, model size or wall-clock number for any of the six architectures — the very comparison that would make 'simple beats complicated' worth something. T2 already has four columns per architecture; a fifth would have settled it.",
        "The architectures are small in an obvious way that the paper never states numerically. The from-scratch ones top out at 32 filters and a 32-unit LSTM. Against ResNet50 and VGG16 the gap is surely large, which is exactly why leaving it unmeasured is a wasted opportunity rather than a minor omission.",
        "Twenty-five frames per video is a real and unusual cost bound: inference is fixed per video regardless of whether the video is thirty seconds or twenty minutes. The paper presents this only as a memory workaround and never as an efficiency property, and never costs the sampling either.",
        "The 'fast response time in real life' claim does not survive its own preprocessing anyway. A decision needs 25 frames spread across the whole video, so no decision can be made until the video has ended — which is not a property any live surveillance alarm can use.",
      ],
    },

    evaluation: {
      datasets: [
        {
          name: "UBI-Fights",
          role: "evaluation",
          note: "The only dataset used, and the paper's stated reason for choosing it is scale: 80 hours over 1000 videos, 216 violence and 784 non-violence, scraped from YouTube and LiveLeak, annotated at frame level. Indoor and outdoor, moving and stationary cameras, varied angles and colour. The frame-level annotations are not used — the task here is one label per video.",
        },
      ],
      split:
        "70 / 15 / 15 train / validation / test, cited to 'the author's experience', taken by shuffling the dataset after the violence class has been augmented to 864 videos against 784 non-violence. Early stopping on validation loss; the test 15% is reported as unseen.",
      metrics: [
        "AUC",
        "EER",
        "Accuracy",
        "Categorical focal loss value",
        "ROC curves (F4)",
      ],
      protocolNotes: [
        "Augmentation happens before the split, and that invalidates the violence-class results. The 216 real violence videos are expanded to 864 by rotation, flipping and noise, and only then is the whole set shuffled and cut 70/15/15. Roughly four variants of each source video therefore exist, distributed at random across train, validation and test, so nearly every violent video in the test set has near-duplicates the model trained on. Rotated and noised copies of the same footage are not independent samples. Every AUC and EER figure in T2 and T3 is inflated by an amount the paper does not measure and never raises.",
        "The headline comparison compares two different metrics. §V-B claims 0.9493 AUC beats 'an AUC value of 0.931 for the two-stage weakly supervised framework in [8]'. §I-A, describing the same paper, reports its performance as '0.931 for ACC, and 0.085 for EER'. One of the two statements is wrong, and the sentence establishing that this work beats the state of the art depends on which. Note also that this paper's own EER of 0.0507 is worse than the 0.085 figure only if EER is read the other way round — the paper asserts its EER is lower without printing the comparison.",
        "The four prior methods are not doing the same task. Degardin (0.819 AUC, 0.284 EER), Tan et al.'s R(2+1)D+BERT (0.915 AUC), Alarfaj et al. (0.769 AUC, 0.427 EER) and Qi et al. (0.931) are weakly-supervised or anomaly-detection methods scored on UBI-Fights' frame-level protocol over its native class distribution. This paper scores video-level classification on a class-balanced, augmentation-inflated set. The numbers share a dataset name and a metric name and measure different things; T3 ranks them as if they were interchangeable.",
        "Twenty-five frames per video against a 4.8-minute average duration is the protocol decision that most limits what these results mean. The paper states both numbers itself — 80 hours, 1000 videos, 25 frames covering the overall video — and asserts the sampling saves memory 'without reducing the overall performance', with no experiment varying the frame count to support it. Every architecture in the paper is built to read motion, and the input it is given cannot contain any.",
        "Only one dataset, and the paper says so: the conclusion lists extension to other data as future work, and no cross-dataset test exists. Nothing establishes that any of the six architectures transfers off UBI-Fights.",
        "The metric argument is the paper's best contribution and it makes it well. §V-A shows Conv2D&LSTM at 0.9545 accuracy against VGG16's 0.9515, while the AUC ordering runs the other way at 0.9493 against 0.9523, and concludes that accuracy alone cannot rank these models. On a set that was balanced by augmentation, in a domain where the false-alarm rate decides whether an alarm is usable, that is the right instinct — reporting EER alongside AUC is more than most papers in this library do.",
        "No precision, recall, F1 or confusion matrix appears despite EER being reported, so the FAR/FRR pair is summarised at its crossing point and nowhere else. There is no operating point analysis, which is what a deployment would actually need to choose.",
        "T1, T2 and T3 are raster images in the PDF. Their values are recoverable only from the prose that restates them, which is how the ACC/AUC discrepancy in the previous notes came to light — and it means the tables cannot be checked cell by cell without reading them off the page by eye.",
      ],
    },
  },
};
