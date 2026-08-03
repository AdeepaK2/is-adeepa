import type { StudyModule } from "@/types/study";

/**
 * Asad, Yang, He, Shamsolmoali & He (2021), "Multi-frame feature-fusion-based
 * model for violence detection". The Visual Computer 37:1415-1431.
 * DOI 10.1007/s00371-020-01878-6. Published online 24 June 2020.
 *
 * Every number here is from the paper's own tables. Where the text contradicts a
 * table or a figure -- and it does, twice -- both readings are recorded.
 *
 * Table and figure map (physical PDF pages, 1-based):
 *   F1 p3   model overview            F6  p9   test-fold accuracy curves
 *   F2 p4   low/high feature maps     T2  p10  learning-rate sweep
 *   F3 p5   the fusion diagram        F7  p10  train/test loss curves
 *   F4 p5   WDRB vs residual block    F8  p11  t-SNE embedding
 *   F5 p8   threshold selection       F10 p12  confusion matrices
 *   T1 p8   dataset statistics        F11 p13  ROC and AUC per dataset
 *                                     T3  p13  comparison with prior work
 *                                     T4  p14  ablation against baselines
 */
export const moduleMultiFrameFusion: StudyModule = {
  slug: "multi-frame-feature-fusion",

  premise:
    "Every other paper here answers 'how does motion get into the representation?' with a mechanism: 3D kernels, optical flow, a recurrent state. This one answers it with a concatenation. Two adjacent frames go through the same frozen VGG-16, their feature maps are stacked channel-wise at two different depths, and a residual block is asked to work out what changed. It is the cheapest possible way to encode motion, and on four benchmarks it lands within a point of models doing far more. The interesting part is what the paper's own ablation and comparison tables say about which piece of it actually mattered.",

  results: [
    { label: "Hockey Fight", value: "98.8%", note: "±0.5, best reported, T3" },
    { label: "Feature fusion", value: "+4.4", note: "points over CNN+LSTM, T4" },
    { label: "WDRB", value: "+0.6", note: "the named contribution, T4" },
  ],

  review: {
    architecture: {
      family: "CNN-LSTM",
      backbone:
        "Two copies of VGG-16 pre-trained on ImageNet, weights frozen throughout. Both the pooling and the fully connected layers are detached; features are tapped at two depths instead. Only the two Wide-Dense Residual Blocks and the 512-unit LSTM are trained.",
      motionEncoding:
        "By concatenation, and nothing else. Two adjacent frames at t and t+1 are pushed through the frozen backbone and their feature maps are stacked along the channel axis at two depths -- low-level 224×224×64 each, becoming 224×224×128, and high-level 14×14×512 each, becoming 14×14×1024. A trainable residual block then has to infer displacement from the stacked pair. No optical flow, no 3D convolution, no frame differencing, no pose. The LSTM adds longer-range temporal structure on top of the per-pair spatial vector.",
      inputs: [
        "RGB frames at 224×224, normalised to 0-1, sampled equally spaced from each video to a maximum of 30 per clip (f_N = 30, intermediate frames skipped)",
        "The network's actual unit of input is a pair of adjacent sampled frames, not a clip",
      ],
      fusion:
        "Early and twice over. Equations 1 and 2 fuse across the frame pair at two depths; the paper defines the '+' operator in both as concatenation, not addition. The two fused paths are each learned by their own WDRB, flattened to 1024-unit fully connected layers, and those two vectors are concatenated into the spatial vector X_s that feeds the LSTM.",
      supervision:
        "Supervised binary classification, fight / no-fight, with sigmoid cross-entropy. Prediction is per frame pair; a video label is produced afterwards by accumulating consecutive same-class frame predictions past a threshold of 5.",
      notes: [
        "The paper names two contributions -- the multi-level fusion and the Wide-Dense Residual Block. Its own ablation (T4) attributes +4.4 points to the fusion and +0.6 to the WDRB, so the block the title leans on is the smaller half.",
        "The WDRB's filter counts are given twice and disagree. Section 3.1 says the first two layers hold 512 filters of 3×3 and the last 256 filters of 1×1; Section 4.2 and Figure 4a both say 256, 256, and 128. The figure and the implementation section agree with each other, so 256/256/128 is the likelier reading, but the paper never reconciles them.",
        "Section 3.1 calls the low-level layer the CNN's 'top' layer and the high-level layer its 'bottom' -- the reverse of the usual convention. The tensor shapes it quotes (224×224×64 and 14×14×512) make the intent unambiguous.",
        "Frame-level prediction is a real architectural consequence, not a framing device: because the unit of input is a frame pair rather than a clip, the model can flag a violent action lasting a fraction of a second, which clip-level models structurally cannot.",
        "The two fused paths are very unequal in size. The low-level tensor carries 224×224×128 ≈ 6.4 M values against the high-level path's 14×14×1024 ≈ 0.2 M -- a factor of 32 -- and a full residual block is run on the larger one. The paper never costs this.",
      ],
    },

    attention: {
      used: false,
      kinds: ["none"],
      notes: [
        "No attention of any kind. Across 17 pages the word appears exactly twice: 'continuous human attention' in the abstract, and the title of a cited paper in the reference list. There is no channel, spatial, temporal or self-attention in the proposed model, and none in the baselines it builds on.",
        "Note this against `src/data/papers.ts`, which had this paper filed as '2D CNN + Attention'. It is a CNN-LSTM with no attention at all; the entry has been corrected.",
        "Worth keeping as a baseline for the attention axis. The multi-level fusion is sometimes described as if it were a selection mechanism, but it selects nothing -- both depths are always concatenated, with fixed weights and no gating. A fixed architectural choice about which layers to tap is not attention.",
      ],
    },

    efficiency: {
      parameters: undefined,
      flops: undefined,
      modelSize: undefined,
      throughput: undefined,
      hardware:
        "Nvidia GTX Titan-X GPUs, Python and TensorFlow. No count of how many, and no timing measured on them.",
      realTime: {
        status: "not-addressed",
        note: "Real-time operation is never claimed and never measured. There is no inference time, frame rate or latency figure anywhere. The introduction motivates the work by the impossibility of continuous human monitoring but never connects that to a speed the system would have to hit.",
      },
      edgeDeployment: {
        status: "not-addressed",
        note: "No edge, embedded or on-camera deployment is discussed. The only hardware named is a desktop-class training GPU.",
      },
      notes: [
        "This paper reports no cost figures at all -- not parameters, not FLOPs, not model size, not throughput. It is the most complete efficiency blank among the papers reviewed so far, which makes it a useful marker for how routine that omission was in this literature.",
        "The one efficiency word in the paper is borrowed. Section 3.1 says the WDRB's 'widened convolutional layers ... results in computationally efficient performance', citing the Wide ResNet paper. That is a claim about somebody else's architecture; nothing in this paper measures the cost of this one.",
        "What can be said without the paper's help: the backbone is two frozen VGG-16 passes per frame pair, and VGG-16 is among the most expensive ImageNet backbones per inference. Whatever the WDRB saves, it is bolted onto that.",
        "Training cost is partly recorded -- 100 epochs per fold, batch of 5 videos at 30 frames each, Adam, gradient clipping, initial learning rate 1e-5 for three of the four datasets (T2). Nothing about inference.",
      ],
    },

    evaluation: {
      datasets: [
        {
          name: "Hockey Fight",
          role: "evaluation",
          note: "1000 clips from NHL matches, 500 fight and 500 non-fight, 360×280 at 25 fps, about 2 s each (T1). The paper's primary benchmark and the only one the ablation is run on.",
        },
        {
          name: "Movies",
          role: "evaluation",
          note: "200 clips, 100 fight from action films and 100 non-fight drawn from action-recognition sets such as UCF-101. 360×250, 25 fps for fights and 29.9 fps for non-fights (T1) -- the frame rate itself differs by class.",
        },
        {
          name: "Crowd Violence",
          role: "evaluation",
          note: "The Violent-Flows dataset. 246 YouTube clips of real crowd violence, 123 per class, 320×240, 1-6 s.",
        },
        {
          name: "BEHAVE",
          role: "evaluation",
          note: "A subset the authors cut themselves: 20 fight and 50 non-fight clips from each of four long videos, 280 clips total, 80 fight and 200 non-fight. 640×480. The only class-imbalanced dataset here, and the only one that gets stratified four-fold rather than five-fold cross-validation.",
        },
        {
          name: "ImageNet",
          role: "pre-training",
          note: "Source of the frozen VGG-16 weights. Never fine-tuned.",
        },
        {
          name: "UCF-101",
          role: "mentioned-only",
          note: "Named as where the Movies dataset's non-fight clips originally came from. No experiment is run on it.",
        },
      ],
      split:
        "Five-fold cross-validation on Hockey Fight, Movies and Crowd Violence -- each set cut into five random equal parts, four for training and one for testing. BEHAVE gets stratified four-fold instead, because of its class imbalance. There is no validation set on any of them.",
      metrics: [
        "Accuracy ± standard deviation across folds",
        "AUC",
        "Confusion matrices",
        "ROC curves",
      ],
      protocolNotes: [
        "There is no validation split anywhere, and the reported figure is the maximum test accuracy reached over 100 epochs. The paper states the method plainly: 'the network is trained for each of these four folds and maximum accuracy is obtained for each of the test folds', and 'the network parameters are selected on the basis of maximum test performance accuracy for each dataset'. Every headline number is a selected-best figure taken off the test set.",
        "The tuning that was done on test accuracy is documented rather than hidden, which makes it easy to check. The learning rate was chosen this way (T2 shows the sweep, with per-dataset winners), and so was the 5-frame aggregation threshold -- Figure 5's caption reads 'Threshold value selection for Hockey-Fight dataset based on maximum test accuracy'.",
        "The margins over prior work are smaller than the reported fold-to-fold spread in two of four cases. Crowd Violence: 97.1 ±1.7 against BiConvLSTM's 96.32 ±1.52. BEHAVE: 95.9 ±2.3 against VIPS's 95.73. On those datasets the ranking is not separable from the variance.",
        "On Movies the proposed model loses. ConvLSTM and BiConvLSTM both score 100 ±0%; this model scores 99.1 ±0.3%. Table 3 bolds the winners correctly, but the abstract and conclusion both claim 'superior performance' over the state of the art without qualification.",
        "Accuracy is reported at two granularities and they are not interchangeable. Frame-level accuracy is what the model natively produces; video-level accuracy is what T3 compares against prior work, and it is produced by the test-tuned 5-frame threshold sitting on top.",
        "The AUC values equal the accuracy figures to three significant digits on three of the four datasets -- 0.988/98.8%, 0.991/99.1%, 0.971/97.1% -- while BEHAVE's differ (0.953 against 95.9%). The paper does not comment on this.",
        "No precision, recall, F1 or per-class rate is reported anywhere. Confusion matrices are shown as figures (F10) but never reduced to numbers in the text, so nothing here can be compared on false-positive behaviour against the papers that do report specificity.",
        "No cross-dataset test. Every model is trained and tested within one dataset, and three of the four are curated media rather than surveillance footage: broadcast ice hockey, action films, and YouTube crowd clips. BEHAVE is staged, filmed by two fixed cameras.",
        "Data augmentation differs by dataset -- random 224×224 cropping, horizontal flipping and translation on three of them, but horizontal flipping alone on BEHAVE. That is a defensible choice for a small imbalanced set, and it also means the four columns of Table 3 are not quite the same experiment.",
      ],
    },
  },

  concepts: [
    {
      id: "frame-pair",
      title: "Motion, encoded by stacking two frames and hoping the network notices",
      tagline: "Fusion instead of flow",
      highlight: {
        label: "Input to the network",
        value: "2 frames",
        note: "t and t+1, concatenated by channel",
      },
      note: [
        "Almost every model in this collection has a dedicated mechanism for motion. 3D kernels that span several frames. A second stream fed pre-computed optical flow. A recurrent state carried across time. This paper has none of them, and that is the point of it.",
        "Both frames go through the same frozen VGG-16. The two resulting feature maps are then stacked along the channel axis -- 64 channels from frame t sitting next to 64 channels from frame t+1 -- and a trainable residual block is handed the result. Nothing in the pipeline computes displacement. The block has to learn that channel k and channel k+64 describe the same filter one frame apart, and that the difference between them is what the label depends on.",
        "The notation makes this easy to misread. Equations 1 and 2 are written C_L = F_L(t) + F_L(t+1), which looks like elementwise addition and would destroy exactly the information the model needs. The text defines it: 'the + operator represents the fusion of feature maps by concatenation'. The channel count doubles, it does not stay the same.",
        "The appeal is cost and simplicity -- no flow field to compute before inference, no third spatial dimension to convolve over. The cost is that motion is never represented explicitly anywhere, so there is nothing to inspect, and the paper reports no experiment isolating whether the network learned to use the pairing at all.",
      ],
      takeaways: [
        "No optical flow, no 3D convolution, no frame differencing. Motion enters only as two frames' features sitting in adjacent channels.",
        "The '+' in Equations 1 and 2 is concatenation, and the paper says so explicitly. Reading it as addition inverts what the model does.",
        "VGG-16 is frozen in both lanes. Only the residual blocks and the LSTM ever see a gradient.",
        "The pair is the unit of prediction, which is what lets the model label a violent action shorter than a clip.",
      ],
      visual: {
        kind: "two-stream-flow",
        options: {
          mode: "streams",
          hue: 95,
          labels: { rgb: "frame at time t", flow: "frame at time t+1" },
          copy: {
            chips: { rgb: "frame t", flow: "frame t+1", both: "the pair" },
            backbone: "frozen VGG-16",
            readout: "Hockey Fight accuracy",
            deltaLabel: "vs a single frame",
            lines: {
              rgb: "One frame through VGG-16. Appearance only -- a still image cannot show what moved.",
              flow: "The next frame, through the identical frozen network. On its own, no more informative than the first.",
              both: "The two feature maps are concatenated channel-wise, at two depths, and a residual block learns what changed between them.",
            },
          },
          // T3 p13. The paper never runs either frame alone, so those stay
          // undefined and the readout reports them as unmeasured.
          accuracy: { both: 98.8 },
        },
        caption:
          "Two lanes, one per frame of the pair, through the same frozen backbone and concatenated at the join. Select a single frame: the paper never measured that configuration, and the readout says so rather than inventing it.",
      },
      pdfPage: 5,
    },

    {
      id: "two-depths",
      title: "Fused twice, because the last layer has forgotten where things are",
      tagline: "Low-level and high-level",
      highlight: {
        label: "The two fused tensors",
        value: "224×224×128 and 14×14×1024",
        note: "32× apart in size",
      },
      note: [
        "Most CNN-plus-LSTM models take the backbone's last convolutional output and nothing else. That layer is semantically rich and spatially almost blind: VGG-16's conv5 output is 14×14, so each cell covers roughly a sixteenth of the frame in each direction. For deciding whether a scene contains a fight that may be enough. For deciding whether two people's arms moved between two frames it is not.",
        "So the fusion happens at two depths. The low-level tap is right after the first convolution, 224×224×64 per frame, at full spatial resolution -- edges, limbs, positions. The high-level tap is conv5, 14×14×512, carrying what the scene is rather than where. Each is concatenated across the frame pair, giving 224×224×128 and 14×14×1024, and each gets its own residual block. The two flattened results are concatenated into one spatial vector for the LSTM.",
        "Figure 2 is the argument, showing feature maps from both depths on samples of all four datasets: the low-level maps trace bodies, the high-level maps are abstract blobs. The claim is that a model with only the second is throwing away the localisation that a two-frame comparison depends on.",
        "The asymmetry is worth holding onto. The low-level tensor carries about 6.4 million values against the high-level path's 200 thousand -- a factor of 32 -- and the paper runs a full residual block over the larger one. Whatever this design costs, it is dominated by that branch, and the paper reports no cost figures at all.",
      ],
      takeaways: [
        "Low-level tap: 224×224×64 per frame, full resolution, detail and position. High-level tap: 14×14×512, semantics.",
        "Concatenation happens within each depth across the frame pair, not across depths. The depths only meet after their residual blocks, at the fully connected layers.",
        "The paper calls the low-level layer the network's 'top' and the high-level one its 'bottom', inverting the usual convention. The tensor shapes it quotes resolve the ambiguity.",
        "The WDRB's filter counts are stated twice and disagree -- 512/512/256 in Section 3.1 against 256/256/128 in Section 4.2 and Figure 4a. Two of the three sources agree on the smaller reading.",
      ],
      pdfPage: 5,
    },

    {
      id: "ablation",
      title: "The concatenation did the work; the block in the title added 0.6",
      tagline: "Reading the ablation",
      highlight: {
        label: "CNN+LSTM → +fusion → +WDRB",
        value: "93.8 → 98.2 → 98.8",
        note: "video-level, Hockey Fight, T4",
      },
      note: [
        "Table 4 is the most informative table in the paper, and it is four rows long. A plain CNN-plus-LSTM baseline reaches 93.8% at video level. Adding a residual block and the frame pair but no fusion gets 94.7%. Adding the multi-level feature fusion with an ordinary residual block gets 98.2%. Swapping that ordinary block for the proposed Wide-Dense Residual Block gets 98.8%.",
        "So of the 5.0 points between the baseline and the final model, the feature fusion accounts for about 4.4 and the WDRB for 0.6. The paper leads with two contributions and gives them equal billing; its own ablation does not.",
        "That is not a reason to dismiss the block -- 0.6 points is a real improvement, and the fusion is the more interesting idea anyway. It is a reason to read the title as describing the cheaper half of the design and the abstract's emphasis as marketing.",
        "The same table also shows the two granularities the paper works in. Frame-level accuracy is what the model natively produces, one prediction per frame pair; video-level accuracy is what gets compared to prior work, and it is always the higher of the two. The gap between them is the aggregation threshold doing its job -- five consecutive same-class predictions before the video is labelled -- which smooths away isolated frame errors.",
      ],
      takeaways: [
        "Feature fusion is worth roughly +4.4 points; the WDRB, the paper's named block, roughly +0.6.",
        "The CNN+RB+FC row is the useful control: frame pairs and a residual block but no fusion, and it barely beats the plain baseline at 94.7%.",
        "Video-level accuracy is always above frame-level here, by 0.9 to 2.2 points. That gap is manufactured by the aggregation threshold, not by the network.",
        "The ablation runs on Hockey Fight only. Nothing establishes that the same split of credit holds on the other three datasets.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          mode: "outcome",
          hue: 95,
          baselineId: "cnn-lstm",
          metricLabel: "Accuracy",
          datasetLabel: "Prediction level",
          // T4 p14, Hockey Fight. The paper reports no frame-level figure for
          // the plain CNN+LSTM baseline, so that cell stays empty.
          datasets: [
            { id: "video", label: "video-level", title: "After the 5-frame aggregation threshold" },
            { id: "frame", label: "frame-level", title: "One prediction per frame pair, what the model natively produces" },
          ],
          models: [
            {
              id: "cnn-lstm",
              label: "CNN + LSTM",
              metrics: { video: { accuracy: 93.8 } },
            },
            {
              id: "cnn-rb-fc",
              label: "CNN + RB + FC",
              metrics: {
                video: { accuracy: 94.7 },
                frame: { accuracy: 92.51 },
              },
            },
            {
              id: "cnn-ff-rb-lstm",
              label: "CNN + FF + RB + LSTM",
              metrics: {
                video: { accuracy: 98.2 },
                frame: { accuracy: 97.2 },
              },
            },
            {
              id: "proposed",
              label: "CNN + FF + WDRB + LSTM",
              metrics: {
                video: { accuracy: 98.8 },
                frame: { accuracy: 97.9 },
              },
            },
          ],
        },
        caption:
          "The paper's own ablation, Table 4. One bar per variant because this paper reports accuracy alone -- no sensitivity, no specificity. Switch to frame-level to see what the model produces before the aggregation threshold is applied.",
      },
      pdfPage: 14,
    },

    {
      id: "selected-best",
      title: "Every headline number is the best epoch, chosen on the test set",
      tagline: "No validation split",
      highlight: {
        label: "Reported figure",
        value: "max test accuracy",
        note: "over 100 epochs, per fold",
      },
      note: [
        "The protocol is stated openly, which is the only reason it can be checked. Each dataset is cut into folds, the network is trained for 100 epochs on each, and 'maximum accuracy is obtained for each of the test folds'. The mean and standard deviation reported in Table 3 are computed over those five maxima. There is no validation split on any dataset.",
        "The tuning follows the same path. The learning rate was picked by comparing test accuracy across a sweep -- Table 2 lists the winners per dataset. The 5-frame aggregation threshold was picked the same way, and Figure 5's caption says so: 'threshold value selection for Hockey-Fight dataset based on maximum test accuracy'. Three separate choices, all made against the numbers being reported.",
        "This does not make the model bad, and it was not unusual for 2020. It makes the headline figures selected-best rather than held-out, and it means the honest comparison with prior work is narrower than Table 3 suggests. On Crowd Violence the 0.78-point margin over BiConvLSTM sits inside a ±1.7 standard deviation; on BEHAVE the 0.17-point margin over VIPS sits inside ±2.3.",
        "On Movies it simply loses. ConvLSTM and BiConvLSTM both reach 100 ±0%; this model reaches 99.1 ±0.3%. Table 3 bolds the two winners correctly, so the table is honest — but the abstract and the conclusion both claim superior performance over the state of the art with no qualification attached.",
      ],
      takeaways: [
        "No validation set on any of the four datasets. The reported number is the best test epoch out of 100.",
        "Learning rate and aggregation threshold were both selected on test accuracy, and the paper documents both selections.",
        "Two of the four margins over prior work are smaller than the paper's own fold-to-fold standard deviation.",
        "It is beaten on Movies by both of the CNN-LSTM baselines it is closest to. The table shows it; the abstract does not.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          mode: "outcome",
          hue: 95,
          baselineId: "proposed",
          metricLabel: "Accuracy",
          // T3 p13. Cells the table leaves as a dash stay undefined -- those
          // methods were never run on that dataset.
          datasets: [
            { id: "hockey", label: "Hockey Fight", title: "1000 clips, five-fold" },
            { id: "movies", label: "Movies", title: "200 clips, five-fold" },
            { id: "crowd", label: "Crowd Violence", title: "246 clips, five-fold" },
            { id: "behave", label: "BEHAVE", title: "280 clips, stratified four-fold" },
          ],
          models: [
            {
              id: "mosift-kde-sc",
              label: "MoSIFT+KDE+SC",
              metrics: {
                hockey: { accuracy: 94.3, accuracySd: 1.68 },
                crowd: { accuracy: 89.05, accuracySd: 3.26 },
                behave: { accuracy: 87.07, accuracySd: 0.13 },
              },
            },
            {
              id: "moi-wld",
              label: "MoI-WLD",
              metrics: {
                hockey: { accuracy: 96.8, accuracySd: 1.04 },
                crowd: { accuracy: 93.19, accuracySd: 0.12 },
                behave: { accuracy: 88.83, accuracySd: 0.11 },
              },
            },
            {
              id: "convlstm",
              label: "ConvLSTM",
              metrics: {
                hockey: { accuracy: 97.1, accuracySd: 0.55 },
                movies: { accuracy: 100, accuracySd: 0 },
                crowd: { accuracy: 94.57, accuracySd: 2.34 },
              },
            },
            {
              id: "biconvlstm",
              label: "BiConvLSTM",
              metrics: {
                hockey: { accuracy: 97.9, accuracySd: 0.55 },
                movies: { accuracy: 100, accuracySd: 0 },
                crowd: { accuracy: 96.32, accuracySd: 1.52 },
              },
            },
            {
              id: "proposed",
              label: "Proposed",
              metrics: {
                hockey: { accuracy: 98.8, accuracySd: 0.5 },
                movies: { accuracy: 99.1, accuracySd: 0.3 },
                crowd: { accuracy: 97.1, accuracySd: 1.7 },
                behave: { accuracy: 95.9, accuracySd: 2.3 },
              },
            },
          ],
        },
        caption:
          "Five rows of Table 3, with the whiskers showing each method's spread across folds. Switch to Movies to see the two baselines at a clean 100%, and to Crowd Violence and BEHAVE to see margins narrower than the whiskers that carry them.",
      },
      pdfPage: 13,
    },
  ],
};
