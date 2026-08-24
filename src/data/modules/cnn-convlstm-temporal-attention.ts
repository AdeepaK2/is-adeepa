import type { StudyModule } from "@/types/study";

/**
 * El-Fiky, El-Fishawy, Ein-Shoka, Bayoumi & Shoitan (2026), "Spatiotemporal
 * violence detection in surveillance video via CNN-ConvLSTM with temporal
 * attention fusion". Results in Engineering 30:111076.
 * DOI 10.1016/j.rineng.2026.111076. Accepted 15 May 2026.
 *
 * Unusually for this library, the paper's own experiments audit clean. Table 1's
 * parameter total reproduces exactly from its layer list, Table 3's splits are
 * exactly 70/10/20 on all four datasets, Figure 7's confusion matrices
 * reproduce Table 4's metrics, and every delta quoted in Section 4.4.1 checks
 * out against its table. The errors are concentrated in Section 4.4.3, where it
 * describes other people's results, and in one paragraph of Section 4.5.2.
 *
 * Fig. 7's per-fold digits are rasterised rather than text, so the fold-level
 * counts below were read from the figure and confirmed by reconstruction
 * against Table 4 -- not quoted from the PDF's text layer.
 *
 * Table and figure map (physical PDF pages, 1-based):
 *   F1 p4   overall architecture         F6 p9   cross-validation ROC curves
 *   T1 p4   custom CNN layer table       F7 p10  per-fold confusion matrices
 *   F2 p5   ConvLSTM cell               F8 p11  temporal attention weights
 *   F3 p5   temporal attention module   F9 p12  prediction samples
 *   T2 p6   hardware and runtime        T5 p13  comparison with 19 methods
 *   T3 p6   dataset splits (in chunks)  T6 p13  CNN depth/width ablation
 *   F4 p7   dataset samples             T7 p14  LSTM vs ConvLSTM, +/- attention
 *   T4 p8   proposed vs pretrained      F5 p8   misclassified samples
 */
export const moduleCnnConvLstmTemporalAttention: StudyModule = {
  slug: "cnn-convlstm-temporal-attention",

  premise:
    "Almost every CNN-plus-recurrent model in this library reaches for a pretrained backbone, on the assumption that ImageNet features are a free head start. This paper tests that assumption directly: it builds a six-block CNN from scratch, holds the ConvLSTM and attention head fixed, and swaps in VGG-16, VGG-19 and MobileNetV2 as controls. The 1.58-million-parameter custom network wins on three of four datasets while running two to three times faster. Its own ablation then undercuts the title, because the ConvLSTM turns out to be the component that earns least.",

  results: [
    { label: "AIRTLab", value: "99.15%", note: "best of four datasets, T4" },
    { label: "Temporal attention", value: "+5.25", note: "points on Surveillance Fight, T7" },
    { label: "Custom CNN", value: "1.58 M params", note: "T1 · recomputes exactly" },
  ],

  review: {
    architecture: {
      family: "CNN-LSTM",
      backbone:
        "A purpose-built lightweight CNN trained from scratch — no pretrained weights anywhere in the proposed model. Six convolutional blocks, each a 3×3 convolution at stride 1 followed by batch normalisation and 2×2 max-pooling, with filters doubling 16 → 32 → 64 → 128 → 256 → 512, then a dropout layer. Table 1 gives 1,576,800 total parameters, 1,574,784 trainable and 2,016 non-trainable. VGG-16, VGG-19 and MobileNetV2 appear only as swap-in controls in T4, with the rest of the pipeline held fixed.",
      motionEncoding:
        "By recurrent state over 16 frames, with the spatial grid preserved rather than flattened. Each of the 16 frames is encoded independently by the shared CNN to a 3×3×512 map; a ConvLSTM with 64 filters and a 3×3 kernel then walks the sequence, so its gates convolve over the spatial grid instead of multiplying a flattened vector. That is the paper's stated reason for choosing ConvLSTM over LSTM. No optical flow, no frame differencing, no 3D convolution, no pose. Long-range structure is then re-weighted by temporal attention over the 16 time steps.",
      inputs: [
        "RGB frames only, resized to 224×224",
        "16 consecutive frames per sample — the paper calls this a chunk, and it is the unit of training, splitting and scoring alike",
        "Videos are cut into consecutive non-overlapping 16-frame chunks, so one clip yields several samples: about 2 on Hockey Fights and 10 on AIRTLab (derived from T3)",
      ],
      fusion:
        "Single stream, so nothing is fused across modalities. The one aggregation is temporal: the ConvLSTM's (B, 16, 1, 1, 64) output is flattened per time step to (B, 16, 64), and the attention module collapses the 16 steps into a single (B, 64) context vector by weighted sum. That collapse is the only place the sequence becomes a fixed-length representation.",
      supervision:
        "Supervised binary classification, violence / non-violence. Two fully connected layers of 256 (ReLU) and 1 (sigmoid). Adam, learning rates swept over 0.001 / 0.0001 / 0.00001, batch sizes 8 and 16, early stopping after 5 epochs without improvement. The reported configuration is batch 8 or 16 at learning rate 0.0001, chosen per dataset.",
      notes: [
        "Table 1's stride column contradicts both the text and its own output shapes. Every max-pooling row lists stride 1×1, while Section 3.2 says pooling uses 'a 2 × 2 kernel and a stride of 2 × 2' — and the shapes halve at each stage (224 → 112 → 56 → 28 → 14 → 7 → 3), which only a stride of 2 produces. The text and the shapes agree with each other, so 2×2 is the real stride and the table's column is wrong.",
        "The parameter total is worth checking because it passes. Summing the six convolutions (448 + 4,640 + 18,496 + 73,856 + 295,168 + 1,180,160 = 1,572,768) and the six batch-norm layers (4,032) gives exactly 1,576,800, with the non-trainable half of batch-norm exactly 2,016. This is the only paper in the review whose reported parameter count reconstructs to the digit from its own layer table.",
        "That total covers the CNN alone. The ConvLSTM is not in it, and it is not a small layer: a 3×3 ConvLSTM mapping 512 input channels to 64 filters has four gate convolutions over a 512-channel input, making it comparable in size to the entire six-block CNN. The paper reports no figure for it, so the model's actual parameter count is never stated.",
        "Section 3.3 writes the ConvLSTM's input as (B, 16, 3, 512), which is four dimensions where five are needed. The CNN's per-frame output is 3×3×512, so the sequence tensor is (B, 16, 3, 3, 512) — which is what Figure 1 draws. One spatial dimension is dropped in the prose, not in the model.",
        "The attention is textbook additive scoring: a dense layer with tanh produces one score per time step, softmax normalises them, and the context vector is the weighted sum. It is applied after the recurrence, over time only — there is no spatial or channel attention anywhere, and no self-attention.",
        "Six blocks is not just more accurate than five, it is also faster, on all four datasets (T6). The reason is structural and the paper does not remark on it: a sixth pooling stage shrinks the map entering the ConvLSTM from 7×7 to 3×3, and the ConvLSTM is where the cost sits. Section 4.5.1 describes the five-block variants as having 'comparable computational cost', which understates its own result.",
      ],
    },

    attention: {
      used: true,
      kinds: ["temporal"],
      mechanisms: [
        {
          name: "Temporal attention (additive scoring, softmax-weighted sum over time steps)",
          placement:
            "After the ConvLSTM and before the classifier, on its TimeDistributed-flattened output. Operates on the (B, 16, 64) sequence: score_t = tanh(W·v_t + b), a_t = softmax(score_t), context = Σ a_t·v_t, collapsing 16 time steps into one 64-dimensional vector (Eqs. 6-8, F3 p5).",
          reportedEffect:
            "T7 p14, added to the proposed CNN + ConvLSTM: +0.45 points on Hockey Fights (98.51 → 98.96), +1.41 on RLVS (97.13 → 98.54), +5.25 on Surveillance Fight (88.85 → 94.10) and +0.36 on AIRTLab (98.79 → 99.15). Added to a CNN + plain LSTM instead: +0.35, +0.05, +1.86 and +0.42. Largest gain on the hardest and most CCTV-like dataset, and larger on ConvLSTM than on LSTM in every case.",
        },
      ],
      notes: [
        "This is one of the better-evidenced attention ablations in the review, because T7 runs the full 2×2 grid — LSTM and ConvLSTM, each with and without attention — on all four datasets. Most papers here ablate attention on one dataset or not at all.",
        "Read across that grid and the paper's title is in the wrong order. Without attention, ConvLSTM is not better than a plain LSTM: it ties on Hockey Fights (98.51 both), loses on RLVS (97.13 against 97.71) and on Surveillance Fight (88.85 against 89.62), and wins on AIRTLab by 0.23. Attention is what makes the ConvLSTM pay — with it, ConvLSTM leads by 0.10, 0.78, 2.62 and 0.17. The paper states this plainly: 'ConvLSTM alone does not consistently outperform LSTM. However, temporal attention is the decisive factor.' Credit for saying so.",
        "The attention weight visualisation argues against the mechanism it is meant to illustrate. Figure 8 plots the 16 softmax weights for one violent and one non-violent Hockey Fights sample, and Section 4.4.2 reads them as 'relatively evenly distributed, with only slight variations between frames', concluding that the model 'captures long-range temporal dependencies rather than over-relying on a single trigger frame'. But a near-uniform softmax over 16 steps is close to mean-pooling — the selective weighting the module exists to provide is not visible. Something has to explain +5.25 points on Surveillance Fight, and near-uniform weights do not.",
        "Three candidate explanations the paper does not separate: the dense scoring layer's own parameters, the change of aggregation from taking the last hidden state to a weighted sum over all 16 (which alters what the gradient reaches even at uniform weights), and the different optimisation trajectory under early stopping. Nothing in the paper distinguishes an attention that is selective from an attention that merely mean-pools better.",
        "The evidence for the visualisation is also thin: two samples, from one of the four datasets, and the one where attention helps least (+0.45). No attention weights are shown for Surveillance Fight, where the effect is twelve times larger.",
      ],
    },

    efficiency: {
      parameters:
        "1,576,800 total, 1,574,784 trainable, 2,016 non-trainable (T1 p4) — the custom CNN only. The ConvLSTM, attention and classifier layers are not counted, so no figure for the whole model is reported.",
      flops: undefined,
      modelSize: undefined,
      throughput:
        "0.15-3.29 ms per frame, the range spanning all four backbone variants (T2 p6). Whole-test-set inference for the proposed model: 4.32 s on Hockey Fights, 32.81 s on RLVS, 2.32 s on Surveillance Fight, 7.23 s on AIRTLab (T4 p8).",
      hardware:
        "Intel Xeon W-2125 CPU, 128 GB RAM, Nvidia Quadro P4000 GPU, TensorFlow on Python 3.9 (T2 p6). Both T2 and Section 4.1 give the P4000 as 24 GB; the card ships with 8 GB, so the memory figure cannot be taken at face value.",
      realTime: {
        status: "measured-and-supported",
        note: "The claim is supported, and it is supported by numbers that reconcile — rare in this review. T2's 0.15-3.29 ms per frame is 304-6,667 fps, far above any camera rate. It also cross-checks: dividing T4's per-dataset inference times by the test chunks in T3 times 16 frames gives 0.60-0.79 ms per frame for the proposed model (4.32 s / 6,432 frames on Hockey, 32.81 s / 54,512 on RLVS, 2.32 s / 2,928 on Surveillance Fight, 7.23 s / 11,328 on AIRTLab), all inside T2's stated range, with VGG-19's 72.00 s on RLVS landing at 1.32 ms. Two independently reported quantities agreeing is what makes this a measurement rather than an assertion. The caveats are about scope, not honesty: this is batched throughput over a test set on a workstation GPU, not single-camera streaming latency, and it excludes decoding and resizing.",
      },
      edgeDeployment: {
        status: "not-addressed",
        note: "Explicitly deferred. The conclusion lists it as future work — 'further optimization will be explored to support deployment on edge devices and resource-constrained environments' — and no embedded, Jetson, Raspberry Pi, mobile or CPU-only measurement appears anywhere. The abstract's 'lightweight' is a relative claim against VGG-16 and VGG-19, and T4's timings do support it in that comparison, but nothing here speaks to a device smaller than a Quadro P4000.",
      },
      notes: [
        "T4's inference column is the paper's efficiency argument and it is consistent across datasets: the custom CNN is the fastest of the four backbones every time, by 15.6-55.2% on Hockey Fights, up to 54.4% on RLVS, 30.7% against MobileNetV2 on Surveillance Fight, and 12.0-56.9% on AIRTLab. Every one of those percentages recomputes correctly from the table.",
        "T7's timing column, by contrast, cannot be read as architectural cost. Adding the temporal attention module — one dense layer of 65 parameters — makes the model measurably faster on all four datasets (4.52 → 4.32, 36.18 → 32.81, 2.32 → 2.32, 7.76 → 7.23). Strictly more computation cannot take strictly less time, so the 6-10% differences reflect early stopping producing different converged models, run-to-run variance, or shared-workstation load. No repeats or error bars are given for any timing figure.",
        "No FLOPs anywhere, and no model size in MB. With the ConvLSTM's parameters also unreported, the only quantitative handle on model cost is the CNN's 1.58 M, which is the part the paper designed rather than the part that dominates.",
        "There is no uncosted pre-processing to flag, which is itself worth recording: the pipeline's only preparation is resizing frames to 224×224. No optical flow, no pose estimation, no keyframe selection — the steps that go untimed in most papers here simply do not exist in this one.",
      ],
    },

    evaluation: {
      datasets: [
        {
          name: "Hockey Fight",
          role: "evaluation",
          note: "500 violent / 500 non-violent clips of 1-2 s at 360×288, broadcast ice hockey (T3 p6). Split into 1,404 / 201 / 402 chunks — about 2 chunks per clip. Reported 98.96% accuracy, 99.87% AUC.",
        },
        {
          name: "RLVS",
          role: "evaluation",
          note: "Real Life Violence Situations, 1,000 / 1,000 clips of 3-7 s (T3 p6). By far the largest in chunk terms: 11,924 / 1,703 / 3,407. Reported 98.54% accuracy, 99.75% AUC. Note the chunk counts are not balanced even though the clip counts are — the test fold holds roughly 1,901 violent against 1,506 non-violent chunks, so violent clips in RLVS are systematically longer.",
        },
        {
          name: "Surveillance Camera Fight",
          role: "evaluation",
          note: "Listed as 'Surveillance Fight', 150 / 150 clips averaging 2 s, mixed resolutions, real CCTV (T3 p6). Split 637 / 92 / 183 chunks. The hardest of the four at 94.10% accuracy and 98.11% AUC, with the widest fold-to-fold AUC spread (±0.0105 against ±0.0002 on AIRTLab, F6 p9). Also the only dataset where the proposed CNN loses to a pretrained backbone.",
        },
        {
          name: "AIRTLab",
          role: "evaluation",
          note: "230 violent / 120 non-violent clips of 2-14 s at 1920×1080, staged indoor scenes from two fixed cameras (T3 p6). Split 2,475 / 354 / 708 chunks, about 10 per clip. The best result at 99.15% accuracy and 99.97% AUC — and the most class-imbalanced, so a majority-class predictor already scores about 65.7% at clip level.",
        },
      ],
      split:
        "Five repeats of a random 80/20 train/test split, with 12.5% of the training portion held out for validation — so 70/10/20. T3 reports the resulting sizes in 16-frame chunks and all four datasets land on that ratio to within 0.2 points (Hockey 1,404/201/402; RLVS 11,924/1,703/3,407; Surveillance Fight 637/92/183; AIRTLab 2,475/354/708). Described as 'cross-validation' and as five repeated random splits, which are not the same design: repeated random subsampling does not guarantee every sample is tested once, and the paper does not say whether the five test folds are disjoint.",
      metrics: [
        "Accuracy",
        "Precision (per class)",
        "Recall (per class)",
        "F1-score (per class)",
        "AUC, with mean ± standard deviation across folds",
        "Loss",
        "Confusion matrices, all five folds (F7 p10)",
        "Inference time per test set, and per frame (T2, T4)",
      ],
      protocolNotes: [
        "The unresolved question in this paper is whether the split is by video or by chunk, and it decides how much the headline numbers mean. Section 4.1 says only that each dataset was randomly split 80/20, and T3 states the result in chunks. But one clip yields multiple chunks — about 2 on Hockey Fights, 8.5 on RLVS, 3 on Surveillance Fight, 10 on AIRTLab — and if the randomisation ran over chunks, adjacent 16-frame windows from the same video sat in both training and test. On AIRTLab, with roughly ten near-identical chunks per clip from a fixed camera, that would make a 99.15% test accuracy close to a memorisation check. Nothing in the paper excludes it, and nothing states a group-wise split.",
        "Reporting metrics per chunk rather than per video is also a comparability problem. T5 places these numbers beside eighteen other methods, most of which report video-level accuracy, and a chunk-level figure is not the same quantity — there is no aggregation step from chunk predictions to a video label anywhere in the paper.",
        "What does check out is the internal arithmetic, and it checks out unusually well. Figure 7's five per-fold confusion matrices reproduce Table 4's metrics on all four datasets: pooling the Hockey folds gives 1,001 TP / 988 TN / 12 FP / 9 FN over 2,010 chunks, which is 98.96% accuracy, 99.11% recall and 98.82% precision — Table 4's figures to the digit. AIRTLab pools to 99.15% / 99.50% / 99.25%, RLVS to 98.54% / 98.76% / 98.63%, all matching. Every delta quoted in Section 4.4.1 also recomputes correctly from Table 4.",
        "Section 4.4.3's claims about other people's work do not hold up as well. The abstract and Section 4.4.3.2 both state accuracy improvements 'ranging from 0.24% to 30.7%'. The lower bound is right (98.54 against Mobile Video Network A0's 98.30 on RLVS), but 30.7 is not an accuracy figure at all — the largest accuracy gap in T5 is 94.10 against 72.0 on Surveillance Fight, which is 22.1 points, and Section 4.4.3.2 states that correct figure itself two paragraphs earlier. 30.7% is the inference-time reduction against MobileNetV2 computed in Section 4.4.1. A speed number is carried into the abstract as an accuracy number.",
        "The companion claim of 'up to 32.5% in F1-score' has no visible source. The largest F1 gap derivable from T5 is 99.37 against 90 on AIRTLab, or 9.37 points.",
        "T5's nearest-competitor claims miss a row of their own table. On AIRTLab the paper names Conv2D + ConvLSTM + Conv2D at 98.29% as the closest method, for a margin of 0.86 — but PCA + LR sits in the same table at 98.31%, making the real margin 0.84 and the nearest competitor a classical baseline of principal components plus logistic regression. That a handcrafted method scores 98.31% on AIRTLab is the more interesting fact, and it says something about the dataset.",
        "Section 4.4.3.2 says EfficientNetB0 + Bi-LTMA + TSM 'outperformed the proposed model by 0.43% in accuracy' on Surveillance Fight. T5 gives that method 91.67% accuracy against the proposed 94.10%; the 0.43 gap is in F1-score (95.00 against 94.57), which Section 4.4.3.1 states correctly. The metric is mislabelled.",
        "Section 4.4.3 describes T5 as 'eighteen conventional violence detection methods published between 2021 and 2025'. The table has nineteen rows, the abstract says nineteen, and the first row is dated 2019.",
        "One paragraph of the ablation quotes the wrong dataset's numbers. Section 4.5.2 says that on RLVS the proposed model's accuracy 'rose from 97.13% to 99.15%, AUC from 99.49% to 99.97%, and loss dropped from 0.084 to 0.023'. The starting values are RLVS's, but 99.15 / 99.97 / 0.023 are AIRTLab's; T7's RLVS row reads 98.54 / 99.75 / 0.051. The real RLVS gain from attention is +1.41 points, not +2.02.",
        "Section 4.5.1 claims six convolutional blocks 'consistently achieves the best overall performance', and T6 contradicts the word consistently in three places: on Hockey Fights both five-block variants reach a higher AUC (99.89 against 99.87) and the 32-256 variant a lower loss (0.037 against 0.041), and on AIRTLab the 32-256 five-block variant ties on both accuracy (99.15) and F1 (99.37). The accuracy case for six blocks is real on the other three datasets; 'consistently' is not.",
        "Two smaller table errors. T4's Hockey Fights MobileNetV2 row gives non-violent precision as 97.90, which is inconsistent with its own recall and F1 in the same row — 96.90 reproduces the printed F1 of 96.70 exactly. And T5 prints U-Net (MobileNetV2) + LSTM's F1 as 0.961 while every other F1 in the table is on a 0-100 scale.",
        "Section 4.4.1 writes that the model 'achieved a reduction in AUC of up to 0.35%' where T4 shows a 0.35-point increase (99.87 against MobileNetV2's 99.52). The abstract has it the right way round.",
        "The one dataset closest to operational CCTV is the one the paper's own contribution loses on. T4's Surveillance Fight rows put VGG-16 first at 95.08%, VGG-19 second at 94.86%, the proposed CNN third at 94.10% and MobileNetV2 last at 93.88%. The paper reports this openly and explains it — ImageNet features generalise better under low resolution, poor lighting and camera shake — but the abstract's 'improvements of up to 2.24% in accuracy' over pretrained backbones is a best case drawn from Hockey Fights, and the worst case is a loss on the footage the application is actually about.",
        "No cross-dataset evaluation, and the paper says so itself: the conclusion states that 'the model is currently evaluated using dataset-specific training, which may limit its generalization to unseen domains' and lists cross-dataset evaluation as future work. An explicit acknowledgement is better than the silence most papers in this review offer, but it leaves the generalisation question unanswered.",
        "Loss for the same configuration on RLVS is 0.050 in T4 and 0.051 in T6 and T7. Section 4.4.1 quotes 0.050.",
        "Hyperparameters were selected across a sweep of three learning rates and two batch sizes, and the reported configuration differs by dataset (batch 16 on RLVS, batch 8 elsewhere). A 10% validation split exists and is described, which is more than most papers here provide, but the paper does not state whether the selection was made on validation or on test.",
      ],
    },
  },

  concepts: [
    {
      id: "chunk-unit",
      title: "Everything is a 16-frame chunk — including the train/test split",
      tagline: "The unit that decides the numbers",
      highlight: {
        label: "Chunks per clip",
        value: "2 to 10",
        note: "Hockey Fights to AIRTLab, derived from T3",
      },
      note: [
        "The preprocessing section is three sentences long and easy to read past, but it sets the term on which every number in the paper rests. Each video is cut into 16-frame chunks and each chunk is a sample: the thing the CNN encodes, the thing the ConvLSTM walks, the thing the classifier labels, and — this is the part that matters — the thing counted in Table 3's split columns.",
        "How many chunks a clip produces depends on how long it is, and the four datasets differ a lot. Table 3's totals divided by the clip counts give roughly 2 chunks per clip on Hockey Fights, 3 on Surveillance Fight, 8.5 on RLVS and 10 on AIRTLab. So a single AIRTLab video contributes about ten samples to the experiment.",
        "The splits themselves are clean. Section 4.1 describes an 80/20 train/test division with 12.5% of the training portion held back for validation, which is 70/10/20, and all four datasets land there: 1,404/201/402, 11,924/1,703/3,407, 637/92/183 and 2,475/354/708 come to 69.9/10.0/20.0 or better. The arithmetic is right.",
        "What is missing is one sentence saying whether the randomisation ran over videos or over chunks. If it ran over chunks, then for AIRTLab — ten near-identical 16-frame windows from a fixed camera watching a staged scene — training and test contain views of the same event, and 99.15% is measuring recall of footage the model has already seen rather than generalisation to new footage. Nothing in the paper rules this out, and nothing describes a group-wise split.",
        "There is a second consequence even if the split is clean. These are chunk-level scores, and Table 5 places them beside eighteen other methods that mostly report video-level accuracy. The paper has no step that turns chunk predictions into a video label, so the comparison is between two different quantities.",
      ],
      takeaways: [
        "The 16-frame chunk is the unit of training, splitting and scoring. There is no video-level aggregation anywhere in the paper.",
        "One clip yields about 2 chunks on Hockey Fights and about 10 on AIRTLab, so chunk counts are not proportional to clip counts.",
        "The 70/10/20 ratio checks out on all four datasets to within 0.2 points — the arithmetic is sound.",
        "Whether the split is by video or by chunk is never stated, and the answer decides whether the near-ceiling numbers mean generalisation or memorisation.",
        "RLVS has 1,000 violent and 1,000 non-violent clips but roughly 1,901 violent against 1,506 non-violent test chunks — violent clips there are systematically longer.",
      ],
      pdfPage: 6,
    },

    {
      id: "attention-decides",
      title: "The ConvLSTM in the title is the component that earns least",
      tagline: "Reading the 2×2 ablation",
      highlight: {
        label: "Attention on Surveillance Fight",
        value: "+5.25",
        note: "88.85 → 94.10, T7",
      },
      note: [
        "Table 7 is the best-designed experiment in the paper: both temporal units, LSTM and ConvLSTM, each with and without temporal attention, on all four datasets. Sixteen cells, and they do not say what the title says.",
        "Take attention away and the ConvLSTM has no case. It ties a plain LSTM on Hockey Fights at 98.51%, loses on RLVS (97.13 against 97.71), loses on Surveillance Fight (88.85 against 89.62), and wins on AIRTLab by 0.23. Two losses, one tie, one narrow win — for the component the paper argues for on the grounds that flattening destroys spatial structure.",
        "Put attention back and the ordering flips: ConvLSTM leads by 0.10, 0.78, 2.62 and 0.17. So the two components are not additive contributions to be ranked; the ConvLSTM's spatial state is only usable once something learns how to weight the sequence it produces. The paper reaches this conclusion itself and states it without hedging — 'ConvLSTM alone does not consistently outperform LSTM. However, temporal attention is the decisive factor.' That is the right reading of its own table and it deserves credit.",
        "Attention's own contribution is larger and more consistent: +0.45, +1.41, +5.25 and +0.36 on top of the ConvLSTM. The pattern in those four numbers is the useful part. The gain is smallest where the data is cleanest (Hockey Fights and AIRTLab, both near ceiling) and largest by a factor of twelve on Surveillance Fight — real CCTV, low resolution, unstable camera. Where frames genuinely differ in how much they tell you, weighting them matters.",
        "One caution on reading Table 7's numbers as stated: Section 4.5.2's RLVS paragraph quotes the wrong figures, reporting the gain as 97.13% → 99.15% with AUC to 99.97% and loss to 0.023. Those three are AIRTLab's values. T7's RLVS row says 98.54 / 99.75 / 0.051, so the actual gain is +1.41 points rather than +2.02.",
      ],
      takeaways: [
        "Without attention, ConvLSTM loses to a plain LSTM on two of four datasets and ties on a third.",
        "With attention, ConvLSTM wins on all four — the components interact rather than adding up.",
        "Attention is worth +0.45, +1.41, +5.25 and +0.36 points, and its size tracks how difficult the footage is.",
        "The largest effect is on the only genuine CCTV dataset, which is the one that matters most for the application.",
        "Section 4.5.2's RLVS paragraph mistakenly quotes AIRTLab's numbers; the table itself is consistent.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          mode: "outcome",
          hue: 345,
          baselineId: "cnn-lstm",
          metricLabel: "Accuracy",
          // T7 p14. Accuracy only per lane, so each draws one bar -- this paper
          // does report per-class precision and recall, but not as the
          // sensitivity/specificity pair this visual's two bars want.
          // Floors are clip-level majority-class rates from T3.
          datasets: [
            { id: "hockey", label: "Hockey Fights", title: "Broadcast ice hockey, 402 test chunks", floor: 50, floorLabel: "majority class" },
            { id: "rlvs", label: "RLVS", title: "Real-world mixed scenes, 3,407 test chunks", floor: 50, floorLabel: "majority class" },
            { id: "surv", label: "Surveillance Fight", title: "Real CCTV: low resolution, poor lighting, camera shake", floor: 50, floorLabel: "majority class" },
            { id: "airtlab", label: "AIRTLab", title: "Staged indoor scenes, two fixed cameras, 230/120 clips", floor: 65.7, floorLabel: "majority class" },
          ],
          models: [
            {
              id: "cnn-lstm",
              label: "CNN + LSTM",
              metrics: {
                hockey: { accuracy: 98.51 },
                rlvs: { accuracy: 97.71 },
                surv: { accuracy: 89.62 },
                airtlab: { accuracy: 98.56 },
              },
            },
            {
              id: "cnn-convlstm",
              label: "CNN + ConvLSTM",
              metrics: {
                hockey: { accuracy: 98.51 },
                rlvs: { accuracy: 97.13 },
                surv: { accuracy: 88.85 },
                airtlab: { accuracy: 98.79 },
              },
            },
            {
              id: "cnn-lstm-ta",
              label: "CNN + LSTM + attention",
              metrics: {
                hockey: { accuracy: 98.86 },
                rlvs: { accuracy: 97.76 },
                surv: { accuracy: 91.48 },
                airtlab: { accuracy: 98.98 },
              },
            },
            {
              id: "proposed",
              label: "CNN + ConvLSTM + attention",
              metrics: {
                hockey: { accuracy: 98.96 },
                rlvs: { accuracy: 98.54 },
                surv: { accuracy: 94.10 },
                airtlab: { accuracy: 99.15 },
              },
            },
          ],
        },
        caption:
          "All sixteen cells of Table 7, with the delta measured against the plain CNN + LSTM baseline. Switch to Surveillance Fight to see the ablation's real shape: the ConvLSTM lane sits below the LSTM lane until attention is added, and then jumps past it by 2.6 points. On Hockey Fights and AIRTLab everything is packed against the ceiling and the ordering barely reads.",
      },
      pdfPage: 14,
    },

    {
      id: "uniform-weights",
      title: "The attention weights are almost uniform, and the paper calls that a success",
      tagline: "What Figure 8 shows",
      highlight: {
        label: "Weights across 16 frames",
        value: "≈0.04 – 0.07",
        note: "uniform would be 0.0625, F8",
      },
      note: [
        "Having established that temporal attention is the decisive component, the paper opens it up. Figure 8 plots the 16 softmax weights for one violent and one non-violent Hockey Fights sample. They sum to one, so a perfectly uniform distribution would put 0.0625 on every frame. The plotted bars run from about 0.04 to about 0.07.",
        "Section 4.4.2 reads this as a good sign: the weights are 'relatively evenly distributed, with only slight variations between frames', showing the model 'captures long-range temporal dependencies rather than over-relying on isolated, on a single trigger frame'. Long-range dependence is a reasonable thing to want. But it is not what this module was introduced to provide — Section 3.4 says it 'assigns adaptive importance weights to different time steps, allowing the model to emphasize frames that are more relevant to violent activities', and a near-uniform weighting emphasises nothing. The context vector is then close to a mean over the 16 time steps.",
        "That leaves the +5.25 points on Surveillance Fight unexplained. If the learned weights are nearly flat, the gain is not coming from selectivity, and three other candidates are left uneliminated. The scoring layer adds its own parameters. The aggregation changes from reading a final hidden state to a weighted sum over all 16 steps, which alters what the gradient reaches even at uniform weights. And early stopping means the two variants are different converged models, not the same model plus a module. The paper separates none of these.",
        "The evidence base is also narrower than the claim. Two samples, from one of four datasets — and specifically the dataset where attention is worth least (+0.45). No weights are shown for Surveillance Fight, where the effect is twelve times larger and where a genuinely selective distribution would be most likely and most persuasive.",
        "The honest reading is that Table 7 establishes attention matters and Figure 8 does not establish why. Those are separable findings, and the second one being open does not damage the first.",
      ],
      takeaways: [
        "A near-uniform softmax over 16 steps makes the context vector approximately a temporal mean — the opposite of selective weighting.",
        "The paper's own Section 3.4 motivates the module as emphasising the most relevant frames, which Figure 8 does not show it doing.",
        "Three untested alternatives could explain the gain: the extra parameters, the changed aggregation, or a different convergence point under early stopping.",
        "The visualisation covers two samples on the dataset where attention helps least, and none on the dataset where it helps most.",
      ],
      pdfPage: 11,
    },

    {
      id: "custom-vs-pretrained",
      title: "A CNN trained from scratch beats ImageNet — except on the CCTV footage",
      tagline: "Reading Table 4",
      highlight: {
        label: "vs VGG-19 on AIRTLab",
        value: "+1.07 pts, 2.3× faster",
        note: "99.15 vs 98.08, 7.23 s vs 16.77 s",
      },
      note: [
        "This is the experiment the paper is built around, and it is a fair one. The ConvLSTM and attention head are held fixed and only the feature extractor changes: the custom six-block CNN, VGG-16, VGG-19, MobileNetV2. Same datasets, same splits, same five folds. That controlled design is what makes the comparison worth reading, and it is rarer than it should be.",
        "On three of four datasets the 1.58-million-parameter network trained from scratch wins outright, and wins on speed by more than it wins on accuracy. Hockey Fights: 98.96% against 97.21% for VGG-19, in 4.32 s against 9.64 s. AIRTLab: 99.15% against 98.16% for VGG-16, in 7.23 s against 14.72 s. RLVS: 98.54% against 98.48%, in 32.81 s against 62.81 s — a 0.06-point accuracy margin alongside a halving of inference time, which is the more interesting half of that row.",
        "Then there is Surveillance Fight, and it inverts the result. VGG-16 takes it at 95.08%, VGG-19 second at 94.86%, the custom CNN third at 94.10%, MobileNetV2 last. The paper reports this without spin, notes the gap is under 1%, and offers a sound explanation: this dataset is low-resolution, badly lit, unstably framed CCTV, and features learned on a million ImageNet images transfer better into that kind of degradation than features learned from 637 training chunks.",
        "That caveat deserves more weight than the abstract gives it. The claimed 'improvements of up to 2.24% in accuracy' over pretrained backbones is Hockey Fights — broadcast sport, stable camera, consistent lighting. The one dataset that looks like the surveillance application in the title is the one where the contribution loses. If the argument is that purpose-built beats pretrained for real deployments, the paper's own hardest dataset is evidence against it.",
        "Every percentage Section 4.4.1 quotes from this table recomputes correctly — the 1.75-2.24 accuracy range, the 1.59-2.18 recall range, the 15.6-55.2% timing reductions, all of it. One wording slip: it describes 'a reduction in AUC of up to 0.35%' where the table shows a 0.35-point gain.",
      ],
      takeaways: [
        "Controlled swap: only the backbone changes, so the comparison actually isolates it.",
        "The custom CNN wins on Hockey Fights, RLVS and AIRTLab, and wins on inference time by 12-57% everywhere including where it loses on accuracy.",
        "On RLVS the accuracy margin is 0.06 points and the speed margin is 48% — the timing is the real result of that row.",
        "On Surveillance Fight the custom CNN is third of four, behind both VGG variants. The paper says so and explains why.",
        "The abstract's headline margin comes from the easiest dataset; the hardest one contradicts it.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          mode: "outcome",
          hue: 345,
          baselineId: "custom",
          metricLabel: "Accuracy",
          // T4 p8. Every backbone ran on every dataset, so no cells are missing
          // here -- unusual for this visual. Floors are clip-level majority-class
          // rates from T3.
          datasets: [
            { id: "hockey", label: "Hockey Fights", title: "98.96% for the custom CNN — its largest margin", floor: 50, floorLabel: "majority class" },
            { id: "rlvs", label: "RLVS", title: "0.06 points ahead of VGG-16, and twice as fast", floor: 50, floorLabel: "majority class" },
            { id: "surv", label: "Surveillance Fight", title: "The one dataset where both VGG variants beat the custom CNN", floor: 50, floorLabel: "majority class" },
            { id: "airtlab", label: "AIRTLab", title: "99.15% — the best result in the paper", floor: 65.7, floorLabel: "majority class" },
          ],
          models: [
            {
              id: "custom",
              label: "custom CNN (1.58 M)",
              metrics: {
                hockey: { accuracy: 98.96 },
                rlvs: { accuracy: 98.54 },
                surv: { accuracy: 94.10 },
                airtlab: { accuracy: 99.15 },
              },
            },
            {
              id: "vgg16",
              label: "VGG-16",
              metrics: {
                hockey: { accuracy: 97.11 },
                rlvs: { accuracy: 98.48 },
                surv: { accuracy: 95.08 },
                airtlab: { accuracy: 98.16 },
              },
            },
            {
              id: "vgg19",
              label: "VGG-19",
              metrics: {
                hockey: { accuracy: 97.21 },
                rlvs: { accuracy: 98.42 },
                surv: { accuracy: 94.86 },
                airtlab: { accuracy: 98.08 },
              },
            },
            {
              id: "mobilenetv2",
              label: "MobileNetV2",
              metrics: {
                hockey: { accuracy: 96.72 },
                rlvs: { accuracy: 96.84 },
                surv: { accuracy: 93.88 },
                airtlab: { accuracy: 97.37 },
              },
            },
          ],
        },
        caption:
          "Table 4's four backbones, with the delta measured against the custom CNN. Switch to Surveillance Fight and the deltas go negative for both VGG lanes — the only place in the table where that happens, and the dataset closest to the surveillance footage the paper is about.",
      },
      pdfPage: 8,
    },

    {
      id: "cost-and-claims",
      title: "The costs that reconcile, and the one number that travelled from the wrong column",
      tagline: "Auditing the efficiency claims",
      highlight: {
        label: "Derived per-frame time",
        value: "0.60 – 0.79 ms",
        note: "T4 ÷ T3, inside T2's stated range",
      },
      note: [
        "Most real-time claims in this library rest on one number with no hardware attached. This one can be cross-checked, and it survives. Table 2 states 0.15-3.29 ms per frame across all four backbone variants. Table 4 independently reports whole-test-set inference times, and Table 3 gives the test sizes in chunks. Divide the first by the second times 16 frames and the proposed model comes out at 0.672 ms per frame on Hockey Fights, 0.602 on RLVS, 0.792 on Surveillance Fight and 0.638 on AIRTLab — every one inside Table 2's range, with VGG-19's 72 s on RLVS landing at 1.32 ms. Two separately reported quantities agreeing is what makes this a measurement.",
        "The parameter count survives a harder check. Reconstructing Table 1 layer by layer — 448 + 4,640 + 18,496 + 73,856 + 295,168 + 1,180,160 for the convolutions and 4,032 for the batch-norm layers — gives 1,576,800, exactly the printed total, with the non-trainable share landing on 2,016 exactly as stated. No other paper in this review reports a parameter count that reconstructs to the digit.",
        "What that total leaves out is the larger half. It covers the CNN and stops there. The ConvLSTM maps 512 input channels to 64 filters through four gate convolutions, which makes it comparable in size to the whole six-block network, and no figure is given for it. So the paper's most trustworthy number describes the part its authors designed rather than the part that dominates the model. There are no FLOPs and no model size anywhere either.",
        "Table 7's timing column should not be read as cost. Adding the temporal attention module — one dense layer, 65 parameters — makes the model faster on all four datasets: 4.52 to 4.32, 36.18 to 32.81, 2.32 to 2.32, 7.76 to 7.23. Strictly more computation cannot take strictly less time, so those 6-10% swings are early stopping landing on different models, run-to-run variance, or other load on the workstation. No timing figure anywhere is repeated or given an error bar.",
        "Then the abstract's headline, which is where a speed number becomes an accuracy number. It claims 'accuracy improvements ranging from 0.24% to 30.7%' against nineteen prior methods. The lower bound is right — 98.54 against 98.30 on RLVS. The upper bound is not an accuracy figure at all: the largest accuracy gap in Table 5 is 94.10 against 72.0 on Surveillance Fight, which is 22.1 points, and Section 4.4.3.2 states that correct number itself. 30.7% is the inference-time reduction against MobileNetV2 from Section 4.4.1. The companion claim of 'up to 32.5% in F1-score' has no traceable source either; the largest F1 gap in Table 5 is 9.37 points.",
        "The pattern across the whole paper is consistent and worth naming. Where it measures its own model, the arithmetic holds up — Section 4.4.1's deltas, Table 1's parameters, Figure 7's confusion matrices against Table 4, Table 3's splits. Where it describes other people's results, in Section 4.4.3, it slips repeatedly: the metric conflation above, an F1 gap labelled as accuracy, a nearest competitor named while a better row sits in the same table at 98.31%, and nineteen methods called eighteen and dated from 2021 when the first is 2019.",
      ],
      takeaways: [
        "Real-time is genuinely supported: 0.15-3.29 ms per frame, and Table 4 ÷ Table 3 independently reproduces 0.60-0.79 ms for the proposed model.",
        "Table 1's 1,576,800 parameters reconstruct exactly from its own layer list — the only such case in this review.",
        "That count excludes the ConvLSTM, which is comparable in size, so the full model's parameter count is never reported. No FLOPs, no model size.",
        "Table 7's timings show the larger model running faster, so they measure run-to-run variance rather than architectural cost.",
        "The abstract's '30.7%' accuracy improvement is a timing figure. The real maximum is 22.1 points, which the paper states correctly elsewhere.",
        "Hardware is fully specified — Xeon W-2125, Quadro P4000 — though the 24 GB given for a card that ships with 8 GB does not add up.",
      ],
      pdfPage: 6,
    },
  ],
};
