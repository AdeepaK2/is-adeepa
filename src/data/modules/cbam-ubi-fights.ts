import type { StudyModule } from "@/types/study";

/**
 * Abbass & Kang (2023), "Violence Detection Enhancement by Involving
 * Convolutional Block Attention Modules Into Various Deep Learning
 * Architectures: Comprehensive Case Study for UBI-Fights Dataset".
 * IEEE Access 11:37096-37107.
 *
 * Review extraction and study module.
 *
 * Table map, for anyone checking the numbers against the PDF:
 *   T1 p3   prior work on UBI-Fights, AUC and EER
 *   T2 p10  all six architectures: accuracy, CFL value, AUC, EER
 *   T3 p11  the three simple architectures against prior work
 *
 * None of the three tables extracts as text -- pypdf returns the surrounding
 * prose and skips the table bodies entirely. Their cells were read off pages
 * rendered at 200 dpi, and every one is cross-checked against the prose that
 * restates it (§I-A for prior work, §V-A for T2, §V-B for T3). The two places
 * where a table and the prose disagree are recorded in the protocol notes.
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
    { label: "Best prior on UBI-Fights", value: "0.931", note: "Qi et al., AUC in T1 and T3; EER 0.085" },
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
        "One sentence misnames the metric the headline comparison rests on, and the tables settle it. §I-A reports Qi et al.'s result as '0.931 for ACC, and 0.085 for EER'; T1 and T3 both place the same 0.931 in a column headed AUC, alongside the 0.085 under EER. Two tables against one sentence of prose, so the comparison in §V-B — 0.9493 AUC against 0.931 AUC — reads as sound and the 'ACC' is a slip. Worth recording because the claim to beat the state of the art depends entirely on that one label.",
        "The EER half of that claim is supported and is printed, which the AUC half nearly was not. T3 puts this paper's Conv2D&LSTM at 0.0507 against Qi et al.'s 0.085 in the same table, and lower EER is better, so the margin is real: the false-accept and false-reject rates cross at roughly 5% rather than 8.5%. Against the weaker baselines the gap is much larger — 0.284 for Degardin and 0.427 for Alarfaj et al.",
        "A second, smaller number disagreement runs the other way. §V-A gives the ConvLSTM-based architecture's AUC as 0.9246; T2 and T3 both print 0.925 for the same model. Immaterial to any conclusion, but it is the second place in four pages where the prose and the tables do not match to the digit.",
        "The four prior methods are not doing the same task. Degardin (0.819 AUC, 0.284 EER), Tan et al.'s R(2+1)D+BERT (0.915 AUC), Alarfaj et al. (0.769 AUC, 0.427 EER) and Qi et al. (0.931) are weakly-supervised or anomaly-detection methods scored on UBI-Fights' frame-level protocol over its native class distribution. This paper scores video-level classification on a class-balanced, augmentation-inflated set. The numbers share a dataset name and a metric name and measure different things; T3 ranks them as if they were interchangeable.",
        "Twenty-five frames per video against a 4.8-minute average duration is the protocol decision that most limits what these results mean. The paper states both numbers itself — 80 hours, 1000 videos, 25 frames covering the overall video — and asserts the sampling saves memory 'without reducing the overall performance', with no experiment varying the frame count to support it. Every architecture in the paper is built to read motion, and the input it is given cannot contain any.",
        "Only one dataset, and the paper says so: the conclusion lists extension to other data as future work, and no cross-dataset test exists. Nothing establishes that any of the six architectures transfers off UBI-Fights.",
        "The metric argument is the paper's best contribution and it makes it well. §V-A shows Conv2D&LSTM at 0.9545 accuracy against VGG16's 0.9515, while the AUC ordering runs the other way at 0.9493 against 0.9523, and concludes that accuracy alone cannot rank these models. On a set that was balanced by augmentation, in a domain where the false-alarm rate decides whether an alarm is usable, that is the right instinct — reporting EER alongside AUC is more than most papers in this library do.",
        "No precision, recall, F1 or confusion matrix appears despite EER being reported, so the FAR/FRR pair is summarised at its crossing point and nowhere else. There is no operating point analysis, which is what a deployment would actually need to choose.",
        "T2 is the only place several of these numbers exist, and it does not extract as text — the table bodies have to be read off a rendered page. In full: ConvLSTM2D+CBAM 0.9242 accuracy / 0.0156 loss / 0.925 AUC / 0.0754 EER; Conv2D&LSTM+CBAM 0.9545 / 0.0100 / 0.9493 / 0.0507; ConvLSTM2D&LSTM+CBAM 0.9333 / 0.0134 / 0.9336 / 0.0664; ResNet50+CBAM 0.9455 / 0.0111 / 0.9460 / 0.0540; VGG16+CBAM 0.9515 / 0.0103 / 0.9523 / 0.0477; MobileNet+CBAM 0.9333 / 0.0124 / 0.9339 / 0.0661. The prose restates only the six AUC values and one accuracy pair.",
        "Read as a spread, T2 is narrower than the paper's framing suggests. Every one of the six architectures lands between 0.925 and 0.9523 AUC — a range of 2.7 points across models that differ by two orders of magnitude in size, on a test set whose violent half is largely augmented copies of training footage. That is the observation the paper's 'simple matches complicated' claim rests on, and it is equally consistent with the benchmark having stopped discriminating.",
      ],
    },
  },

  concepts: [
    {
      id: "ablation",
      title: "The ablation study never removes the thing it is ablating",
      tagline: "The gap under the title",
      highlight: {
        label: "Runs without CBAM",
        value: "zero",
        note: "across six architectures and one dataset",
      },
      note: [
        "Section IV opens by promising 'an ablation research ... to evaluate the value of proposed architectures based on the attention mechanism (i.e. CBAM)'. Section IV-C then describes what that ablation is: six architectures, three built from scratch and three wrapping a pre-trained backbone, compared against each other on UBI-Fights.",
        "Every one of the six contains a CBAM. There is no seventh model without one. So the experiment measures which backbone is better, which is a real question and is answered — but it is not the question the section name, the paper title or the opening sentence describe. A single CBAM-free run of any one of the six architectures would have produced the number the whole paper is named after, and it does not exist.",
        "This matters more than a labelling quibble because the paper's conclusion states the causal claim directly: 'Due to the integration of CBAM with those simple architectures, the spatio-temporal feature extraction process is possible.' Nothing in the paper distinguishes that from the alternative — that a ConvLSTM stack and an LSTM tail would have reached the same numbers with the module deleted.",
        "The block itself is Woo et al.'s CBAM used off the shelf. Channel attention first: average-pool and max-pool the feature map to two per-channel descriptors, push both through a shared MLP, add, sigmoid. Then spatial attention: pool along the channel axis instead, concatenate the two maps, run a 7×7 convolution, sigmoid. Each result multiplies the features it was computed from — F′ = M_c(F) ⊗ F, then F″ = M_s(F′) ⊗ F′.",
        "One thing to watch when reading §II-A-3. The equations are mislabelled: Eq. 1 gives the 7×7-convolution form, which is spatial attention, and Eq. 2 gives the MLP form, which is channel attention, but both are written as M_c(F) and Eq. 3 and 4 then both apply M_c. The narrative paragraph above them and Figure 1 describe the module correctly; only the formal specification is wrong.",
      ],
      takeaways: [
        "Six architectures all containing CBAM, compared to each other. That is a backbone comparison, not an attention ablation.",
        "The conclusion asserts CBAM causes the result. No experiment in the paper separates the block's effect from the architecture around it.",
        "CBAM is applied unmodified inside TimeDistributed or recurrent wrappers, so it attends within each frame independently. Nothing compares one frame to another — there is no temporal attention here at all.",
        "Attention is never visualised. No saliency figure, no localisation check, on a dataset that carries frame-level annotations the paper does not use.",
      ],
      visual: {
        kind: "attention-map",
        options: {
          hue: 45,
          gridSize: [6, 6],
          channels: 4,
          combine: "product",
          residual: false,
          // `effect` is omitted entirely, and that is the concept. No variant of
          // any architecture was trained without CBAM, so every configuration --
          // including the full block -- reads as unmeasured.
          branches: [
            {
              id: "channel",
              label: "channel",
              note: "shared MLP over the average- and max-pooled descriptors, one weight per channel",
            },
            {
              id: "spatial",
              label: "spatial",
              note: "7×7 convolution over the channel-pooled maps, one weight per position",
            },
          ],
          copy: {
            readout: "AUC with this configuration",
            branchLabel: "Sub-module",
            lines: {
              channel:
                "Channel attention alone, applied first in CBAM's sequence. One weight per channel, identical at every position.",
              spatial:
                "Spatial attention alone, applied second, to the already channel-weighted features. One weight per position, identical on every channel.",
              both: "The full CBAM: F′ = M_c(F) ⊗ F, then F″ = M_s(F′) ⊗ F′. This is what all six architectures use, and the only configuration ever trained.",
            },
          },
        },
        caption:
          "CBAM as the six architectures use it. The readout is empty on every setting, including the one the paper ships — no configuration of this block, and no model without it, was ever measured. Mask shapes are illustrative; the paper publishes no attention maps.",
      },
      pdfPage: 5,
    },

    {
      id: "spread",
      title: "Six architectures, 2.7 points apart, and the metric decides the winner",
      tagline: "T2",
      highlight: {
        label: "Ranking flip",
        value: "accuracy vs AUC",
        note: "Conv2D&LSTM leads on one, VGG16 on the other",
      },
      note: [
        "Table 2 reports all six models on four columns: accuracy, categorical focal loss value, AUC and EER. Read down the AUC column and the whole field sits between 0.925 and 0.9523. That is a 2.7-point range across models that differ by orders of magnitude in size — a from-scratch stack topping out at 32 filters and a 32-unit LSTM, against a full VGG16.",
        "The paper reads that as its result: simple architectures match complicated ones, so the simple ones are the better deal. That reading is reasonable, and there is an equally consistent one it does not consider — that the benchmark, as this paper has prepared it, has stopped discriminating between models at all.",
        "The genuinely good observation in §V-A is about metrics. Conv2D&LSTM scores 0.9545 accuracy against VGG16's 0.9515, so on accuracy the small model wins. On AUC the order reverses: 0.9493 against 0.9523. On EER it reverses too: 0.0507 against 0.0477. The paper spots this, says plainly that 'the accuracy metric only is not suitable for evaluating the best model performance', and switches its state-of-the-art comparison to AUC and EER.",
        "That instinct is right and it is rarer in this library than it should be. Accuracy on a class-balanced set tells you nothing about where the operating point sits, and for an alarm the false-positive rate is the number that decides whether anyone keeps it switched on. Reporting EER at all puts this paper ahead of most of its neighbours.",
        "What it stops short of is an operating-point analysis. EER summarises the FAR/FRR trade-off at exactly one point — where the two curves cross — and no deployment runs there by choice. No precision, recall, F1 or confusion matrix appears anywhere in the paper, so the curve either side of that crossing is not recoverable.",
      ],
      takeaways: [
        "All six AUCs fall in [0.925, 0.9523]. The best from-scratch model is 0.3 points behind the best pre-trained one.",
        "Accuracy ranks Conv2D&LSTM first; AUC and EER both rank VGG16 first. Same models, same test set.",
        "The paper identifies the flip itself and switches metrics because of it — the right call, made explicitly.",
        "EER is one point on a curve. Without precision, recall or a confusion matrix, no other operating point can be read off this paper.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          hue: 45,
          mode: "outcome",
          metricLabel: "Score",
          datasetLabel: "Metric",
          baselineId: "conv2d-lstm",
          // T2, p10, read off a rendered page -- the table does not extract as
          // text. Values are the paper's decimals x100 so accuracy and AUC share
          // one axis; EER is left out because lower is better there and the
          // readout's delta would invert.
          datasets: [
            {
              id: "auc",
              label: "AUC",
              title: "the metric the paper ranks on",
            },
            {
              id: "accuracy",
              label: "Accuracy",
              title: "the metric the paper argues against using alone",
            },
          ],
          models: [
            {
              id: "vgg16",
              label: "VGG16 + CBAM",
              metrics: {
                auc: { accuracy: 95.23 },
                accuracy: { accuracy: 95.15 },
              },
            },
            {
              id: "conv2d-lstm",
              label: "Conv2D&LSTM + CBAM (from scratch)",
              metrics: {
                auc: { accuracy: 94.93 },
                accuracy: { accuracy: 95.45 },
              },
            },
            {
              id: "resnet50",
              label: "ResNet50 + CBAM",
              metrics: {
                auc: { accuracy: 94.6 },
                accuracy: { accuracy: 94.55 },
              },
            },
            {
              id: "mobilenet",
              label: "MobileNet + CBAM",
              metrics: {
                auc: { accuracy: 93.39 },
                accuracy: { accuracy: 93.33 },
              },
            },
            {
              id: "convlstm2d-lstm",
              label: "ConvLSTM2D&LSTM + CBAM (from scratch)",
              metrics: {
                auc: { accuracy: 93.36 },
                accuracy: { accuracy: 93.33 },
              },
            },
            {
              id: "convlstm2d",
              label: "ConvLSTM2D + CBAM (from scratch)",
              metrics: {
                auc: { accuracy: 92.5 },
                accuracy: { accuracy: 92.42 },
              },
            },
          ],
        },
        caption:
          "T2 as two rankings of the same six models. Values are the paper's decimals scaled by 100 so both metrics share an axis. Switch between AUC and Accuracy and the top two lanes trade places — which is the paper's own argument for not ranking on accuracy.",
      },
      pdfPage: 10,
    },

    {
      id: "sampling",
      title: "Twenty-five frames spread across an average of 4.8 minutes",
      tagline: "The input, and what it cannot contain",
      highlight: {
        label: "Gap between sampled frames",
        value: "≈11 s",
        note: "80 hours / 1000 videos, 25 frames per video",
      },
      note: [
        "The paper states both halves of this itself and never puts them together. UBI-Fights is 80 hours of footage across 1000 videos, so the average video runs about 4.8 minutes. Section III then says that to fit memory, 'each video in the data is divided into 25 frames only, which covers the overall video'.",
        "Twenty-five frames distributed across 4.8 minutes puts roughly eleven seconds between consecutive samples. Every architecture in this paper is built to read motion — ConvLSTM2D gates, an LSTM over per-frame features, a BiConvLSTM after a frozen backbone — and none of them can, because two frames eleven seconds apart share almost no motion information. A punch takes a fraction of a second. It falls between the samples, or it does not.",
        "What the models are actually classifying, then, is a set of 25 loosely related stills: scene type, lighting, crowd density, camera motion, whether the footage looks like the kind of clip a violent event gets uploaded from. Those are learnable and they will separate the classes on this dataset. They are not spatiotemporal features, whatever the recurrent layers are named.",
        "Section IV-A asserts the sampling 'proves its effectiveness to save memory size, without reducing the overall performance of the proposed classification models'. No experiment varies the frame count. That claim has no measurement behind it anywhere in the paper.",
        "There is one thing this does buy, and the paper never claims it: inference cost per video is fixed regardless of length. Whether a video is thirty seconds or twenty minutes, the model reads 25 frames. It also means no decision can be made until the video has ended, which rules out the live alarm the paper's 'fast response time in real life' is describing.",
      ],
      takeaways: [
        "25 frames per video, chosen for memory, spanning the whole duration — roughly one sample every eleven seconds on average.",
        "Short-range motion cannot survive that sampling, so the recurrent layers have nothing to recur over that a fight would show up in.",
        "The claim that this costs no performance is asserted once and never tested; no run varies the frame count.",
        "UBI-Fights carries frame-level annotations. The paper discards them and predicts one label per video.",
      ],
      pdfPage: 7,
    },

    {
      id: "leak",
      title: "The violence class was augmented before the split, not after",
      tagline: "Why every number here is inflated",
      highlight: {
        label: "Violence videos",
        value: "216 → 864",
        note: "rotation, flipping and noise, then shuffled and cut 70/15/15",
      },
      note: [
        "UBI-Fights is imbalanced: 216 violence videos against 784 non-violence. The paper's fix is standard enough — augment the minority class by rotation, flipping and noise until it reaches 864, close to parity. The order of operations is the problem.",
        "Section III does the augmentation. Section IV-A then says that in 'the final preparation step before feeding into the models, the data is shuffled and spitted into training, validating, and testing sets' at 70/15/15. Augmentation first, split second. That means roughly four variants of each of the 216 source videos exist, and shuffling scatters them at random across all three sets.",
        "So nearly every violent video in the test set has near-duplicates the model trained on — the same footage rotated, or mirrored, or with noise added. Those are not independent samples. A model does not need to have learned what violence looks like to score well on them; it needs to have learned what those 216 specific videos look like, which is a much easier problem and one it has seen four views of.",
        "This affects every figure in Tables 2 and 3, on all six architectures, by an amount nobody has measured. The paper does not raise it. The fix is routine and costs nothing: split the 216 source videos first, then augment only the training partition.",
        "It also interacts with the previous concept in a way worth noticing. If the models are largely reading scene-level appearance rather than motion, then rotated and noised copies of the same scene are close to the same input, and the leak is at its most severe exactly where the signal is weakest.",
      ],
      takeaways: [
        "Augment, then shuffle, then split. Copies of the same source video land in train, validation and test.",
        "The test set's violent half is mostly transformed duplicates of training footage. Its 15% is not unseen data in the sense the paper uses the word.",
        "Every AUC, EER and accuracy figure in the paper is inflated by an unmeasured amount. The relative ordering of the six may survive; the absolute values do not.",
        "Correcting it is a two-line change to the pipeline order, and the paper's comparison to prior work depends on it.",
      ],
      pdfPage: 8,
    },

    {
      id: "prior",
      title: "Ahead of the state of the art, on a version of the task nobody else ran",
      tagline: "T3",
      highlight: {
        label: "Margin over best prior",
        value: "+1.83",
        note: "0.9493 against Qi et al.'s 0.931 AUC — different task, different distribution",
      },
      note: [
        "Table 3 ranks the three from-scratch architectures against four published methods on UBI-Fights. The proposed Conv2D&LSTM leads at 0.9493 AUC and 0.0507 EER, against Qi et al. at 0.931 and 0.085, Tan et al.'s R(2+1)D with BERT attention at 0.915, Degardin at 0.819 / 0.284 and Alarfaj et al. at 0.769 / 0.427. On the printed numbers the win is clear, and the EER margin — a crossing point near 5% rather than 8.5% — is the more meaningful half of it.",
        "The four prior methods are not doing this task. They are weakly-supervised or anomaly-detection systems scored on UBI-Fights' frame-level protocol over its native 216/784 distribution. This paper scores video-level binary classification on a class-balanced set whose violent half is augmentation-inflated, from 25 frames per video. The numbers share a dataset name and a metric name and measure different things, and T3 ranks them as though they were interchangeable.",
        "Frame-level scoring is the harder version. It asks when in a 4.8-minute video the violence occurs, not merely whether it occurs, and it is scored against a class distribution that is 78% non-violent. The annotations that would allow it are in the dataset and the paper does not use them.",
        "One metric label is worth checking, because the headline depends on it. §I-A describes Qi et al.'s result as '0.931 for ACC, and 0.085 for EER'. Both T1 and T3 place the same 0.931 in a column headed AUC. Two tables against one sentence of prose, so the comparison stands — but a paper whose central claim is an AUC margin of 1.83 points should not leave any doubt about which metric the number it is beating was measured in.",
      ],
      takeaways: [
        "The margin over the best prior is 1.83 AUC points and roughly 3.4 EER points, both in the proposed model's favour on the printed numbers.",
        "The comparison is video-level against frame-level, balanced against native distribution, augmented against not. The paper flags none of it.",
        "Only four prior methods exist for this dataset, and two of them sit below 0.82 AUC, so the ranking is thin at the top and wide at the bottom.",
        "§I-A calls Qi et al.'s 0.931 an accuracy; T1 and T3 both call it an AUC. The tables agree with each other.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          hue: 45,
          mode: "outcome",
          metricLabel: "AUC",
          datasetLabel: "Dataset",
          baselineId: "qi",
          // T3, p11, read off a rendered page. Values are the paper's decimals
          // x100. Deltas run against the best prior method so each lane reads as
          // a margin over the state of the art the paper claims to beat.
          datasets: [
            {
              id: "ubi",
              label: "UBI-Fights",
              title: "1000 videos, 80 hours — but not all on the same task",
            },
          ],
          models: [
            {
              id: "conv2d-lstm",
              label: "Conv2D&LSTM + CBAM (ours)",
              metrics: { ubi: { accuracy: 94.93 } },
            },
            {
              id: "convlstm2d-lstm",
              label: "ConvLSTM2D&LSTM + CBAM (ours)",
              metrics: { ubi: { accuracy: 93.36 } },
            },
            {
              id: "qi",
              label: "Weakly supervised two-stage framework",
              metrics: { ubi: { accuracy: 93.1 } },
            },
            {
              id: "convlstm2d",
              label: "ConvLSTM2D + CBAM (ours)",
              metrics: { ubi: { accuracy: 92.5 } },
            },
            {
              id: "r21d-bert",
              label: "R(2+1)D + BERT attention",
              metrics: { ubi: { accuracy: 91.5 } },
            },
            {
              id: "degardin",
              label: "Iterative learning, Bayesian filtration",
              metrics: { ubi: { accuracy: 81.9 } },
            },
            {
              id: "alarfaj",
              label: "XG-Boost + moving-human preprocessing",
              metrics: { ubi: { accuracy: 76.9 } },
            },
          ],
        },
        caption:
          "T3, measured against the best prior method. All three from-scratch architectures clear it, but the four baselines are frame-level scores on the dataset's native distribution while the three proposed lanes are video-level scores on a balanced, augmented set. The bars are comparable; the tasks behind them are not.",
      },
      pdfPage: 11,
    },

    {
      id: "cost",
      title: "The efficiency conclusion is inferred from accuracy, not measured",
      tagline: "An RTX 3090 and no timings",
      highlight: {
        label: "Cost figures reported",
        value: "none",
        note: "no parameters, FLOPs, model size or latency, for any of the six",
      },
      note: [
        "The hardware is named to the model number: an Intel Core i7-12700K at 3.60 GHz, 32 GB of RAM, an NVIDIA RTX 3090, Windows 10, TensorFlow. That is more specific than most papers in this library manage, and nothing is measured on it.",
        "The efficiency claim is instead derived from the accuracy table. §V-A observes that Conv2D&LSTM beats ResNet50 and MobileNet on AUC and concludes 'that means saving in computation cost and fast response time in real life'. The conclusion repeats it: parity with the complicated architectures 'means saving computation cost and memory size'. Both sentences reason from a number in the AUC column to a claim about seconds and megabytes.",
        "The direction is almost certainly right. A from-scratch stack capped at 32 filters with a 32-unit LSTM is obviously smaller than VGG16 wrapped in TimeDistributed. That is exactly why leaving it unmeasured is a wasted opportunity rather than a small omission — Table 2 already carries four columns per architecture, and a fifth holding parameter counts would have converted the paper's second headline from an assertion into a result.",
        "The 'fast response time in real life' claim does not survive the paper's own preprocessing in any case. A decision requires 25 frames spread across the whole video, so no prediction can be issued until the video has ended. Whatever this system's per-video latency is, it cannot be used as a live alarm, and the paper's efficiency framing never confronts that.",
        "For the review's efficiency axis this is claimed-without-evidence. The paper does not contradict itself — it simply reasons about cost without measuring cost, on a workstation it describes precisely enough to have measured it on.",
      ],
      takeaways: [
        "Hardware named exactly; nothing timed, counted or sized on it.",
        "Cost conclusions are inferred from AUC parity between a small model and a large one — an inference, not a measurement.",
        "Not one parameter count for any of the six architectures, which is the single number the paper's simple-versus-complicated argument needed.",
        "Twenty-five frames spread over the whole video means the decision comes after the video ends. That is not a response time any live system can use.",
      ],
      pdfPage: 8,
    },
  ],
};
