import type { StudyModule } from "@/types/study";

/**
 * Sernani, Falcionelli, Tomassini, Contardo & Dragoni (2021), "Deep Learning for
 * Automatic Violence Detection: Tests on the AIRTLab Dataset".
 * IEEE Access 9:160580-160595. DOI 10.1109/ACCESS.2021.3131315.
 *
 * Every figure quoted here comes from the paper's own tables, which are set as
 * images rather than text -- they were read off the rendered pages, not the
 * abstract. Where the tables and the prose disagree, both are recorded.
 *
 * Table map, for anyone checking the numbers against the PDF (physical pages):
 *   T1  p3   related work, Hockey + Crowd     T13 p10  mean metrics, Crowd Violence
 *   T2  p5   C3D layers used as extractor     T14 p11  2D CNN + Bi-LSTM, AIRTLab
 *   T3  p6   model 2 layers (C3D + FC)        T15 p11  2D CNN + ConvLSTM, AIRTLab
 *   T4  p6   model 3 layers (ConvLSTM)        T16 p11  2D CNN + Bi-LSTM, Hockey
 *   T5  p7   2D CNN + ConvLSTM template       T17 p12  2D CNN + ConvLSTM, Hockey
 *   T6  p7   2D CNN + Bi-LSTM template        T18 p12  2D CNN + Bi-LSTM, Crowd
 *   T7  p7   epochs per split, AIRTLab        T19 p12  2D CNN + ConvLSTM, Crowd
 *   T8  p8   C3D+SVM per split, AIRTLab       T20-23 p13-14  Hockey per split
 *   T9  p8   C3D+FC per split, AIRTLab        T24-27 p14-16  Crowd per split
 *   T10 p8   ConvLSTM per split, AIRTLab
 *   T11 p9   mean metrics, AIRTLab            F2 p6 the three models
 *   T12 p10  mean metrics, Hockey Fight       F4 p9 ROC curves
 */
export const moduleAirtlab: StudyModule = {
  slug: "airtlab-deep-learning",

  premise:
    "Most violence detection papers propose an architecture. This one proposes a dataset, and runs three existing architectures through it to prove the dataset is hard in the way it claims. AIRTLab's non-violent clips are hugs, high fives, claps and celebrations -- fast, contact-heavy, and easy to mistake for a fight -- so the number that matters is not accuracy but specificity. Three classifiers share one input format, a 16-frame chunk at 112×112: C3D frozen with a linear SVM on top, the same C3D with two dense layers instead, and a ConvLSTM trained from scratch. All three are then run on Hockey Fight and Crowd Violence too, which is where the ranking falls apart.",

  results: [
    { label: "AIRTLab", value: "97.15%", note: "ConvLSTM, best of three, T11" },
    { label: "Crowd Violence", value: "84.19%", note: "same model, worst of three, T13" },
    { label: "Answer-always-violent", value: "67.23%", note: "two baselines score exactly this, T14" },
  ],

  review: {
    architecture: {
      family: "3D CNN",
      backbone:
        "C3D (Tran et al., trained on Sports-1M), truncated at its first fully connected layer 'fc6'. Eight 3D convolutions, five pooling layers, one 4096-unit dense layer: 61,214,464 weights, frozen in both transfer models. The third model has no backbone at all -- a single ConvLSTM2D layer, 64 filters of 3×3, trained from scratch.",
      motionEncoding:
        "Two mechanisms compared head to head rather than combined. In the C3D models, 3×3×3 kernels with stride 1 span three adjacent frames at a time, so motion is folded into the feature map before any classifier sees it. In the third model, a ConvLSTM carries a convolutional hidden state across the 16 frames, so motion lives in a recurrent state instead of in the kernel's extent. Both read the same 16×112×112 chunk. Neither computes optical flow, and no pose, skeleton or detection stage exists anywhere.",
      inputs: [
        "RGB, 16 consecutive frames per chunk, resized to 112×112 -- the C3D models and the from-scratch ConvLSTM",
        "RGB, 16 consecutive frames per chunk, resized to 224×224 -- the ten 2D CNN comparison models, because 112×112 'led to a significantly lower accuracy' for them (p7)",
      ],
      fusion:
        "None. The three models are alternatives, not components. Nothing is ensembled, no scores are combined, and each is trained and evaluated on its own.",
      supervision:
        "Supervised binary classification per 16-frame chunk, violent / non-violent. Clip-level labels are inherited by every chunk cut from the clip; there is no chunk-level annotation and no clip-level aggregation at inference.",
      notes: [
        "The named contribution is the dataset, not a model. The paper says so plainly: 'rather than proposing novel recognition architectures and models, we want to validate that the proposed dataset is capable of challenging the robustness to false positives' (p2). Read the three models as instruments, not proposals.",
        "The paper's own family labels split across two axes of this review: two models are 3D CNN, one is a CNN-LSTM, and the ten comparison models are 2D CNN plus a recurrent module. It is one of the few papers here that measures the boundary between those families on identical data.",
        "The ConvLSTM model's name is misleading about where its capacity sits. Its recurrent layer holds 154,624 weights. The dense layer immediately after it holds 198,246,656 -- 99.92% of the model -- because the 110×110×64 recurrent output is flattened to 774,400 values without any pooling first (T4).",
        "Both transfer models tap 'fc6' rather than 'fc7'. The paper notes that Ullah et al., who used fc7, scored slightly lower on the same benchmarks (p10), but nothing here isolates that variable.",
      ],
    },

    attention: {
      used: false,
      kinds: ["none"],
      notes: [
        "No attention of any kind, in any of the thirteen models. The word does not appear in the paper -- not in the proposed models, not in Related Works, not as future work.",
        "That makes this a clean baseline row for the attention axis. Three architectures, one dataset, no attention anywhere: whatever a CBAM or self-attention paper claims to add can be read against the specificity these plain models reach.",
        "The closest thing to a selection mechanism is the fixed 16-frame chunking, which is a hand-set input format applied before training rather than anything the model learns. That is not attention.",
      ],
    },

    efficiency: {
      parameters:
        "C3D + SVM: 61.2 M frozen, none trained. C3D + FC: 61.2 M frozen plus 2,098,177 trained. ConvLSTM: 198,401,537, all trained from scratch (T2, T3, T4).",
      flops: undefined,
      modelSize: undefined,
      throughput: undefined,
      hardware:
        "Google Colab with the GPU runtime; the specific accelerator is never named. Keras 2.4.3, TensorFlow 2.4.1, scikit-learn 0.22.2.post1 (p7).",
      realTime: {
        status: "not-addressed",
        note: "Real-time operation is never claimed and never measured. There is no inference time, no frame rate, no latency figure anywhere in sixteen pages. The introduction motivates the work by the cost of humans watching footage, but the paper does not connect that to any speed requirement.",
      },
      edgeDeployment: {
        status: "not-addressed",
        note: "No edge, embedded, on-camera or mobile deployment is discussed. NASNet Mobile appears in the comparison set, but purely as an ImageNet-pretrained backbone -- its mobile design is never the reason it is chosen and its footprint is never reported.",
      },
      notes: [
        "The only cost figures in the paper are parameter counts and training epochs. Nothing measures what any model costs to run, which is the axis a surveillance deployment would be decided on.",
        "Training effort is reported and is revealing: on AIRTLab the C3D + FC model needed 23.4 ± 4.03 epochs against the ConvLSTM's 9.4 ± 3.07, batch size 32 against 8 (T7, p7). The from-scratch model converges faster because it is fitting a much smaller dataset with far more capacity.",
        "The 198 M-parameter ConvLSTM is roughly three times the size of the frozen C3D backbone it is being compared against, and 95 times the number of weights the C3D + FC model actually trains. The paper never remarks on this.",
        "C3D + SVM has an efficiency property the paper does not name: with the backbone frozen, fc6 features can be extracted once and cached, and refitting the classifier is then a linear SVM fit on 4096-dimensional vectors. It is by far the cheapest of the three to retrain, and the only one that never backpropagates.",
      ],
    },

    evaluation: {
      datasets: [
        {
          name: "AIRTLab",
          role: "evaluation",
          note: "Introduced here. 350 MP4 clips, 1920×1080 at 30 fps, mean 5.63 s (2-14 s), yielding 3537 16-frame chunks. 230 violent clips and 120 non-violent, all staged in one room by 2-4 non-professional actors, shot simultaneously by two fixed cameras. The non-violent half is the point: hugs, high fives, clapping, celebrating, gesticulating.",
        },
        {
          name: "Hockey Fight",
          role: "evaluation",
          note: "1000 clips, 41-50 frames each at 320×240, 2007 chunks. All from hockey arenas.",
        },
        {
          name: "Crowd Violence",
          role: "evaluation",
          note: "246 YouTube clips at 320×240, mean 3.6 s, 1265 chunks -- the smallest of the three, and the one the from-scratch ConvLSTM fails on.",
        },
        {
          name: "Sports-1M",
          role: "pre-training",
          note: "Where C3D's frozen weights come from. Sport-category classification, never re-trained here.",
        },
        {
          name: "ImageNet",
          role: "pre-training",
          note: "Weights for the ten 2D CNN comparison models (VGG16, VGG19, ResNet50V2, Xception, NASNet Mobile).",
        },
        {
          name: "Movies",
          role: "mentioned-only",
          note: "Described in Related Works and dismissed -- 'most of the recent studies achieved 100% accuracy on it'. No experiment is run.",
        },
        {
          name: "RWF-2000",
          role: "mentioned-only",
          note: "Named as the other recent dataset that addresses the same limitations AIRTLab addresses. No experiment is run, and no result is reported on it.",
        },
      ],
      split:
        "Stratified shuffle split, an 80-20 train/test split randomised five times, identical splits for every model. On AIRTLab that is 2829 training and 708 test chunks per split. For the two end-to-end models a further 12.5% of the training data (10% of the whole) is held out as validation for early stopping -- 5 epochs without improvement, best weights restored.",
      metrics: [
        "Sensitivity",
        "Specificity",
        "Accuracy",
        "F1 score",
        "AUC",
        "Binary cross-entropy loss (end-to-end models only)",
      ],
      protocolNotes: [
        "The split is over chunks, not clips. 3537 chunks are drawn from 350 clips and then shuffled, so chunks cut from the same clip land in both the training and the test set. The paper never raises this, and it inflates every AIRTLab, Hockey Fight and Crowd Violence figure in the paper by an unmeasured amount.",
        "It is worse than ordinary chunk leakage on AIRTLab specifically. Every action was filmed twice, by cam1 and cam2 simultaneously -- 'the same non-violent behaviours in non-violent/cam1, but recorded from a different point of view'. A second angle on a test action is very likely sitting in the training set.",
        "Metrics are reported per chunk, not per clip. No result in this paper describes classifying a video. The paper concedes the gap itself (p13): full-length footage 'might result in too many false positives' and would need consecutive positive chunks merged before use, a strategy it names but never evaluates.",
        "Validation and test are properly separate here, which is worth noting because it is not universal in this collection -- early stopping uses a slice of the training data, not the reported test split.",
        "Reporting sensitivity and specificity separately, over five splits, with standard deviations, is the strongest evaluation protocol among the papers reviewed so far. It is what makes the false-positive story legible at all.",
        "Class balance is not adjusted for. AIRTLab's test split is 476 violent and 232 non-violent chunks, so answering 'violent' every time scores 67.23% accuracy and 80.41% F1. Two comparison models do exactly that and post exactly those numbers (T14).",
        "None of the footage is real violence. AIRTLab is staged by non-professional actors in a single room under natural light with two fixed cameras; Hockey Fight is broadcast sport; Crowd Violence is scraped YouTube. The authors state the limitation directly. Nothing here is operational CCTV, and there is no cross-dataset test -- every model is trained and tested within one dataset.",
        "The paper's prose reports the 2D CNN failures incompletely. Page 11 says 'the one using ResNet50V2 completely fails the training on the AIRTLab dataset', naming one model. T14 shows Xception + Bi-LSTM failing identically -- 100.00% sensitivity, 0.00% specificity, 67.23% accuracy -- and it goes unmentioned.",
        "The abstract's claim that '3D models get better accuracy performance than time distributed 2D CNNs' is broader than the tables support. On AIRTLab, C3D + FC ties VGG16 + ConvLSTM at 95.62%; on Hockey Fight, VGG16 + ConvLSTM's 97.31% beats two of the three proposed models. The body text concedes both points; the abstract does not.",
      ],
    },
  },

  concepts: [
    {
      id: "chunks",
      title: "Every number in this paper describes 16 frames, not a video",
      tagline: "The unit of decision",
      highlight: {
        label: "AIRTLab",
        value: "350 clips → 3537 chunks",
        note: "2829 train / 708 test per split",
      },
      note: [
        "C3D takes exactly 16 frames at 112×112. That is not a tuning choice here -- it is inherited from the pre-trained network, and the paper keeps it for all three models so the comparison is fair. Every clip is therefore cut into consecutive 16-frame chunks, each one labelled with whatever its parent clip was labelled, and each one classified on its own.",
        "So the 97% in this paper is not 'the model identifies violent videos 97% of the time'. It is 'the model labels half a second of footage correctly 97% of the time'. A five-second AIRTLab clip is about ten independent decisions, and nothing in the paper combines them back into one.",
        "The authors see the gap and say so. On full-length footage, evaluating short sub-sequences 'might result in too many false positives, interfering in practical uses'; their suggested fix is to fire only when a fixed number of consecutive chunks come back positive. They propose it and do not test it.",
        "There is a second consequence, and this one the paper does not raise. The 80-20 split is randomised over the 3537 chunks, not over the 350 clips. Chunks from the same clip end up on both sides of the split. And because every AIRTLab action was filmed simultaneously by two cameras, a second view of a test action is probably in the training set as well. Every AIRTLab figure below is inflated by some amount nobody has measured.",
      ],
      takeaways: [
        "16 frames at 112×112 is fixed by C3D's pre-trained input shape, and applied to the from-scratch ConvLSTM too so the three models stay comparable.",
        "Labels propagate from clip to chunk. A calm second inside a violent clip is still labelled violent.",
        "No clip-level aggregation exists anywhere in the paper, at training or at inference.",
        "The cross-validation shuffles chunks, so the test set contains near-neighbours of training samples -- same clip, and often the same action from the second camera.",
      ],
      visual: {
        kind: "volume-grid",
        options: {
          mode: "kernel",
          interactive: true,
          // C3D's kernels are 3x3x3 with stride 1 throughout (T2, p5).
          size: [7, 5, 8],
          kernel: [3, 3, 3],
          hue: 160,
          speed: 0.5,
        },
        caption:
          "One chunk as a volume: width and height across, the 16 frames running into the screen. Switch the kernel between 2D and 3D to see how much of the time axis a single C3D kernel actually covers.",
      },
      pdfPage: 7,
    },

    {
      id: "three-heads",
      title: "One frozen backbone, three different things bolted to its output",
      tagline: "What actually trains",
      highlight: {
        label: "Trained weights",
        value: "0 · 2.1 M · 198.4 M",
        note: "SVM, dense head, ConvLSTM from scratch",
      },
      note: [
        "The three models are usually described by their names, which hides how little they differ at the front and how much they differ at the back. Two of them share the identical frozen C3D stack -- 61,214,464 weights from Sports-1M, never updated -- and disagree only about what reads the 4096-value vector that comes out of fc6.",
        "The first reads it with a linear SVM, C = 1. Nothing deep is trained at all: the features are extracted once and a convex classifier is fitted on them. The second reads it with a dense layer of 512 ReLU units and a sigmoid, dropout 0.5 on either side, training 2,098,177 weights. Same features, same information, different decision boundary.",
        "The third shares nothing. It is a ConvLSTM2D layer of 64 3×3 filters trained from scratch, and its name is doing a lot of work: the recurrent layer holds 154,624 weights, which is 0.08% of the model. Its 110×110×64 output is flattened to 774,400 values with no pooling, and the dense layer that consumes them holds 198,246,656. Nearly all of this model is one fully connected layer.",
        "That framing matters for reading the results. The comparison is not really '3D convolution versus recurrence'. It is 'a frozen general-purpose feature extractor with a small head' versus 'a very large model fitted to 2829 training chunks'.",
      ],
      takeaways: [
        "C3D to fc6: 61.2 M weights, frozen in both transfer models, taken from Sports-1M sport classification.",
        "C3D + SVM trains no deep weights. Features can be cached and the classifier refitted in seconds.",
        "C3D + FC trains 2,098,177 weights -- 3% of the network it sits on.",
        "The ConvLSTM model is 198.4 M weights, 99.92% of them in the dense layer after an unpooled flatten, not in the recurrent layer its name advertises.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          mode: "architecture",
          hue: 160,
          baselineId: "c3d-svm",
          // Layer tables T2 (p5), T3 and T4 (p6). Dropout layers hold no weights
          // and are left out; both end-to-end models use 0.5 dropout throughout.
          models: [
            {
              id: "c3d-svm",
              label: "C3D + SVM",
              emptyNote: "no deep weights trained",
              blocks: [
                {
                  label: "C3D → fc6",
                  params: 61214464,
                  trained: false,
                  note: "8 conv3D + 5 pool + one 4096-unit dense, Sports-1M weights",
                },
                {
                  label: "linear SVM",
                  params: 0,
                  trained: true,
                  note: "C = 1, fitted on the 4096-value fc6 vector",
                },
              ],
            },
            {
              id: "c3d-fc",
              label: "C3D + FC",
              blocks: [
                {
                  label: "C3D → fc6",
                  params: 61214464,
                  trained: false,
                  note: "identical frozen stack, same Sports-1M weights",
                },
                { label: "dense 512", params: 2097664, trained: true, note: "ReLU" },
                { label: "dense 1", params: 513, trained: true, note: "sigmoid" },
              ],
            },
            {
              id: "convlstm",
              label: "ConvLSTM",
              blocks: [
                {
                  label: "ConvLSTM2D",
                  params: 154624,
                  trained: true,
                  note: "64 filters of 3×3, output 110×110×64, never pooled",
                },
                {
                  label: "dense 256",
                  params: 198246656,
                  trained: true,
                  note: "fed a flattened 774,400-value vector",
                },
                { label: "dense 1", params: 257, trained: true, note: "sigmoid" },
              ],
            },
          ],
        },
        caption:
          "One lane per model, blocks scaled by weight count on a log axis -- the counts span five orders of magnitude. Pale outlined blocks are frozen. Hover any block for its exact parameter count.",
      },
      pdfPage: 6,
    },

    {
      id: "false-positives",
      title: "AIRTLab is built so non-violent looks violent, and every model falls for it",
      tagline: "Specificity, not accuracy",
      highlight: {
        label: "C3D + FC on AIRTLab",
        value: "97.82% / 91.12%",
        note: "sensitivity against specificity",
      },
      note: [
        "The dataset exists to make one point. Its non-violent half is not people standing still -- it is hugging, high fives, clapping, celebrating and gesticulating, performed by the same actors in the same room as the fights, at the same speed and with the same physical contact. If a detector is keying on rapid motion and bodies touching, this is where it shows.",
        "It shows in every model. Sensitivity beats specificity across the board: 97.06 against 94.14 for C3D + SVM, 97.82 against 91.12 for C3D + FC, 98.28 against 94.83 for the ConvLSTM. All the errors that matter are in one direction. In one split, C3D + FC returned 28 false positives out of 232 non-violent chunks while missing only 6 of 476 violent ones.",
        "Ranking the three by accuracy puts the ConvLSTM first at 97.15%. Ranking by the gap between the two rates puts C3D + SVM first, at 2.92 points against C3D + FC's 6.70. For an alarm that a human has to answer, the second ranking is the one that decides whether the system gets switched off.",
        "There is a wrinkle in the ConvLSTM's numbers that the mean hides. Its specificity carries a standard deviation of 3.37 points across the five splits, against 1.51 for C3D + SVM. The paper reads this as the model 'having too many parameters given the amount of training data' -- it is stable on some splits and not others, which is a different failure from being consistently mediocre.",
      ],
      takeaways: [
        "Specificity is below sensitivity for all three models. The dataset was designed to produce exactly that, and it did.",
        "Accuracy alone reverses the ranking you would pick for deployment: the most accurate model is not the most balanced one.",
        "C3D + SVM has both the smallest gap (2.92 points) and the steadiest specificity across splits (±1.51).",
        "The AUCs are nearly identical -- 99.30, 98.94, 99.67 -- so the three models separate the classes about equally well. The differences are in where the threshold lands, not in the ranking quality.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          mode: "outcome",
          hue: 160,
          baselineId: "c3d-svm",
          // T11, p9. Means over the five stratified shuffle splits.
          datasets: [
            {
              id: "airtlab",
              label: "AIRTLab",
              title: "350 staged Full HD clips, 3537 chunks",
              floor: 67.23,
              floorLabel: "answer 'violent' every time",
            },
          ],
          models: [
            {
              id: "c3d-svm",
              label: "C3D + SVM",
              metrics: {
                airtlab: { sensitivity: 97.06, specificity: 94.14, accuracy: 96.1 },
              },
            },
            {
              id: "c3d-fc",
              label: "C3D + FC",
              metrics: {
                airtlab: { sensitivity: 97.82, specificity: 91.12, accuracy: 95.62 },
              },
            },
            {
              id: "convlstm",
              label: "ConvLSTM",
              metrics: {
                airtlab: { sensitivity: 98.28, specificity: 94.83, accuracy: 97.15 },
              },
            },
          ],
        },
        caption:
          "Two bars per model: sensitivity above, specificity below, both from a true zero. The red segment is the distance between them -- the recall on violent chunks that the model does not match on non-violent ones. The grey plane marks 67.23%, what answering 'violent' every time scores on this test split.",
      },
      pdfPage: 9,
    },

    {
      id: "generalisation",
      title: "The model that wins the benchmark is the one that travels worst",
      tagline: "Transfer versus from scratch",
      highlight: {
        label: "ConvLSTM, AIRTLab → Crowd Violence",
        value: "97.15% → 84.19%",
        note: "specificity 94.83% → 69.16%",
      },
      note: [
        "Run the same three models on Hockey Fight and Crowd Violence and the ordering from the previous concept does not survive. The ConvLSTM, best on AIRTLab, is last on both of the others -- 96.57% on Hockey Fight and 84.19% on Crowd Violence, where its specificity collapses to 69.16% with a standard deviation of 15.15 points. It is barely a classifier on that dataset; on some splits it is close to answering 'violent' by default.",
        "C3D + SVM does the opposite. It never wins by much and never loses: 96.10, 97.86, 99.60 across the three datasets, with test-set losses low and split-to-split variance small. It is the only model in the paper whose behaviour you could predict on a fourth dataset.",
        "The mechanism is not mysterious. Crowd Violence is the smallest set here -- 1265 chunks, roughly 1012 for training -- and the ConvLSTM is fitting 198 million parameters to it from random initialisation. The two C3D models are fitting 2.1 million or zero on top of features already learned from a million sport videos. Small dataset, huge model, no prior: the paper's own reading, and the tables support it.",
        "This is the argument for transfer learning stated as a measurement rather than an assumption, and it is worth carrying into every other paper here. A from-scratch model tuned on one benchmark can top the leaderboard on that benchmark and tell you almost nothing about what it will do elsewhere.",
      ],
      takeaways: [
        "Accuracy across AIRTLab / Hockey / Crowd -- C3D + SVM: 96.10, 97.86, 99.60. C3D + FC: 95.62, 96.67, 99.05. ConvLSTM: 97.15, 96.57, 84.19.",
        "The from-scratch model is the only one whose ranking changes with the dataset, and it changes from first to last.",
        "On Hockey Fight, C3D + SVM's specificity (97.90%) slightly exceeds its sensitivity -- that dataset was not built to provoke false positives, and the pattern from AIRTLab disappears.",
        "Test-set loss tracks the story: the ConvLSTM's 0.3535 on Crowd Violence against 0.0356 for C3D + FC on the same data.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          mode: "outcome",
          hue: 160,
          baselineId: "c3d-svm",
          // T11 p9, T12 p10, T13 p10. Only AIRTLab's majority-class floor can be
          // computed from figures the paper gives (476 violent of 708 chunks).
          datasets: [
            { id: "airtlab", label: "AIRTLab", title: "350 staged clips, 3537 chunks", floor: 67.23, floorLabel: "answer 'violent' every time" },
            { id: "hockey", label: "Hockey Fight", title: "1000 clips, 2007 chunks" },
            { id: "crowd", label: "Crowd Violence", title: "246 clips, 1265 chunks" },
          ],
          models: [
            {
              id: "c3d-svm",
              label: "C3D + SVM",
              metrics: {
                airtlab: { sensitivity: 97.06, specificity: 94.14, accuracy: 96.1 },
                hockey: { sensitivity: 97.82, specificity: 97.9, accuracy: 97.86 },
                crowd: { sensitivity: 100, specificity: 99.07, accuracy: 99.6 },
              },
            },
            {
              id: "c3d-fc",
              label: "C3D + FC",
              metrics: {
                airtlab: { sensitivity: 97.82, specificity: 91.12, accuracy: 95.62 },
                hockey: { sensitivity: 96.93, specificity: 96.4, accuracy: 96.67 },
                crowd: { sensitivity: 99.59, specificity: 98.32, accuracy: 99.05 },
              },
            },
            {
              id: "convlstm",
              label: "ConvLSTM",
              metrics: {
                airtlab: { sensitivity: 98.28, specificity: 94.83, accuracy: 97.15 },
                hockey: { sensitivity: 96.44, specificity: 96.7, accuracy: 96.57 },
                crowd: { sensitivity: 95.21, specificity: 69.16, accuracy: 84.19 },
              },
            },
          ],
        },
        caption:
          "The same three models on all three datasets. Switch dataset and watch the ConvLSTM lane: on Crowd Violence its specificity bar falls away while its sensitivity barely moves, which is what a model answering 'violent' by default looks like.",
      },
      pdfPage: 10,
    },

    {
      id: "floor",
      title: "Two baselines never predict 'non-violent' at all, and the paper names only one",
      tagline: "Reading a results table",
      highlight: {
        label: "ResNet50V2 + Bi-LSTM",
        value: "67.23% accuracy",
        note: "0.00% specificity, 80.41% F1",
      },
      note: [
        "To show its three models were worth proposing, the paper also runs ten comparisons: five ImageNet backbones, each time-distributed over the 16 frames and topped with either a Bi-LSTM or a ConvLSTM. Most land where you would expect. Two do something else.",
        "ResNet50V2 + Bi-LSTM and Xception + Bi-LSTM both post 100.00% sensitivity and 0.00% specificity on AIRTLab, in every one of the five splits. They label every chunk violent. They never once say 'non-violent'. Their accuracy is 67.23%, which is exactly the proportion of violent chunks in the test split -- 476 of 708 -- so it is not a score at all, it is the class prior read back.",
        "Their F1 is 80.41%. A model that has learned nothing, with a confusion matrix that is one full column and one empty one, scores 80 on the metric most papers quote. That happens because F1 here is computed with the majority class as positive, so precision is the prior and recall is 1. It is the single clearest argument in this collection for reporting specificity next to sensitivity, which is exactly what this paper does.",
        "The paper's prose gets this partly wrong. Page 11 says 'the one using ResNet50V2 completely fails the training on the AIRTLab dataset', naming one model. Table 14 shows Xception + Bi-LSTM in the same row of failure, identical to the last decimal, and it goes unmentioned. The table is right; the sentence is incomplete. Read the tables.",
      ],
      takeaways: [
        "67.23% on AIRTLab is not a result. It is 476/708, the violent share of the test split, and it is the floor every number should be read against.",
        "F1 of 80.41% for a classifier that never predicts the negative class -- check which class a paper calls positive before trusting an F1.",
        "Two of the ten comparison models collapse this way; the paper's text names one. Table 14 has both.",
        "The best 2D model, VGG16 + ConvLSTM at 95.62%, exactly ties C3D + FC. The abstract's claim that 3D beats time-distributed 2D holds for the two better proposed models, not for all three.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          mode: "outcome",
          hue: 160,
          baselineId: "c3d-svm",
          // T14 and T15, p11. Five of the twelve AIRTLab rows, chosen to span the
          // range from the paper's best model down to the two that never predict
          // the negative class. Full tables on the linked page.
          datasets: [
            {
              id: "airtlab",
              label: "AIRTLab",
              title: "476 violent and 232 non-violent chunks per test split",
              floor: 67.23,
              floorLabel: "answer 'violent' every time",
            },
          ],
          models: [
            {
              id: "c3d-svm",
              label: "C3D + SVM",
              metrics: {
                airtlab: { sensitivity: 97.06, specificity: 94.14, accuracy: 96.1 },
              },
            },
            {
              id: "vgg16-convlstm",
              label: "VGG16 + ConvLSTM",
              metrics: {
                airtlab: { sensitivity: 97.48, specificity: 91.81, accuracy: 95.62 },
              },
            },
            {
              id: "nasnet-bilstm",
              label: "NASNet + Bi-LSTM",
              metrics: {
                airtlab: { sensitivity: 91.85, specificity: 64.48, accuracy: 82.88 },
              },
            },
            {
              id: "resnet50v2-bilstm",
              label: "ResNet50V2 + Bi-LSTM",
              metrics: {
                airtlab: { sensitivity: 100, specificity: 0, accuracy: 67.23 },
              },
            },
            {
              id: "xception-bilstm",
              label: "Xception + Bi-LSTM",
              metrics: {
                airtlab: { sensitivity: 100, specificity: 0, accuracy: 67.23 },
              },
            },
          ],
        },
        caption:
          "Five of the twelve AIRTLab rows in Tables 14 and 15, spanning the range. The bottom two lanes have no specificity bar at all: those models predict 'violent' for every chunk, and their accuracy sits exactly on the grey plane.",
      },
      pdfPage: 11,
    },
  ],
};
