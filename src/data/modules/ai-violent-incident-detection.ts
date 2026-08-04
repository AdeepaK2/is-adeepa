import type { StudyModule } from "@/types/study";

/**
 * Merit & Beladgham (2025), "AI-based Violent Incident Detection in Surveillance
 * Videos to Enhance Public Safety".
 * Journal of Telecommunications and Information Technology 4/2025:77-88.
 * DOI 10.26636/jtit.2025.4.2328.
 *
 * Every number here is read off the tables, which matters more than usual: the
 * three result tables are captioned inconsistently and the prose cites the wrong
 * one. All three carry the phrase "the movies datasets"; T3 appends "- hockey",
 * T5 appends "- crowd", T4 appends nothing. The p5 sentence "Table 4 indicates
 * ... the maximum accuracy of 1.000 in the hockey dataset" disagrees with T4's
 * own contents, which match the p6 description of the movies set (nearly every
 * cell 1.000, BiGRU+wavelet at 0.975). Read T3 = hockey, T4 = movies, T5 = crowd.
 *
 * Table and figure map (physical PDF pages, 1-based -- the journal prints 77-88):
 *   T1   p2   the three datasets          T3   p8   results, HOCKEY
 *   F1   p3   system schematic            T4   p8   results, MOVIES
 *   F4   p3   DWT feature extraction      T5   p9   results, CROWD
 *   T2   p4   ResNetV2 depth and params   S5.1 p9   computational efficiency
 *   F5   p4   PCA feature extraction      F10  p10  per-instance scatter
 *   F6   p5   ResNetXV2 architecture      F11  p10  detection confidences
 *   F8   p6   CNN / BiGRU / LSTM heads    S6   p10  ethical considerations
 *   F9   p7   accuracy, loss, CM, ROC     T6   p11  comparison to prior work
 */
export const moduleAiViolentIncident: StudyModule = {
  slug: "ai-violent-incident-detection",

  premise:
    "A benchmark rather than an architecture. Seven ways of turning a video frame into a feature vector -- PCA, a Daubechies-8 wavelet, VGG-16, VGG-19 and three depths of ResNetV2 -- are crossed with three ways of reading the resulting sequence -- CNN, LSTM, BiGRU -- and run on Movies, Hockey and Crowd. The paper concludes that ResNet152V2 with a BiGRU is the best combination. Its own tables make that conclusion almost unreadable: 1.000 accuracy, recall, precision and F1 appear in every one of the eighteen deep-extractor cells under LSTM and BiGRU, and the three ResNet depths it is comparing never differ from each other at all under the classifier it recommends.",

  results: [
    {
      label: "Movies / Hockey / Crowd",
      value: "100%",
      note: "accuracy, recall, precision and F1 alike, T3-T5",
    },
    {
      label: "Extraction cost",
      value: "0.492 s",
      note: "per image, ResNet152V2 — about 2 fps against a 25 fps stream",
    },
    {
      label: "50 → 152 layers",
      value: "+2.0",
      note: "crowd, CNN head only; exactly 0.0 under LSTM and BiGRU",
    },
  ],

  review: {
    architecture: {
      family: "CNN-LSTM",
      backbone:
        "ResNet152V2 as a per-frame feature extractor -- 152 layers, 60.2 M parameters, 50 bottleneck blocks arranged 3×[3, 8, 36, 3] (T2 p4) -- initialised from ImageNet and followed by a bidirectional GRU, three dense layers of 512, 256 and 128 units, and a 2-unit softmax (F8c p6). ResNet50V2 (25.6 M) and ResNet101V2 (44.6 M) are the same pipeline at shallower depth, and VGG-16, VGG-19, a level-3 Daubechies-8 wavelet decomposition and PCA are the comparison front ends.",
      motionEncoding:
        "Not in the visual representation at all. The extractor is a 2D CNN applied to one frame at a time, so a frame becomes a 4096-d vector computed without reference to any other frame -- no 3D kernel, no optical flow, no frame differencing, no temporal pooling. Every bit of temporal structure enters at one place: the BiGRU that reads the sequence of those vectors forward and backward and concatenates the two hidden states. Motion is therefore whatever a gated recurrence can infer from how a frozen ImageNet appearance descriptor changes between frames.",
      inputs: [
        "RGB frames only, resized to 224×224 to match the ImageNet input, giving a tensor m × n × 224 × 224 × 3 for m clips of n frames (p2)",
        "n -- the number of frames taken per clip -- is never given a value anywhere in the paper, so no per-clip cost or latency can be reconstructed from it",
        "No optical flow, no pose, no audio, no detector crops, no second stream",
      ],
      fusion:
        "Concatenation of the forward and backward GRU states. That is the only place two things are combined; the seven extractors are compared against each other, never combined.",
      supervision:
        "Supervised binary clip classification, violence / non-violence. BiGRU hyperparameters: learning rate 0.1, batch size 100, 100 epochs, dense kernel size 100, Adam, and mean squared error as the loss (p4) -- MSE rather than cross-entropy on a two-class softmax, stated the same way for the CNN and LSTM heads.",
      notes: [
        "The paper never states whether the extractor is fine-tuned or frozen. The evidence points to frozen precomputed features -- extraction time is a separate column from training time, and p4 says the procedure 'ends at the dense layer and further processing is conducted using an alternative classifier' -- but it is not said, and the difference decides how much of the model actually trains.",
        "Two feature-shape statements contradict each other. p4 gives the block-5 output as m × n × 7 × 7 × 512 for VGG-16 and for every ResNetV2 alike, then flattens both to m × n × 4096; a ResNetV2 block 5 is 2048 channels wide, not 512. F8 p6 labels the ResNet152V2 output n × 2048 and the BiGRU input (n, 4096).",
        "F1 p3, the schematic of the proposed system, draws its feature-extraction column as a 13-layer VGG stack captioned 'Pretrained VGG models (VGG16, VGG19)' -- the comparison method, not the proposed one. The figure describing the pipeline does not show the pipeline.",
        "The contribution is a benchmark, not a design. Every component is off the shelf: ImageNet ResNetV2, a standard BiGRU, a Daubechies-8 wavelet, PCA. Nothing is proposed that did not already exist, which is a legitimate kind of paper -- it just means the architecture axis records a selection, not an invention.",
      ],
    },

    attention: {
      used: false,
      kinds: ["none"],
      notes: [
        "No attention in the proposed model, and unusually, none anywhere else either. The word 'attention' occurs exactly three times in thirteen pages and all three are inside the reference list -- the titles of refs [1], [42] and [47]. It appears zero times in the body, including Related Works. Most papers in this review at least survey attention before declining to use it; this one does not raise the concept.",
        "The BiGRU's bidirectionality is not attention and should not be counted as one. A backward pass is a second fixed recurrence over the same sequence: no weights are computed from the input to re-weight other positions, nothing is gated by relevance, and every frame contributes on the same terms regardless of content.",
        "Useful as a baseline for the attention axis, with a caveat. T6 p11 puts this work's 100 / 100 / 100 above ref [47] (spatial and temporal attention modules on a 2D CNN) at 100 / 99.7 / 98.53 and ref [42] (temporal shift module with attention) at 98.995 / 97.959 -- so read carelessly the table looks like evidence that attention is unnecessary. It is not: those figures are quoted from the other papers, and all three sets are saturated here, so the comparison cannot separate any of them.",
      ],
    },

    efficiency: {
      parameters:
        "60.2 M for the ResNet152V2 extractor (T2 p4; 25.6 M and 44.6 M for the 50- and 101-layer variants). No parameter count is given for the BiGRU head, the dense stack, or the model as a whole.",
      flops: undefined,
      modelSize: undefined,
      throughput:
        "0.492 s per image for ResNet152V2 feature extraction (S5.1 p9, and the extraction column of T3-T5), plus a testing figure of 0.380 s whose denominator is stated two ways in one sentence -- 'the total test time for the ResNet152V2-BiGRU model was 0.38 s per video' (S5.1 p9). Total and per-video cannot both be true, and the crowd test set has 49 clips.",
      hardware: undefined,
      realTime: {
        status: "measured-and-refuted",
        note: "S5.1 p9 reasons from the 0.380 s testing figure that the system 'demonstrates good potential for near-real-time analysis in a processed clip-based system'. The paper's own extraction column refutes it. At 0.492 s per image, one second of video at the 25 fps the same paragraph names as the target needs about 12.3 s of feature extraction -- roughly 2 fps of throughput against a 25 fps stream, before the classifier runs. The 0.380 s the claim rests on covers only the recurrent head; it is the cheap end of a pipeline whose expensive end is measured in the adjacent column and never added to it. The paragraph then concedes that 'for true real-time streaming at standard frame rates (e.g., 25-30 fps), the current model requires optimization', so the contradiction is internal to a single section.",
      },
      edgeDeployment: {
        status: "not-addressed",
        note: "No edge, embedded, on-camera or mobile deployment is designed for or measured. The single occurrence of the idea is in S6 Ethics, which recommends 'on-edge processing, where video data is analyzed locally without being stored or transmitted' as a privacy mitigation in general -- not as a claim about this model, and with no target device, power, memory-footprint or accelerator figure attached. Future work names MobileNet, EfficientNet, pruning and quantisation as directions, none of them attempted.",
      },
      notes: [
        "No hardware is named anywhere in the paper. No CPU, no GPU, no RAM, no framework, no cloud instance -- the word 'CPU' appears twice, both times as part of the phrase 'CPU time'. Every timing in T3-T5 is therefore uncomparable to any other paper in this review, and to any deployment target. This is the review's cleanest example of a throughput number with nothing behind it.",
        "The two costs are never composed. Extraction is timed per image, testing per clip or per test set, and with n frames per clip unstated the multiplication cannot be done by the reader either. The one place the paper reasons about deployment, S5.1, uses only the smaller of the two numbers.",
        "The ResNet101V2 and ResNet152V2 timings are round increments on the ResNet50V2 measurement in the row directly above, in all three tables and all three classifiers: 22.164 → 22.300 → 22.500 (T3, LSTM), 11.406 → 11.550 → 11.700 (T5, LSTM), 41.594 → 42.000 → 42.500 (T5, CNN). The measured-looking precision of the 50-layer row is not carried into the two deeper rows anywhere. Recorded as a pattern; the paper offers no explanation for it.",
        "The accuracy-for-time trade-off is stated twice with different numbers. p6 says 'for an increase in accuracy of up to 0.25, a time difference of 0.1 to 0.6 s can be tolerated'; the conclusion on p11 says 'a difference of approximately 6 s can still be tolerated for the crowd dataset considering that the accuracy obtained increased to 0.263'. The 0.263 figure corresponds to no pair of cells in T3-T5, and 0.6 s against 6 s is a factor of ten.",
        "BiGRU being cheaper than LSTM is the one efficiency claim the tables do support, and only for training: on crowd, 12.250 s against 11.700 s is actually slower, while on hockey 22.800 against 22.500 is likewise slower. The clearer support is against the CNN head -- 42.5 s on crowd, 144 s on hockey -- and against VGG-19 with a CNN at 263.022 s (T3), the paper's slowest training run.",
      ],
    },

    evaluation: {
      datasets: [
        {
          name: "Hockey Fight",
          role: "evaluation",
          note: "1000 clips, 500 violent and 500 not, 288×360, .avi (T1 p2). Described as 'recordings of matches from the National Hockey League' -- broadcast sport, not surveillance, despite p6 grouping it with the crowd set as footage 'obtained from surveillance cameras'.",
        },
        {
          name: "Movies",
          role: "evaluation",
          note: "200 clips, 100 per class, 576×720 (T1 p2). The paper explains its own saturation here: the scenes are film, so 'the lighting and camera angles have been deliberately configured' and the video 'is clear and does not contain much noise' (p6).",
        },
        {
          name: "Crowd Violence",
          role: "evaluation",
          note: "The Violent-Flows set of Hassner et al. [16]. 246 clips, 123 per class, 240×320 (T1 p2). The closest thing here to uncurated real-world footage, and the set the introduction singles out as hard because violence can be occluded by crowd density and because crowds provoke false positives.",
        },
        {
          name: "ImageNet",
          role: "pre-training",
          note: "Source of the weights for all four deep extractors. Described as approximately 14 million images in 1000 categories, chosen partly because its 224×224 resolution 'matches the CCTV image frame input' (p5). Never fine-tuned on violence data as far as the paper states.",
        },
      ],
      split:
        "10-fold cross-validation (p5), though S2 p2 describes it only as 'k-fold'. No fold-to-fold variance, standard deviation or range is reported for any cell in T3-T5 -- every figure is a single number. The confusion matrix in F9c p7 totals 49 samples (21 / 0 / 0 / 28) and p9 refers to 'the 49th test data'; ten folds of the 246-clip crowd set would give about 25 test clips, so the reported matrix is a 20% holdout rather than one of ten folds.",
      metrics: ["Accuracy", "Recall", "Precision", "F1-score"],
      protocolNotes: [
        "The benchmarks are saturated, which is the single most important thing about this paper's numbers. Every one of the eighteen deep-extractor cells under LSTM and BiGRU -- three ResNet depths × three datasets × two classifiers -- reports 1.000 accuracy, 1.000 recall, 1.000 precision and 1.000 F1. On the movies set, nineteen of twenty-one configurations reach 1.000, including PCA with a CNN. Nothing being compared can be separated by these datasets, so the paper's central conclusion is drawn from a measurement with no resolution left.",
        "Two of the metrics the paper promises are never reported. S2 p2 says the evaluation uses 'accuracy, recall, specificity, G-mean, and CPU time', and F1 p3 lists 'Accuracy, Sensivity, Specificity, G-mean' in its evaluation box. T3-T5 report accuracy, recall, precision and F1. Specificity and G-mean appear nowhere in the results -- and specificity is the metric that measures false alarms, in a paper whose ethics section argues that avoiding false positives 'is not just a technical goal but an ethical imperative'.",
        "The overfitting argument is made from the shape of a curve, not a number. p7 concludes the model 'did not experience overfitting when the results between training and validation almost overlapped' in F9a/b. With no held-out set beyond the cross-validation folds and no reported spread across them, the claim rests on a figure with no axis values quoted in the text.",
        "There is no cross-dataset test anywhere, on a paper whose own Limitations section concedes the models were 'trained and tested on controlled datasets which may not fully capture the challenges of real-world surveillance' and that 'the performance reported here might not directly translate to operational environments'. Nothing in the paper measures that gap.",
        "One cell is a collapse rather than a weak score, and the accuracy column alone hides it. Crowd, BiGRU with PCA features: accuracy 0.500, recall 0.500, precision 0.250, F1 0.433 on a balanced 123/123 set -- the signature of a classifier that has assigned every clip to one class. Read as '50% accuracy' it looks like a poor model; read with its precision it is not a model at all.",
        "The comparison in T6 p11 is quoted, not re-run. Twenty-three prior methods are listed with accuracies taken from their own papers, produced on unstated and certainly different hardware and splits, and eleven of the rows have dashes for at least one dataset. The proposed row's 100 / 100 / 100 tops it, but three of the quoted rows are already at 99.4-100 on movies and hockey.",
        "None of the three datasets is operational CCTV. Movies is film, Hockey is broadcast sport, and Crowd Violence is the closest of the three to real footage without being surveillance-camera video. p6's claim that hockey and crowd 'were obtained from surveillance cameras' is contradicted by the paper's own description of the hockey set on p2.",
        "The narrower table-level results are the ones that carry information, and they are consistent: on hockey and crowd the classical extractors are clearly worse (PCA 0.755 and 0.500, wavelet 0.865 and 0.656 with a BiGRU), and the deep extractors are clearly better. That contrast survives the saturation. The ranking among the deep extractors does not.",
      ],
    },
  },

  concepts: [
    {
      id: "frozen-front-ends",
      title: "Seven pipelines, one of them trained, and it is the same one each time",
      tagline: "What is actually being compared",
      highlight: {
        label: "ResNet152V2",
        value: "60.2 M",
        note: "parameters, ImageNet, in front of an unreported head",
      },
      note: [
        "The paper presents itself as a comparison of architectures. What varies between its seven configurations is only the front end: a frame goes into PCA, a wavelet decomposition, VGG-16, VGG-19 or one of three ResNetV2 depths, and comes out as a vector. Everything after that point is identical in all seven -- the same BiGRU, the same 512/256/128 dense stack, the same two-unit softmax.",
        "The front ends do not learn anything here either. All four deep extractors carry ImageNet weights, and the paper describes the extraction procedure as ending at the dense layer with 'further processing conducted using an alternative classifier'. Extraction time is a separate column from training time in every table, which is what you would expect if the features were computed once and cached. The paper never states this outright, which is worth noticing rather than resolving: whether 60.2 M parameters are frozen or fine-tuned is the difference between a small recurrent model and a very large one.",
        "The two classical lanes make the structure obvious. PCA is a linear projection and a Daubechies-8 wavelet decomposition is a fixed filter bank; neither has a single learned weight. They plug into exactly the same trained head as ResNet152V2 does, and on the movies set PCA with a CNN reaches 1.000. When a lane with no learned features at all can tie the best deep model, what the benchmark is measuring is not the front end.",
      ],
      takeaways: [
        "Only the extractor changes across the seven configurations. The BiGRU head is constant.",
        "Parameter counts exist for exactly three of the seven lanes -- the ResNets, from T2. The VGG counts, and the head's own count, are never reported.",
        "Depth costs what you would expect at extraction time: 0.231 s, 0.378 s and 0.492 s per image for the 50-, 101- and 152-layer models, against 0.013 s for the wavelet.",
        "Nothing in the paper isolates the contribution of the head from that of the features, because the head is never varied while the features are held fixed except through the classifier comparison.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          mode: "architecture",
          hue: 12,
          // Parameter counts are from T2 p4 and exist only for the three
          // ResNets. Every other block is entered as 0 with a note, so the
          // hover says what the paper reports rather than a familiar figure
          // from elsewhere -- the VGG counts are not in this paper.
          models: [
            {
              id: "pca",
              label: "PCA",
              emptyNote: "the paper reports no parameter count for the trained head",
              blocks: [
                {
                  label: "PCA",
                  params: 0,
                  trained: false,
                  note: "linear projection to 10-50 components · no learned weights (F5 p4)",
                },
                { label: "BiGRU", params: 0, trained: true, note: "trained here · parameter count not reported" },
                { label: "dense 512/256/128", params: 0, trained: true, note: "trained here · parameter count not reported" },
                { label: "softmax 2", params: 0, trained: true, note: "violence / non-violence" },
              ],
            },
            {
              id: "wavelet",
              label: "Db8 wavelet",
              emptyNote: "the paper reports no parameter count for the trained head",
              blocks: [
                {
                  label: "Db8 level 3",
                  params: 0,
                  trained: false,
                  note: "fixed filter bank, LL sub-band at 41×41 · no learned weights (F4 p3)",
                },
                { label: "BiGRU", params: 0, trained: true, note: "trained here · parameter count not reported" },
                { label: "dense 512/256/128", params: 0, trained: true, note: "trained here · parameter count not reported" },
                { label: "softmax 2", params: 0, trained: true, note: "violence / non-violence" },
              ],
            },
            {
              id: "vgg16",
              label: "VGG-16",
              emptyNote: "the paper reports no parameter count for the trained head",
              blocks: [
                {
                  label: "VGG-16",
                  params: 0,
                  trained: false,
                  note: "ImageNet weights, frozen · parameter count not reported in this paper",
                },
                { label: "BiGRU", params: 0, trained: true, note: "trained here · parameter count not reported" },
                { label: "dense 512/256/128", params: 0, trained: true, note: "trained here · parameter count not reported" },
                { label: "softmax 2", params: 0, trained: true, note: "violence / non-violence" },
              ],
            },
            {
              id: "vgg19",
              label: "VGG-19",
              emptyNote: "the paper reports no parameter count for the trained head",
              blocks: [
                {
                  label: "VGG-19",
                  params: 0,
                  trained: false,
                  note: "ImageNet weights, frozen · parameter count not reported in this paper",
                },
                { label: "BiGRU", params: 0, trained: true, note: "trained here · parameter count not reported" },
                { label: "dense 512/256/128", params: 0, trained: true, note: "trained here · parameter count not reported" },
                { label: "softmax 2", params: 0, trained: true, note: "violence / non-violence" },
              ],
            },
            {
              id: "resnet50",
              label: "ResNet50V2",
              emptyNote: "the paper reports no parameter count for the trained head",
              blocks: [
                {
                  label: "ResNet50V2",
                  params: 25_600_000,
                  trained: false,
                  note: "50 layers, 16 bottleneck blocks, 25.6 M parameters, ImageNet (T2 p4)",
                },
                { label: "BiGRU", params: 0, trained: true, note: "trained here · parameter count not reported" },
                { label: "dense 512/256/128", params: 0, trained: true, note: "trained here · parameter count not reported" },
                { label: "softmax 2", params: 0, trained: true, note: "violence / non-violence" },
              ],
            },
            {
              id: "resnet101",
              label: "ResNet101V2",
              emptyNote: "the paper reports no parameter count for the trained head",
              blocks: [
                {
                  label: "ResNet101V2",
                  params: 44_600_000,
                  trained: false,
                  note: "101 layers, 33 bottleneck blocks, 44.6 M parameters, ImageNet (T2 p4)",
                },
                { label: "BiGRU", params: 0, trained: true, note: "trained here · parameter count not reported" },
                { label: "dense 512/256/128", params: 0, trained: true, note: "trained here · parameter count not reported" },
                { label: "softmax 2", params: 0, trained: true, note: "violence / non-violence" },
              ],
            },
            {
              id: "resnet152",
              label: "ResNet152V2",
              emptyNote: "the paper reports no parameter count for the trained head",
              blocks: [
                {
                  label: "ResNet152V2",
                  params: 60_200_000,
                  trained: false,
                  note: "152 layers, 50 bottleneck blocks, 60.2 M parameters, ImageNet (T2 p4) · the proposed extractor",
                },
                { label: "BiGRU", params: 0, trained: true, note: "trained here · parameter count not reported" },
                { label: "dense 512/256/128", params: 0, trained: true, note: "trained here · parameter count not reported" },
                { label: "softmax 2", params: 0, trained: true, note: "violence / non-violence" },
              ],
            },
          ],
        },
        caption:
          "One lane per feature extractor, blocks scaled by reported weight count. Struck-through blocks are frozen. Every lane ends in the same four trained blocks, and every one of those blocks reports its parameter count as unmeasured, because the paper never gives one for anything it trains.",
      },
      pdfPage: 4,
    },

    {
      id: "bidirectional",
      title: "It reads the clip backwards, so the alert cannot come early",
      tagline: "BiGRU and latency",
      highlight: {
        label: "Frames before a verdict",
        value: "all n",
        note: "n itself is never stated in the paper",
      },
      note: [
        "The abstract asks for 'an automated framework capable of detecting violence, issuing early alerts, and facilitating quick reactions'. The classifier chosen to do it is a bidirectional GRU, and bidirectional means what it says: one recurrence runs from the first frame to the last, a second runs from the last frame to the first, and the two hidden states are concatenated before anything is classified.",
        "The paper is explicit about why, and the reasoning is sound for the task as it defines it: 'context from both preceding and subsequent frames is crucial for accurate classification' (p5). Knowing what happened after a shove helps decide whether it was a shove. The cost is that the backward pass cannot start until the clip has ended, so there is no partial verdict, no growing confidence, and no possible alert before the last frame has arrived.",
        "That is a structural property, not a tuning issue, and it puts the model in a different category from a streaming detector. It classifies completed clips. For the stated application -- watching a live camera and raising an alarm quickly -- the whole architecture would have to be run over a sliding window, which the paper does not do and does not cost.",
        "What makes this hard to weigh is that the comparison is never run. BiGRU is compared against LSTM and against a CNN, but a plain forward GRU appears nowhere, so the accuracy the bidirectionality buys is unmeasured. Since every deep configuration already sits at 1.000, these datasets could not have measured it anyway.",
      ],
      takeaways: [
        "A backward pass requires the end of the sequence. No verdict exists until the last frame is in.",
        "The paper's own justification is accuracy from future context, which is a real benefit -- for offline clip classification.",
        "No forward-only GRU is ever run, so the price of the extra pass is not reported.",
        "n, the number of frames per clip, is never stated, so even the latency cannot be quantified in seconds.",
      ],
      visual: {
        kind: "bidirectional-sequence",
        options: {
          hue: 12,
          // The clip length is illustrative: the paper writes it as n and never
          // assigns it a value, which the readout says explicitly.
          frames: 16,
          // Only the bidirectional configuration was ever run (T3-T5). A
          // forward-only GRU appears nowhere in the paper, so it stays
          // unmeasured rather than being guessed at.
          accuracy: { bidirectional: 100 },
          labels: {
            forward: "forward GRU",
            backward: "backward GRU",
            verdict: "concat → dense → softmax",
          },
          copy: {
            readout: "Crowd accuracy",
            directionLabel: "Recurrence",
            chips: { forward: "forward only", bidirectional: "bidirectional" },
            lines: {
              forward:
                "A forward-only recurrence has a hidden state after every frame, so a verdict exists as soon as you care to read one -- this is the shape an early alert needs. The paper never runs this configuration, so what it would score is not known.",
              bidirectional:
                "The configuration the paper uses. The backward pass starts at the last frame, so nothing can be concatenated, and nothing can be classified, until the clip is over.",
            },
          },
        },
        caption:
          "Frames along the clip, with the forward recurrence above and the backward one below. Switch to bidirectional and watch the verdict block stay pale until both passes have landed. The accuracy readout reports the forward-only case as unmeasured, because the paper never ran it.",
      },
      pdfPage: 6,
    },

    {
      id: "saturation",
      title: "Twenty-one configurations, and most of them score exactly 1.000",
      tagline: "A benchmark with nothing left to measure",
      highlight: {
        label: "Perfect cells",
        value: "18 of 18",
        note: "deep extractors under LSTM and BiGRU, all three datasets",
      },
      note: [
        "Take the paper's recommended classifier and line the seven feature extractors up beside each other. On movies, five of the seven are at 1.000. On hockey and crowd, all four deep extractors are at 1.000 and stay there. Accuracy, recall, precision and F1 are all exactly 1.000 in those cells -- not 0.998, not one misclassified clip.",
        "This is the ceiling of the benchmarks, not a property of the model. The paper half-recognises it for the movies set, explaining that film scenes have deliberately configured lighting and camera angles and so are clean and low-noise. It does not extend the explanation to hockey and crowd, where the same thing has happened.",
        "What the tables can still resolve is the gap between classical and deep features, and that gap is real and large. With a BiGRU on the crowd set, PCA scores 0.500 and a Daubechies-8 wavelet 0.656, against 1.000 for every deep extractor. That contrast survives the saturation. Any ranking within the four deep lanes does not, and the paper's conclusion is a ranking within those four lanes.",
        "The PCA cell on crowd deserves reading properly, because the accuracy column disguises it. Accuracy 0.500 with recall 0.500 and precision 0.250 on a balanced 123/123 set is what a classifier looks like when it has put every clip in the same class. It is not a model that is right half the time; it is a model that has not learned to discriminate at all, and only the precision column says so.",
      ],
      takeaways: [
        "All four deep extractors reach 1.000 on hockey and crowd under both LSTM and BiGRU. There is no resolution left to rank them with.",
        "Classical features do separate: PCA 0.500 and wavelet 0.656 on crowd, against 1.000 for the deep lanes.",
        "The majority-class floor is exactly 50% on all three datasets -- every set is balanced -- which is where crowd PCA lands.",
        "Specificity and G-mean were promised in Section 2 and in Figure 1's evaluation box, and never reported. Neither was any fold-to-fold spread, despite 10-fold cross-validation.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          mode: "outcome",
          hue: 12,
          baselineId: "resnet152",
          metricLabel: "Accuracy",
          datasetLabel: "Dataset",
          // T3, T4 and T5, BiGRU block only -- the paper's recommended
          // classifier. All three sets are balanced, so the floor is 50.
          datasets: [
            {
              id: "movies",
              label: "Movies",
              title: "200 clips, 100 per class, film footage",
              floor: 50,
              floorLabel: "majority class",
            },
            {
              id: "hockey",
              label: "Hockey",
              title: "1000 clips, 500 per class, NHL broadcast footage",
              floor: 50,
              floorLabel: "majority class",
            },
            {
              id: "crowd",
              label: "Crowd",
              title: "246 clips, 123 per class, Violent-Flows",
              floor: 50,
              floorLabel: "majority class",
            },
          ],
          models: [
            {
              id: "pca",
              label: "PCA",
              metrics: {
                movies: { accuracy: 82.5 },
                hockey: { accuracy: 75.5 },
                crowd: { accuracy: 50.0 },
              },
            },
            {
              id: "wavelet",
              label: "Db8 wavelet",
              metrics: {
                movies: { accuracy: 97.5 },
                hockey: { accuracy: 86.5 },
                crowd: { accuracy: 65.6 },
              },
            },
            {
              id: "vgg16",
              label: "VGG-16",
              metrics: {
                movies: { accuracy: 100 },
                hockey: { accuracy: 97.5 },
                crowd: { accuracy: 100 },
              },
            },
            {
              id: "vgg19",
              label: "VGG-19",
              metrics: {
                movies: { accuracy: 100 },
                hockey: { accuracy: 96.5 },
                crowd: { accuracy: 100 },
              },
            },
            {
              id: "resnet50",
              label: "ResNet50V2",
              metrics: {
                movies: { accuracy: 100 },
                hockey: { accuracy: 100 },
                crowd: { accuracy: 100 },
              },
            },
            {
              id: "resnet101",
              label: "ResNet101V2",
              metrics: {
                movies: { accuracy: 100 },
                hockey: { accuracy: 100 },
                crowd: { accuracy: 100 },
              },
            },
            {
              id: "resnet152",
              label: "ResNet152V2",
              metrics: {
                movies: { accuracy: 100 },
                hockey: { accuracy: 100 },
                crowd: { accuracy: 100 },
              },
            },
          ],
        },
        caption:
          "The BiGRU block of Tables 3, 4 and 5, one lane per extractor. The four deep lanes are flat at 100 on every dataset. Switch to crowd and watch PCA drop to the majority-class marker, which is where a classifier that has picked one class for everything ends up. Every lane reports sensitivity and specificity as not published, because they are not.",
      },
      pdfPage: 9,
    },

    {
      id: "depth-claim",
      title: "The depth claim lives in one classifier and two decimal places",
      tagline: "50 against 101 against 152",
      highlight: {
        label: "Largest depth effect",
        value: "+2.0",
        note: "crowd, CNN head; 0.0 under LSTM and BiGRU",
      },
      note: [
        "The abstract states that 'deeper ResNet models significantly improve overall performance of the model in terms of violence detection scores, relative to shallower ResNet models', and the conclusion repeats it. The three depths are directly comparable in every table, so the claim can be checked exactly.",
        "Under the BiGRU -- the classifier the paper recommends and names in its own conclusion -- ResNet50V2, ResNet101V2 and ResNet152V2 all score 1.000 on movies, 1.000 on hockey and 1.000 on crowd. Every metric, every dataset. The difference between 25.6 M parameters and 60.2 M parameters is exactly zero. Under the LSTM, the same: 1.000 across the board.",
        "The entire effect sits in the CNN head, the one classifier the paper argues against. On crowd it is 0.980, 0.985, 1.000; on hockey 0.990, 0.995, 1.000; on movies all three are 1.000. So the largest measured benefit of tripling the depth of the backbone is two accuracy points, on one dataset, under a classifier the paper does not recommend, on a benchmark where the top of the scale has already been reached.",
        "It costs 0.492 s per image instead of 0.231 s to get there. That is the honest summary of the depth axis in this paper: the shallowest model is already at the ceiling wherever it matters, and the deeper models buy their difference only where the classifier is weak enough to leave room for one.",
      ],
      takeaways: [
        "Under BiGRU and under LSTM, all three ResNet depths are identical at 1.000 on all three datasets.",
        "Under the CNN head: crowd 0.980 / 0.985 / 1.000, hockey 0.990 / 0.995 / 1.000, movies 1.000 / 1.000 / 1.000.",
        "The claim of a significant improvement from depth is supported by two accuracy points in one cell of one table.",
        "The extraction cost more than doubles from 50 to 152 layers, 0.231 s to 0.492 s per image, and that cost is paid on every frame.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          mode: "outcome",
          hue: 12,
          baselineId: "resnet50",
          metricLabel: "Crowd accuracy",
          // The chip axis here is the classifier rather than the dataset --
          // what the whole lineup is reported across. T5 p9, crowd set.
          datasetLabel: "Classifier",
          datasets: [
            {
              id: "cnn",
              label: "CNN",
              title: "Three conv + max-pool layers, SGD, 200 epochs",
              floor: 50,
              floorLabel: "majority class",
            },
            {
              id: "lstm",
              label: "LSTM",
              title: "Adam, 100 epochs",
              floor: 50,
              floorLabel: "majority class",
            },
            {
              id: "bigru",
              label: "BiGRU",
              title: "The recommended classifier. Adam, 100 epochs",
              floor: 50,
              floorLabel: "majority class",
            },
          ],
          models: [
            {
              id: "resnet50",
              label: "ResNet50V2",
              metrics: {
                cnn: { accuracy: 98.0 },
                lstm: { accuracy: 100 },
                bigru: { accuracy: 100 },
              },
            },
            {
              id: "resnet101",
              label: "ResNet101V2",
              metrics: {
                cnn: { accuracy: 98.5 },
                lstm: { accuracy: 100 },
                bigru: { accuracy: 100 },
              },
            },
            {
              id: "resnet152",
              label: "ResNet152V2",
              metrics: {
                cnn: { accuracy: 100 },
                lstm: { accuracy: 100 },
                bigru: { accuracy: 100 },
              },
            },
            {
              id: "vgg19",
              label: "VGG-19",
              metrics: {
                cnn: { accuracy: 69.4 },
                lstm: { accuracy: 93.9 },
                bigru: { accuracy: 100 },
              },
            },
          ],
        },
        caption:
          "The three ResNet depths on the crowd set, with VGG-19 as a reference lane, switched by classifier rather than by dataset. Under CNN the depths separate by half a point at a time. Switch to LSTM or BiGRU and the three lanes become indistinguishable — which is where the paper's recommended configuration lives.",
      },
      pdfPage: 9,
    },

    {
      id: "uncosted-extraction",
      title: "The stopwatch was started after the expensive part",
      tagline: "0.38 s against 0.492 s per frame",
      highlight: {
        label: "Compute per second of video",
        value: "12.3 s",
        note: "extraction alone, at the paper's own 25 fps target",
      },
      note: [
        "Section 5.1 is titled 'Computational Efficiency and Real-time Feasibility', and it makes its case from one number: 'For the crowd dataset, the total test time for the ResNet152V2-BiGRU model was 0.38 s per video. Assuming a standard video clip length of a few seconds, this demonstrates good potential for near-real-time analysis.'",
        "The column immediately to the left in the same table says feature extraction with ResNet152V2 costs 0.492 s per image. The 0.38 s figure is the testing time for the recurrent head, running on features that have already been computed. It is the last and cheapest stage of the pipeline, quoted as though it were the pipeline.",
        "Compose the two and the conclusion inverts. At 0.492 s per image, one second of video at 25 fps -- the rate the same paragraph names as the target -- needs about 12.3 seconds of feature extraction. Thirty frames per second needs about 14.8. The system processes roughly two frames per second where twenty-five arrive, so the backlog grows by an order of magnitude faster than it clears, and no amount of clip buffering fixes a deficit that scales with the video's length.",
        "The paper gets to the right answer in the next sentence without connecting it to the previous one: 'for true real-time streaming at standard frame rates (e.g., 25-30 fps), the current model requires optimization'. Both statements are in the same paragraph. The refutation of the near-real-time claim is the paper's own measurement, sitting one column away from the claim.",
      ],
      takeaways: [
        "0.38 s covers the classifier only. 0.492 s per image covers the extractor, and every frame pays it.",
        "About 12.3 s of compute per second of video at 25 fps, from the paper's own numbers — roughly 2 fps of throughput.",
        "The two costs are never multiplied together, and cannot be by the reader either: n, the frames per clip, is never stated.",
        "No hardware is named anywhere in the paper — no CPU, no GPU, no RAM, no framework — so none of these timings can be compared to any other paper or any deployment target.",
      ],
      visual: {
        kind: "throughput-budget",
        options: {
          hue: 12,
          // S5.1 p9 and the timing columns of T5. The claim is argued from the
          // classifier stage alone; the extractor is in the adjacent column.
          budgetSeconds: 1,
          clipSeconds: 1,
          frameRates: [25, 30],
          stages: [
            {
              id: "classifier",
              label: "BiGRU classifier",
              perClip: 0.38,
              countedInClaim: true,
              note: "0.38 s testing time, T5 crowd · the only figure the real-time claim uses",
            },
            {
              id: "extraction",
              label: "ResNet152V2 features",
              perFrame: 0.492,
              countedInClaim: false,
              note: "0.492 s per image, S5.1 p9 · paid on every frame, never added to the claim",
            },
          ],
          copy: {
            readout: "Compute per second of video",
            scopeLabel: "Stages counted",
            rateLabel: "Input frame rate",
            chips: { claimed: "as claimed", full: "whole pipeline" },
            lines: {
              claimed:
                "The scope of Section 5.1's argument: the recurrent head, running on features that already exist. Inside the one-second budget, and the basis for 'good potential for near-real-time analysis'.",
              full:
                "The same clip with feature extraction included, at 0.492 s for every frame. Each block is one second of compute owed for one second of video.",
            },
          },
        },
        caption:
          "The outlined block is the real-time budget: one second of compute for one second of video. Each solid block is a second actually owed. Switch from the claimed scope to the whole pipeline and the row runs off the end of the budget by more than twelve times.",
      },
      pdfPage: 9,
    },
  ],
};
