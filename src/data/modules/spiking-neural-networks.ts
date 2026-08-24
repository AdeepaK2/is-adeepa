import type { StudyModule } from "@/types/study";

/**
 * Wang, Yang & Kasabov (2023), "Integrating Spatial and Temporal Information
 * for Violent Activity Detection from Video Using Deep Spiking Neural
 * Networks". Sensors 23:4532.
 *
 * Review extraction and study module.
 *
 * Table map, for anyone checking the numbers against the PDF:
 *   T1 p4   benchmark preview (a subset of T2)  T4 p12  training time, inference FPS
 *   T2 p11  accuracy on four sets + parameters  T5 p13  precision, recall, F1
 *   T3 p11  HMDB51 and UCF101, multi-class
 *
 * Figures: F1 p5 (IF-neuron backprop), F2 p6 (architecture and block detail),
 * F3 p7 (spike density per block), F4 p9 (frame-at-a-time vs clip input),
 * F5 p10 (dataset samples), F6 p13 (confusion matrices), F7 p14 (feature maps).
 *
 * F6's four matrices do not extract as text and were read off a page rendered
 * at 190 dpi. Two things were checked against them and both hold: the accuracy
 * column of T2 reproduces from the diagonals (51.1 + 47.3 = 98.4 on Hockey,
 * 42.6 + 45.9 = 88.5 on RWF-2000), and every value in T5 reproduces from the
 * same matrices using the standard definitions of precision and recall on the
 * violent class. That matters because the paper's prose defines FP and FN the
 * wrong way round -- see the protocol notes.
 */
export const moduleSpikingNeuralNetworks: StudyModule = {
  slug: "spiking-neural-networks",

  premise:
    "Every other model in this library reads time by holding a stack of frames: a 3D kernel spans them, a recurrent state is stepped over them, an optical flow field is computed between them. This paper changes the neuron instead. Integrate-and-fire units accumulate input across frames in their own membrane potential and emit a binary spike when it crosses a threshold, so the network carries history internally and consumes video one frame at a time with nothing buffered. It costs 0.178 M parameters, runs at 372.8 FPS on a CPU, and gives up between one and four accuracy points against much larger models.",

  results: [
    { label: "RWF-2000", value: "88.5%", note: "T2 — ahead of Flow Gated Network's 87.2" },
    { label: "Hockey Fight", value: "98.4%", note: "T2 — behind Context-LSTM's 99.2" },
    { label: "Parameters", value: "0.178 M", note: "against 1.7 M, 11.7 M and 94.8 M in the same table" },
    { label: "Inference", value: "372.8 FPS", note: "on a Xeon CPU, optical flow not counted" },
  ],

  review: {
    architecture: {
      family: "Spiking Neural Network",
      backbone:
        "SpikeConvFlowNet: two parallel streams of three SpikeConv blocks each, a merging block, then two fully connected layers (F2). A SpikeConv block is a 3×3 Conv2d, a 2×2 AvgPool2d and a layer of integrate-and-fire neurons; the merging block is the same with a 5×5 convolution. Average pooling rather than max pooling is a deliberate choice — the block outputs are sparse binary tensors, and max-pooling them would discard most of what little is there. No pre-trained backbone anywhere; 0.178 M parameters in total.",
      motionEncoding:
        "Three mechanisms, only one of which is conventional. First, and centrally, in the neuron: an IF unit adds its weighted spike inputs into a membrane potential V(t) = V(t−1) + O(t), fires a binary spike and resets to zero when V crosses Vth = 0.75, so each neuron's state at frame t is an accumulation of everything it has received since it last fired. Second, an explicit optical flow stream, computed outside the network and fed in as grayscale. Third, nothing — there is no 3D convolution, no recurrent gate and no frame differencing. Every convolution in the model is 2D and spans exactly one frame.",
      inputs: [
        "RGB frames, downsampled and cropped to 320×240",
        "Grayscale optical flow for the corresponding frame pair, computed before the network runs",
        "Frames are consumed one at a time, in order, with no clip buffer — the model emits a prediction after each and the outputs accumulate until the video ends",
        "Video length is deliberately not normalised; batch size is 1 when a dataset has variable-length clips and 64 otherwise",
      ],
      fusion:
        "Mid-level and learned. Each stream's accumulated output feature maps are concatenated, then passed through the merging block — a 5×5 convolution, 2×2 average pool and another IF layer — before flattening into the classifier. Not late fusion of two class-score vectors, and not early fusion of two input tensors.",
      supervision:
        "Supervised binary clip classification, fight / non-fight, trained end to end with a surrogate gradient. Cross-entropy summed over every timestep plus an L2 penalty (Eq. 1), Adam at lr 0.01, λ 0.01, Vth 0.75, all three 'empirically set by trial and error'. The final layer is the exception to the spiking design: it integrates weighted spikes without firing and applies a sigmoid, which makes the last derivative exact and the rest approximate.",
      notes: [
        "The surrogate gradient is what makes any of this trainable. A spike is a hard threshold, so ∂O/∂V does not exist; the paper substitutes the constant 1/Vth for every hidden layer, which is the straight-through estimator. Gradients therefore flow through a linear approximation of a step function, and a neuron that never fires is assigned a derivative of zero.",
        "The design is explicitly a shallow one, and for a stated reason. Deep spiking networks suffer the vanishing spike phenomenon — spike activity thins out with depth until later layers receive almost nothing — so the paper keeps each stream to three blocks and leans on convolution for representational power rather than depth.",
        "Two streams, but not the two-stream architecture of V001. There the streams are full parallel backbones fused by summing class scores; here they are three-block feature extractors fused by a learned convolutional block partway up. The optical flow is doing the same job in both: handing the network motion it would otherwise have to infer.",
        "The claimed efficiency has two independent sources that the paper tends to merge. Binary activations make the matrix products cheap in principle, and sparsity makes most of them skippable — F3 measures under 10% spike density in the first three blocks. Neither advantage is realised on the GPU and CPU the experiments run on; both require neuromorphic hardware that the paper names as future work.",
        "The optical flow stream is the part of this design that is not brain-like or cheap, and the paper half-acknowledges it: training time is 2.2 h against Context-LSTM's 2.4 h despite a tenth of the parameters, and the reason given is that 'SpikeConvFlowNet employs optical flow, which would slow down the training process'.",
      ],
    },

    attention: {
      used: false,
      kinds: ["none"],
      notes: [
        "No attention module of any kind, and this one is a decision rather than an omission. The introduction surveys attention-based video classifiers — transformer pathways with memory-based attention, MM-ViT, InspectorNet — and rejects them on cost: 'many attention-based methods for human behavior recognition use pre-training technology to reach higher accuracy on the UCF101 dataset but usually require significant computing resources. The attention-based method is not an ideal solution for small embedded devices and neuromorphic chips.'",
        "That makes this a useful anchor for the review's attention axis. Every one of the seven mentions of attention in the paper is in related work, describing methods the authors are arguing against, and the model that results reaches 88.5% on RWF-2000 with 0.178 M parameters and no attention at all.",
        "The sparsity of spike activity is not attention, though the effect can look similar in F7's heatmaps — under 10% of positions fire in the first three blocks, so the feature maps are mostly empty and the surviving activity concentrates on moving structure. That concentration is a consequence of a fixed firing threshold applied uniformly, not a learned, content-dependent weighting, and nothing in the model computes a mask or a per-channel weight.",
        "The optical flow stream is likewise a hand-specified prior about where information lives, not a selection mechanism the model learns. Both streams process every position of every frame.",
      ],
    },

    efficiency: {
      parameters:
        "0.178 M, against Flow Gated Network 0.27 M, Context-LSTM 1.7 M, STS-ResNet 11.7 M, I3D (Fusion) 24.6 M, ConvLSTM 47.4 M, 3D ConvNet 86.9 M and C3D 94.8 M (T2)",
      flops: undefined,
      modelSize: undefined,
      throughput:
        "372.8 FPS on RWF-2000, against 290.7 for Context-LSTM and 170.3 for STS-ResNet (T4). Training to convergence over 100 epochs: 2.2 h, against 2.4 h and 5.1 h.",
      hardware:
        "Training on one NVIDIA GeForce GTX 1080; inference timed on CPU only — 16 Intel Xeon E5-2620 v4 cores @ 2.10 GHz, 128 GB RAM, Ubuntu 18.04.3, Python 3.7, PyTorch 1.3.1. Timing inference on the CPU is deliberate, 'similar to the devices with low computational resources'.",
      realTime: {
        status: "measured-and-supported",
        note: "The relative claim is measured under controlled conditions and holds: three models, one dataset, one CPU, one timing protocol, and the proposed model is fastest at 372.8 FPS against 290.7 and 170.3. Comparing on CPU rather than GPU is the right choice for the deployment being argued for. The caveat is scope — the figure times the network, and the network requires optical flow it does not compute. Dense flow is the dominant per-frame cost in any pipeline that uses it, and 372.8 FPS on a 2.1 GHz CPU is not achievable end to end with flow included. So the network is fast and the system's real frame rate is unmeasured.",
      },
      edgeDeployment: {
        status: "claimed-without-evidence",
        note: "Embedded deployment is the paper's stated motivation and appears in the abstract, the introduction and the conclusion; neuromorphic chips are named repeatedly as the destination. No embedded device is ever used. Everything runs on a GTX 1080 or a Xeon workstation, no energy or power figure is measured anywhere despite the energy argument, and no memory footprint on a constrained device is given. The strongest evidence offered is indirect: 0.178 M parameters, and F3's measurement that under 10% of neurons fire per block, which would translate into energy savings on hardware that exploits sparsity — hardware the paper does not run on.",
      },
      notes: [
        "The parameter reduction is real and the comparison chosen to present it is the flattering one. The paper's discussion frames the result against STS-ResNet — 'the proposed model achieves comparative performance and only includes around one percentage of parameters', 11.7 M against 0.178 M. Flow Gated Network sits in the same table at 0.27 M with 87.2% on RWF-2000, so the honest nearest competitor is 1.5× larger and 1.3 points worse, not 66× larger. The paper never discusses it on cost.",
        "No FLOPs and no model size in megabytes anywhere. For a paper arguing for embedded deployment, megabytes on the device is the number a practitioner would want and it is absent.",
        "Binary activations and sub-10% spike density are advantages in principle and inert in these experiments. PyTorch on a GTX 1080 does dense floating-point work regardless of how many of the values are zero, so none of the measured 372.8 FPS comes from the mechanism the paper's energy argument rests on. The measured speed and the claimed energy efficiency have different causes and only one of them was tested.",
        "Training time is the most honest number in the efficiency story and the paper reports it plainly: 2.2 h against Context-LSTM's 2.4 h, a 9% saving on a tenth of the parameters, with the optical flow named as the reason the gap is not larger.",
        "One genuine and under-claimed efficiency property: memory. Because frames are processed singly with no clip buffer, peak activation memory does not scale with clip length — F4 makes this the explicit contrast against 3D CNN, RNN and transformer inputs. The paper asserts this reduces memory consumption and never measures it, which is a pity, since it is the claim most specific to the architecture.",
      ],
    },

    evaluation: {
      datasets: [
        {
          name: "RWF-2000",
          role: "evaluation",
          note: "2000 surveillance clips from YouTube, real-world scenes. The hardest of the four and the one all the efficiency experiments are run on. 88.5% in T2; 88.35% mean with 1.77% variance over five re-splits.",
        },
        {
          name: "Crowd Violence",
          role: "evaluation",
          note: "246 clips, 1.04–6.53 s, crowded scenes at low image quality. 90.2% in T2; 90.14% mean, 1.83% variance.",
        },
        {
          name: "Hockey Fight",
          role: "evaluation",
          note: "1000 clips from National Hockey League games, video-level annotation. 98.4% in T2; 98.39% mean, 0.26% variance.",
        },
        {
          name: "Movies",
          role: "evaluation",
          note: "200 clips cut from short films. 100% here and 100% for six of the seven baselines. The authors say so themselves: the dataset 'is no longer suited to evaluate the deep learning-based models for violence detection effectively' — an unusually direct statement to find in a results section.",
        },
        {
          name: "HMDB51",
          role: "evaluation",
          note: "6766 clips over 51 action classes. Not a violence dataset — used to test whether the architecture generalises to multi-class action recognition. It does not: 23.6%, against Context-LSTM's 80.1%.",
        },
        {
          name: "UCF101",
          role: "evaluation",
          note: "13,320 clips over 101 action classes. 40.7%, against Context-LSTM's 92.2%. The paper reports both collapses without softening them.",
        },
      ],
      split:
        "70% train, 10% validation, 20% test, split randomly per dataset. The proposed model is trained and evaluated five times with a fresh random split each time, and the mean and variance of test accuracy are reported for all four violence datasets. None of the seven baselines is given the same treatment.",
      metrics: [
        "Accuracy",
        "Precision",
        "Recall",
        "F1 score",
        "Confusion matrices (F6)",
        "Mean and variance over five re-splits, proposed model only",
        "Parameter count",
        "Training time to convergence",
        "Inference throughput in FPS",
        "Spike density per block (F3)",
      ],
      protocolNotes: [
        "The metric set is the most complete in this library and it checks out. F6 gives a confusion matrix per dataset, and both derived tables reproduce from it: T2's accuracies are the diagonals (51.1 + 47.3 = 98.4 on Hockey Fight, 46.5 + 43.6 = 90.1 on Crowd Violence, 42.6 + 45.9 = 88.5 on RWF-2000), and every cell of T5 follows from the same matrices using precision = TP/(TP+FP) and recall = TP/(TP+FN) on the violent class. Hockey Fight gives 47.3/48.2 = 0.98 and 47.3/48.0 = 0.99; RWF-2000 gives 45.9/53.3 = 0.86 and 45.9/50.0 = 0.92. Both match T5 exactly.",
        "That verification matters because the prose defines the terms backwards. Page 11 states that 'if a video with the fight label is predicted as a non-fight by the model, the prediction is false positive (FP)' and that a non-fight predicted as a fight is a false negative — which is the reverse of both conventions and of Equations (2)–(5) printed immediately above. The equations, the tables and the discussion all use the standard definitions; only the two sentences defining them are wrong. Worth recording, and worth distinguishing from a case like V010, where the definitions are fine and the computed columns are not.",
        "The false-positive behaviour is stated plainly and interpreted correctly, which is rare here. Recall exceeds precision on every dataset — 0.92 against 0.86 on RWF-2000, 0.91 against 0.88 on Crowd Violence — and the paper reads it as the model over-predicting fight: 'it can avoid omitting fight samples in testing data, but part non-fight videos could be falsely predicted as fight videos, which is acceptable for practical applications'. F6 confirms the asymmetry directly, with 7.4% false positives against 4.1% false negatives on RWF-2000. Whether that trade is acceptable is a deployment question the paper asserts rather than argues, but it is at least the right question and the numbers to judge it are all published.",
        "Only the proposed model gets error bars. Five re-splits, mean and variance, for SpikeConvFlowNet alone; every baseline is a single figure. The paper says why — the baselines' own papers do not report variance — but it means every margin in T2 compares a five-run mean against an unrepeated number. On RWF-2000 the proposed model's variance is 1.77% and its lead over Flow Gated Network is 1.3 points.",
        "T2 mixes three kinds of number in one table without separating them. Five rows are figures cited from other papers, two rows (Context-LSTM, STS-ResNet) were re-implemented and retrained by these authors, and one cell — 3D ConvNet on RWF-2000 — is self-obtained while the rest of that row is cited. Splits, preprocessing and training budgets therefore differ down the column.",
        "The RWF-2000 comparison is not like-for-like, in the way it usually is not. This paper uses a random 70/10/20 split, which happens to give a 400-clip test set; Flow Gated Network's 87.2% and the I3D and C3D figures are published results on RWF-2000's official held-out split. Same size, different clips, and a 1.3-point margin.",
        "The multi-class results are the most informative negative result in the paper, and the authors publish them without hedging. 23.6% on HMDB51 and 40.7% on UCF101, against Context-LSTM's 80.1% and 92.2%. STS-ResNet, the other spiking model, collapses the same way at 21.5% and 42.1%. The diagnosis offered is that these shallow convolutional spiking networks 'do not have enough ability to learn the features and recognize multi-classes actions effectively' — which reads the result as a limit of the architecture family rather than of this instance.",
        "That negative result is also the honest bound on what the violence numbers mean. A binary fight / non-fight decision on curated clips is a much easier problem than 51-way action recognition, and this architecture appears to sit right at the boundary of what it can do.",
        "No cross-dataset test. Each of the four violence datasets is trained and tested on itself, so nothing establishes transfer between them — and the HMDB51 and UCF101 results are separately trained too, not a transfer experiment.",
        "Hyperparameters were set 'by trial and error': Vth at 0.75, lr at 0.01, λ at 0.01. A 10% validation set exists, which is more than most papers here provide, but the paper never states that the search was run on it rather than on the test folds.",
        "Movies is at 100% for the proposed model and for six of the seven baselines. The paper does not treat that as a win — it argues in the results section that the dataset is saturated and should be retired, which is the correct conclusion and one most papers in this library decline to draw about their own best column.",
      ],
    },
  },

  concepts: [
    {
      id: "spikes",
      title: "The neuron holds the history, so the network does not have to",
      tagline: "Integrate and fire",
      highlight: {
        label: "Firing threshold",
        value: "V_th = 0.75",
        note: "and every activation in the network is a 0 or a 1",
      },
      note: [
        "An ordinary neuron computes a number and passes it on. An integrate-and-fire neuron accumulates: it adds its weighted inputs into a membrane potential, V(t) = V(t−1) + O(t), and does nothing at all until that potential crosses a threshold. Then it emits a single spike, resets to zero, and starts again.",
        "Two consequences follow, and they are what the whole paper is built on. The output is binary — a spike or no spike — so every activation downstream is a 0 or a 1 rather than a float. And the neuron's state depends on everything it has received since it last fired, so a unit that sees frame 40 is still carrying some of frame 38 in its potential. Time is not a dimension the network convolves over; it is a thing the neurons are already made of.",
        "That is why there is no 3D kernel anywhere in this model. Every convolution is 2D and spans exactly one frame. The temporal integration that a 3D CNN buys with an extra kernel dimension, and that an LSTM buys with a gated recurrent state, this architecture gets from the activation function.",
        "The price is that a threshold is not differentiable, so the model cannot be trained by backpropagation as written. The fix is the surrogate gradient: during the backward pass the spike function's derivative ∂O/∂V is replaced by the constant 1/V_th, a straight line standing in for a step. Gradients flow through a network that does not quite exist, and a neuron that never fired at all is assigned a derivative of zero.",
        "The last layer opts out. It integrates its weighted spikes without ever firing and applies a sigmoid, so the one derivative closest to the loss is exact and every other one is an approximation. The paper's reason is practical — it makes the model easier to train and lets the output fit the label distribution.",
      ],
      takeaways: [
        "V(t) = V(t−1) + O(t), fire and reset at V_th = 0.75. The neuron's memory is the mechanism, not an add-on.",
        "Binary activations mean matrix products become additions in principle — on hardware built for it.",
        "The surrogate gradient substitutes 1/V_th for a derivative that does not exist. Training optimises an approximation of the network being run.",
        "Each stream is only three blocks deep, deliberately: in deeper spiking networks spike activity thins out until later layers receive nothing.",
      ],
      pdfPage: 5,
    },

    {
      id: "streaming",
      title: "One frame at a time, with nothing buffered",
      tagline: "The input paradigm",
      highlight: {
        label: "Frames held in memory",
        value: "1",
        note: "against a clip of 16, 25 or 64 for everything it is compared against",
      },
      note: [
        "Figure 4 draws the contrast the paper cares about most, and it is not about accuracy. A 3D CNN, an RNN over clip features, a transformer over frame tokens — all of them take a segment: some number of frames assembled into a tensor before the model runs. SpikeConvFlowNet takes a frame. It processes it, updates every membrane potential in the network, emits a prediction, and waits for the next one.",
        "Peak activation memory therefore does not scale with clip length. Whether the video is two seconds or ten minutes, the model holds one frame's worth of activations plus one membrane potential per neuron. That is the property that genuinely suits a device with a small memory budget, and it is a direct consequence of putting the temporal state inside the neurons: there is no clip to buffer because the history is already in V(t).",
        "It also means the model does not need clips of a uniform length, and the paper takes advantage — video length is deliberately not normalised, and the batch size drops to one on datasets whose clips vary. The cost is bookkeeping: with a batch of one, training is slower per epoch than it needs to be, which the paper notes.",
        "Two caveats keep this from being a streaming violence detector. The prediction is not final until the video ends — outputs accumulate in the output accumulators 'until the last image is finished' — so this is still clip classification, just with a different memory profile while it runs. And the optical flow stream needs a frame pair, computed outside the network, which puts a small buffer and a real computation back in front of the model regardless.",
        "The paper asserts the memory saving and never measures it, which is the one place its efficiency reporting falls short of its own standard. Parameters, training time and inference throughput are all measured; peak memory, the claim most specific to this architecture, is not.",
      ],
      takeaways: [
        "Activation memory is independent of clip length. No other architecture in this library has that property.",
        "Variable-length video needs no truncation or padding, which is why batch size is 1 on three of the four datasets.",
        "It is not yet online detection: the decision arrives when the video does, because outputs accumulate to the end.",
        "The memory claim is the only efficiency claim here that is asserted rather than measured.",
      ],
      visual: {
        kind: "volume-grid",
        options: {
          mode: "wave",
          size: [8, 5, 14],
          hue: 135,
          speed: 0.55,
        },
        caption:
          "The clip volume every model in this library buffers — width and height across the face, frames running back into the screen. SpikeConvFlowNet is defined by never forming it: it takes one slice, updates the membrane potentials, and drops the slice. The sweep here is illustrative of activation moving through time, not a measured spike raster.",
      },
      pdfPage: 9,
    },

    {
      id: "tradeoff",
      title: "A tenth of the parameters, one to four points of accuracy",
      tagline: "T2",
      highlight: {
        label: "RWF-2000",
        value: "88.5% at 0.178 M",
        note: "against Context-LSTM's 92.3% at 1.7 M",
      },
      note: [
        "Table 2 puts eight models on four datasets with a parameter count beside each, which is exactly the table this review's efficiency axis wants and almost never gets. Read across the bottom row: 100% on Movies, 98.4% on Hockey Fight, 90.2% on Crowd Violence, 88.5% on RWF-2000, at 0.178 M parameters.",
        "The losses are small and they are real. Context-LSTM leads on three of the four — 99.2 against 98.4 on Hockey, 93.8 against 90.2 on Crowd, 92.3 against 88.5 on RWF-2000 — at roughly ten times the parameters, and, as the paper notes, with a ResNet50 pre-trained on large-scale data underneath it. STS-ResNet, the other spiking model, is ahead on Crowd Violence and behind on RWF-2000, at 66 times the size.",
        "The comparison the paper leans on is with STS-ResNet: 'the proposed model achieves comparative performance and only includes around one percentage of parameters'. That is true and it is the flattering framing. Flow Gated Network sits four rows up at 0.27 M parameters and 87.2% on RWF-2000 — 1.5× larger, 1.3 points worse. That is the genuine nearest competitor on the cost axis, the proposed model does beat it on both counts, and the paper never mentions it in the efficiency discussion.",
        "Movies is at 100% for seven of the eight rows, and the paper says outright what most papers in this library will not say about their own best column: the dataset is small, simple and saturated, and 'is no longer suited to evaluate the deep learning-based models for violence detection effectively'. It should be read as a tie, and the authors read it that way.",
        "One caution on how the column was assembled. Five of the eight rows are figures cited from other papers, two were re-implemented and retrained by these authors, and one cell — 3D ConvNet on RWF-2000 — is self-obtained while the rest of its row is cited. Splits and training budgets differ down the column, and the RWF-2000 figures in particular mix this paper's random 70/10/20 split against published results on the dataset's official held-out split.",
      ],
      takeaways: [
        "0.178 M parameters: the smallest model in the table by 1.5×, and by 66× against the other spiking network.",
        "It gives up 3.8 points to Context-LSTM on RWF-2000 and 3.6 on Crowd Violence, and wins on RWF-2000 against everything cheaper.",
        "Flow Gated Network at 0.27 M is the real cost-axis competitor and goes undiscussed.",
        "Only the proposed model carries a variance (1.77% on RWF-2000, over five re-splits). Every baseline is a single unrepeated figure.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          hue: 135,
          mode: "outcome",
          metricLabel: "Accuracy",
          datasetLabel: "Dataset",
          baselineId: "spikeconvflownet",
          // T2, p11. Parameter counts are in the concept text rather than the
          // lanes -- this mode compares one metric, and accuracy is the axis the
          // table ranks on.
          datasets: [
            {
              id: "rwf",
              label: "RWF-2000",
              title: "2000 surveillance clips — the hardest of the four",
              floor: 50,
              floorLabel: "balanced-class chance",
            },
            {
              id: "crowd",
              label: "Crowd Violence",
              title: "246 crowd clips at low image quality",
              floor: 50,
              floorLabel: "balanced-class chance",
            },
            {
              id: "hockey",
              label: "Hockey Fight",
              title: "1000 broadcast hockey clips",
              floor: 50,
              floorLabel: "balanced-class chance",
            },
            {
              id: "movies",
              label: "Movies",
              title: "200 film clips — saturated, and the paper says so",
              floor: 50,
              floorLabel: "balanced-class chance",
            },
          ],
          models: [
            {
              id: "spikeconvflownet",
              label: "SpikeConvFlowNet — 0.178 M",
              metrics: {
                movies: { accuracy: 100 },
                hockey: { accuracy: 98.4 },
                crowd: { accuracy: 90.2 },
                rwf: { accuracy: 88.5 },
              },
            },
            {
              id: "fgn",
              label: "Flow Gated Network — 0.27 M",
              metrics: {
                movies: { accuracy: 100 },
                hockey: { accuracy: 98.0 },
                crowd: { accuracy: 88.8 },
                rwf: { accuracy: 87.2 },
              },
            },
            {
              id: "context-lstm",
              label: "Context-LSTM — 1.7 M",
              metrics: {
                movies: { accuracy: 100 },
                hockey: { accuracy: 99.2 },
                crowd: { accuracy: 93.8 },
                rwf: { accuracy: 92.3 },
              },
            },
            {
              id: "sts-resnet",
              label: "STS-ResNet — 11.7 M",
              metrics: {
                movies: { accuracy: 100 },
                hockey: { accuracy: 98.9 },
                crowd: { accuracy: 91.2 },
                rwf: { accuracy: 88.3 },
              },
            },
            {
              id: "i3d",
              label: "I3D (Fusion) — 24.6 M",
              metrics: {
                movies: { accuracy: 100 },
                hockey: { accuracy: 97.5 },
                crowd: { accuracy: 88.9 },
                rwf: { accuracy: 81.5 },
              },
            },
            {
              id: "convlstm",
              label: "ConvLSTM — 47.4 M",
              metrics: {
                movies: { accuracy: 100 },
                hockey: { accuracy: 97.1 },
                crowd: { accuracy: 94.5 },
                rwf: { accuracy: 77.0 },
              },
            },
            {
              id: "3d-convnet",
              label: "3D ConvNet — 86.9 M",
              metrics: {
                movies: { accuracy: 99.97 },
                hockey: { accuracy: 99.6 },
                crowd: { accuracy: 94.3 },
                rwf: { accuracy: 81.7 },
              },
            },
            {
              id: "c3d",
              label: "C3D — 94.8 M",
              metrics: {
                movies: { accuracy: 100 },
                hockey: { accuracy: 96.5 },
                crowd: { accuracy: 84.4 },
                rwf: { accuracy: 82.8 },
              },
            },
          ],
        },
        caption:
          "T2, ordered by parameter count from smallest at the top, measured against the proposed model. On Movies the lanes stack flat at the ceiling; on RWF-2000 they spread across fifteen points and the ordering has almost nothing to do with size.",
      },
      pdfPage: 11,
    },

    {
      id: "collapse",
      title: "It works on two classes and falls apart on fifty-one",
      tagline: "T3",
      highlight: {
        label: "HMDB51",
        value: "23.6%",
        note: "against Context-LSTM's 80.1% on the same 51 classes",
      },
      note: [
        "Having shown the architecture competitive on four violence benchmarks, the paper runs it on two general action-recognition datasets and publishes what happens. On HMDB51, 51 action classes over 6766 clips: 23.6%, against Context-LSTM's 80.1%. On UCF101, 101 classes over 13,320 clips: 40.7%, against 92.2%.",
        "This is a collapse, not a shortfall, and it is the most informative result in the paper. STS-ResNet — the other convolutional spiking network in the comparison — fails the same way, at 21.5% and 42.1%. Two independent spiking architectures, the same cliff. The paper's diagnosis follows the evidence: these shallow convolutional spiking networks 'do not have enough ability to learn the features and recognize multi-classes actions effectively' on datasets with many complex scenes.",
        "It is worth sitting with what that implies for the violence numbers. Fight versus non-fight on curated clips is a two-class problem where much of the signal is scene-level — crowding, camera motion, the kind of footage a violent clip tends to be. Fifty-one-way action recognition demands that the model actually distinguish one motion pattern from another. The architecture reaches 88.5% on the first and 23.6% on the second, which locates fairly precisely what it has learned to do.",
        "The shallowness that makes the model trainable is the likely cause. Three SpikeConv blocks per stream is a deliberate choice to avoid the vanishing spike phenomenon, and three blocks of 3×3 convolution is simply not much representational capacity for 51 classes. The constraint that makes deep spiking networks hard to train is the same one that caps what shallow ones can represent.",
        "Publishing this at all deserves noting. A paper is under no obligation to run its model on a benchmark it will lose on by 56 points, and most would not have.",
      ],
      takeaways: [
        "23.6% on HMDB51 and 40.7% on UCF101, against 80.1% and 92.2% for the RNN baseline.",
        "The other spiking model in the comparison fails identically — 21.5% and 42.1% — so this reads as a family limit, not an implementation bug.",
        "The vanishing spike problem caps depth, and the depth cap appears to cap representational capacity.",
        "This is the honest bound on the violence results: the architecture handles a binary decision on curated clips and not much beyond it.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          hue: 135,
          mode: "outcome",
          metricLabel: "Accuracy",
          datasetLabel: "Dataset",
          baselineId: "spikeconvflownet",
          // T3, p11, alongside the RWF-2000 column of T2 for scale. The two
          // spiking models are within three points of each other on both action
          // datasets and both are forty-odd points behind the RNN.
          datasets: [
            {
              id: "hmdb51",
              label: "HMDB51 (51 classes)",
              title: "6766 clips from movies and YouTube",
              floor: 2,
              floorLabel: "uniform chance over 51 classes",
            },
            {
              id: "ucf101",
              label: "UCF101 (101 classes)",
              title: "13,320 YouTube clips",
              floor: 1,
              floorLabel: "uniform chance over 101 classes",
            },
            {
              id: "rwf",
              label: "RWF-2000 (2 classes)",
              title: "the violence benchmark, for scale",
              floor: 50,
              floorLabel: "balanced-class chance",
            },
          ],
          models: [
            {
              id: "context-lstm",
              label: "Context-LSTM (RNN, pre-trained ResNet50)",
              metrics: {
                hmdb51: { accuracy: 80.1 },
                ucf101: { accuracy: 92.2 },
                rwf: { accuracy: 92.3 },
              },
            },
            {
              id: "spikeconvflownet",
              label: "SpikeConvFlowNet (proposed)",
              metrics: {
                hmdb51: { accuracy: 23.6 },
                ucf101: { accuracy: 40.7 },
                rwf: { accuracy: 88.5 },
              },
            },
            {
              id: "sts-resnet",
              label: "STS-ResNet (the other spiking model)",
              metrics: {
                hmdb51: { accuracy: 21.5 },
                ucf101: { accuracy: 42.1 },
                rwf: { accuracy: 88.3 },
              },
            },
          ],
        },
        caption:
          "T3, with T2's RWF-2000 column added for scale. Switch between the three and the two spiking lanes fall away from the RNN by fifty-odd points the moment the task stops being binary — while on RWF-2000 all three sit within four points of each other.",
      },
      pdfPage: 11,
    },

    {
      id: "cost",
      title: "Measured on a CPU, and the flow it needs is not in the number",
      tagline: "T4, and what it leaves out",
      highlight: {
        label: "Inference on CPU",
        value: "372.8 FPS",
        note: "against 290.7 and 170.3 for the two benchmarks",
      },
      note: [
        "The efficiency experiments are better designed than most in this library. Three models, one dataset, one hardware configuration, one protocol — and inference timed on the CPU rather than the GPU, deliberately, because the argument is about devices with low computational resources. SpikeConvFlowNet reaches 372.8 FPS against Context-LSTM's 290.7 and STS-ResNet's 170.3. Training to convergence takes 2.2 h against 2.4 and 5.1.",
        "As a relative claim under controlled conditions, that is measured and it holds. The caveat is scope. The figure times the network, and the network cannot run without optical flow it does not compute. Dense optical flow is the dominant per-frame cost of any pipeline that uses it, and 372.8 frames per second on a 2.1 GHz Xeon is not achievable end to end with flow included. The paper half-concedes the point elsewhere: training is only 9% faster than a model with ten times the parameters, and the reason given is that 'SpikeConvFlowNet employs optical flow, which would slow down the training process'.",
        "The energy argument has a different and larger gap. Binary activations make matrix multiplication cheap in principle; sub-10% spike density, which F3 measures per block, makes most of those operations skippable. Neither advantage exists in these experiments. PyTorch on a GTX 1080 and a Xeon CPU does dense floating-point work whether the values are zeros or not, so none of the measured speedup comes from the mechanism the low-power case rests on. Realising it requires neuromorphic hardware, which the paper names as the destination and never runs on.",
        "So the two halves of the efficiency story rest on different evidence. The parameter count and the CPU throughput are measured and support what they are used for. The energy efficiency and the embedded-device suitability are argued from architecture, with F3's sparsity measurement as the strongest indirect evidence, and no power figure, no memory footprint on a device, and no embedded hardware anywhere in the paper.",
        "For the review's efficiency axis that splits cleanly: real-time performance is measured-and-supported for the network, with the flow uncosted; edge deployment is claimed-without-evidence, on a workstation with a GTX 1080.",
      ],
      takeaways: [
        "372.8 FPS on CPU, three models under one protocol. Choosing CPU over GPU is the right call for the deployment being argued.",
        "Optical flow is required and uncosted. The system's real end-to-end frame rate is not in the paper.",
        "Binary activations and 10% spike density save nothing on the hardware used. They are the reason to build the model and not the reason it was fast here.",
        "No power measurement, no on-device memory figure, no embedded board. The word 'neuromorphic' appears throughout; no neuromorphic chip is used.",
      ],
      pdfPage: 12,
    },
  ],
};
