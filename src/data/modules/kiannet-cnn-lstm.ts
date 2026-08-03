import type { StudyModule } from "@/types/study";

/**
 * Vosta & Yow (2024), "KianNet: A Violence Detection Model Using an
 * Attention-Based CNN-LSTM Structure". IEEE Access 12:2198-2209.
 * DOI 10.1109/ACCESS.2023.3339379. Published online 4 December 2023.
 *
 * Every number here is from the paper's own tables and figures. Where the text
 * contradicts a table or a figure -- and it does, four separate times -- both
 * readings are recorded.
 *
 * The paper's tables are raster images, not text, so each one below was read
 * off a rendered page rather than extracted. Figures 6 and 10 carry numbers
 * that appear nowhere else in the paper and are plotted without value labels;
 * anything taken from them is marked as read off the chart.
 *
 * Table and figure map (physical PDF pages, 1-based):
 *   F1  p2   Canada crime severity index    F9  p7   MHSA-ConvLSTM detail
 *   F2  p4   architecture overview          F10 p7   AUC vs number of heads
 *   F3  p5   detailed architecture          F11 p8   classification head
 *   F4  p5   video split into frames        T2  p8   dataset statistics
 *   F5  p5   the frame subtraction          F12 p8   UCF-Crime examples
 *   F6  p5   backbone params vs accuracy    T3  p9   UCF-Crime variants
 *   F7  p6   ResNet50 inner structure       F13 p9   RWF examples
 *   T1  p6   ResNet50 layer shapes          T4  p10  RWF comparison
 *   F8  p6   ConvLSTM operations            T5  p10  UCF-Crime comparison
 *                                           T6  p10  metric equations
 *                                           T7  p10  precision/recall on AllCat
 *                                           T8  p10  the ablation
 */
export const moduleKianNet: StudyModule = {
  slug: "kiannet-cnn-lstm",

  premise:
    "KianNet subtracts each frame from the next and throws the frames away. Only the difference images reach the network: an ImageNet-pretrained ResNet50, a ConvLSTM, an eight-head self-attention layer, and a second ConvLSTM. It reports 97.48% AUC on UCF-Crime binary and 96.21% accuracy on RWF, and attributes almost all of the first number to the attention module. The paper's own Figure 10 -- the figure drawn to justify eight heads -- never reaches 97.48%, peaks at a different head count, and puts the no-attention baseline nine points above where the ablation table puts it.",

  results: [
    { label: "UCF-Crime binary", value: "97.48%", note: "AUC, T5 — but see F10" },
    { label: "RWF-2000", value: "96.21%", note: "accuracy, T4" },
    { label: "UCF-Crime AllCat", value: "23.88%", note: "14-way accuracy, T8" },
  ],

  review: {
    architecture: {
      family: "CNN-LSTM",
      backbone:
        "ResNet50 pre-trained on ImageNet, taking 224×224×3 input to a 7×7×2048 feature map (T1 p6, F7 p6). Whether those weights are frozen or fine-tuned is never stated anywhere in the paper. The recurrent half is two ConvLSTM layers, each using 256 convolutional filters of 3×3 with stride 1 in all four gates, so each carries a 7×7×256 hidden state.",
      motionEncoding:
        "By frame differencing, done before the network and nowhere else. Twenty frames are sampled at equal intervals from the clip, each is subtracted from its successor, and only the resulting difference images are fed to ResNet50 -- the input tensor is (20, 224, 224, 3). The network never sees a raw frame, so appearance is present only as whatever survives subtraction. Longer-range temporal structure is then carried by the two ConvLSTMs' recurrent state. No optical flow, no 3D convolution, no pose.",
      inputs: [
        "Difference images at 224×224×3, formed by subtracting consecutive sampled frames (Section III-B, F5 p5)",
        "Twenty frames per clip, selected by a skipped_frames stride computed from the clip's own length, so the sampling interval varies with video duration",
        "No second stream, no raw-frame branch, no audio",
      ],
      fusion:
        "None. KianNet is a single stream end to end; the only place two things are combined is the concatenation of the eight attention heads inside the MHSA layer (Eq. 3), which is internal to the attention operator rather than a fusion of modalities or depths.",
      supervision:
        "Supervised video-level classification with a softmax over n_classes. Run four ways on UCF-Crime -- binary, 14-way (AllCat), 4-way (4MajCat), 4-way (NREF) -- and binary on RWF. The classification head is a 3D max-pool, a flatten to 46,080, then fully connected layers of 1000, 256, 10 and n_classes (F11 p8).",
      notes: [
        "Frame differencing discards static appearance, and the paper knows it: the future-work list proposes 'using the original image alongside the moving parts gained from the subtraction of frames to improve the feature extraction'. That is an admission that the current input is lossy, made after the results are reported.",
        "An ImageNet-pretrained backbone is being run on difference images, which are not natural images -- Figure 5 (p5) shows the subtraction output as a near-black frame with a few coloured smears. The paper argues at length that ImageNet pre-training 'provides the model with a strong foundation for learning relevant features from images, including those related to violence', and never tests whether that transfer survives the domain change. No from-scratch or randomly-initialised control is run.",
        "n_frames = 20 is confirmed twice over: Section III-B gives the input tensor as (20, 224, 224, 3), and Figure 11's flatten width of 46,080 equals 20 × 3 × 3 × 256 exactly.",
        "Twenty sampled frames yield nineteen difference images, not twenty. Figure 3 draws the pairing as (frame 1, frame 2), (frame 2, frame 3), … (frame n-1, frame n), which is nineteen pairs, while the stated input tensor has a leading dimension of 20. The paper never reconciles the two.",
        "The conclusion says the parameter count is high 'due to the use of two attention mechanisms in the model's architecture'. The architecture section describes one MHSA layer. Either the sentence means the two ConvLSTMs, or it describes a model that is not the one in Figures 2, 3 and 9.",
        "Section III-E calls the pooling layer 'a 3D MaxPooling layer of size (2×2)' -- a two-dimensional size for a three-dimensional operation. Figure 11 labels it (1, 2, 2), which is what actually takes 7×7 down to 3×3. The figure is right and the text is not.",
        "The named contribution is placement, not mechanism. Nothing in KianNet's MHSA differs from Vaswani et al.'s; the claim is that putting it between two ConvLSTM layers 'gives KianNet an edge over other architectures'. No experiment isolates the placement -- there is no variant with the MHSA before the first ConvLSTM, or after the second, or with two ConvLSTMs and no attention at all.",
      ],
    },

    attention: {
      used: true,
      kinds: ["self", "spatial"],
      mechanisms: [
        {
          name: "Multi-head self-attention, 8 heads (Vaswani-style scaled dot-product, Eqs. 1-3)",
          placement:
            "Between the two ConvLSTM layers, applied to the first ConvLSTM's 7×7×256 hidden state. Equation 1 reshapes that input to (n_row × n_column, n_channels), so the tokens are the 49 spatial positions of a single timestep and attention is computed across space within one frame. Figure 9 (p7) draws exactly this: one 7×7×256 tensor in, Q/K/V per head, concatenate, then the second ConvLSTM.",
          reportedEffect:
            "On UCF-Crime binary, T8 (p10) reports AUC rising 81.71 → 97.48 and accuracy 62.50 → 92.98 against ResNetConvLSTM. Also NREF 79.04 → 83.14 AUC, 4MajCat 73.88 → 88.91 AUC, AllCat 53.88 → 63.71 AUC. F10 (p7) reports the same binary comparison and disagrees: its no-attention line sits at roughly 91.1% AUC and its best with-attention point at roughly 96.4%, a gain of about 5 points rather than 15.8.",
        },
      ],
      notes: [
        "The attention is spatial, not temporal, despite the paper's framing. Equation 1's reshape drops the frame axis before Q, K and V are formed, so each head compares the 49 positions of one feature map against each other and never compares one timestep to another. All temporal modelling is done by the ConvLSTMs. The paper describes the module as identifying 'the most important features within each frame' and then tracking them 'across a series of frames' -- but the tracking is the second ConvLSTM's job, not the attention's.",
        "The stated design rationale is object count: eight heads so the model can 'concentrate on several objects, the same as the number of attention heads'. Nothing in the paper verifies that heads correspond to objects -- no attention map is visualised anywhere, on any frame, in a paper whose title is about attention.",
        "The ablation confounds three changes at once. T8 compares KianNet against ResNetConvLSTM, the authors' own earlier published model [8]; the ablation section notes 'a more powerful backbone network was used than in previous work'; and the added block is MHSA *plus a second ConvLSTM layer*. Attention, an extra recurrent layer, and a backbone change move together, and the whole difference is attributed to attention.",
        "CBAM is dismissed without being run. The paper says 'other methods like CBAM can be used in our model' and then argues from architecture rather than measurement that MHSA suits it better. Given that CBAM is the comparison point for several other papers in this review, the absence of that one-line experiment is worth recording.",
        "The head sweep is a hyperparameter search reported on the same metric as the headline result. F10 plots UCF-Crime binary AUC against h ∈ {1, 2, 4, 6, 8, 10} and h = 8 is chosen from it; there is no validation split anywhere in the paper, so the reported 97.48% is a selected-best figure.",
      ],
    },

    efficiency: {
      parameters:
        "Never stated as a number in the text or in any table. Figure 6 (p5) plots parameter counts as an unlabelled bar chart on a 1e8 axis; read off that chart, the ResNet50 configuration sits at roughly 0.71×10⁸ ≈ 71 M, against VGG19 ≈ 53 M, Xception ≈ 68 M, InceptionV3 ≈ 69 M, ResNet101 ≈ 90 M and ResNet152 ≈ 106 M. These are estimates read from bar heights, not reported values.",
      flops: undefined,
      modelSize: undefined,
      throughput: undefined,
      hardware:
        "Not reported. Section IV-C names Keras and the training configuration -- batch size 16, learning rate 1e-4, 50 epochs, glorot_uniform initialisation, RMSprop -- and no hardware at all. No GPU, no CPU, no machine.",
      realTime: {
        status: "not-addressed",
        note: "Real-time operation is never claimed for KianNet and never measured. There is no inference time, frame rate, latency or throughput figure anywhere in the paper. The introduction motivates the work by the impossibility of manual monitoring and by systems that 'can continuously monitor numerous feeds simultaneously', but that is offered as a property of automation in general, not as a measured property of this model.",
      },
      edgeDeployment: {
        status: "not-addressed",
        note: "No edge, embedded, on-camera or mobile deployment is discussed. The paper does concede the underlying problem in its future work: 'the number of training parameters is high due to the use of two attention mechanisms in the model's architecture. Therefore, we will work on designing a lightweight VD attention mechanism in our future work.' That is an explicit statement that KianNet is not lightweight -- a concession, not a claim, and unusual among the papers reviewed here.",
      },
      notes: [
        "Where the weight mass actually sits is computable from the paper's own figure and contradicts its own explanation. Figure 11's classification head flattens to 46,080 and feeds a 1000-unit fully connected layer; that single matrix is 46,080 × 1,000 ≈ 46 M weights, roughly two thirds of the ~71 M read off Figure 6. The conclusion blames the parameter count on attention. On the paper's own numbers the dense head dominates, and it grows linearly with n_frames.",
        "Figure 6 does not support the sentence it is cited for. The text says ResNet50 was chosen 'because of its higher accuracy with fewer parameters'; the chart shows ResNet50 with the third-highest parameter count of six, above VGG19, Xception and InceptionV3. The claim holds only against ResNet101 and ResNet152, which is what the surrounding paragraph actually argues.",
        "Figure 6's accuracy axis is also unexplained. Reading its bars gives ResNet50 ≈ 96% and ResNet101 ≈ 96%, essentially tied, but no accuracy in Table 8 is near 96% -- KianNet's binary accuracy there is 92.98%. Which UCF-Crime variant, and which metric, Figure 6 plots is never stated.",
        "The pre-processing is genuinely cheap and the paper never says so. Frame subtraction costs one pass over two images, against the optical-flow computation that the two-stream papers exclude from their reported speeds. This is the one real efficiency argument available to KianNet, and it is neither claimed nor measured.",
        "Both ConvLSTMs run 256 filters over a 7×7 map at every one of the 20 timesteps, and the second one runs after the attention layer. The recurrent cost is therefore paid twice per clip. No layer-wise cost breakdown appears in the paper.",
      ],
    },

    evaluation: {
      datasets: [
        {
          name: "UCF-Crime",
          role: "evaluation",
          note: "1900 surveillance videos across 13 crime categories plus normal, 60-600 s per clip, variable resolution (T2 p8). Used in four cuts (T3 p9): Binary (1900 videos, 950 anomalous / 950 normal), AllCat (700 videos, 50 from each of 14 categories), 4MajCat (600 videos, four 150-video super-categories) and NREF (300 videos: 30 road accident, 50 explosion, 70 fighting, 150 normal). 4MajCat and NREF are the authors' own re-cuts, introduced in their prior paper [8].",
        },
        {
          name: "RWF-2000",
          role: "evaluation",
          note: "Called 'RWF' throughout. 2000 real-world surveillance clips of 5 s each, variable resolution (T2 p8). Binary only, one number reported: 96.21% accuracy (T4 p10). No ablation, no AUC, no per-class figures.",
        },
        {
          name: "ImageNet",
          role: "pre-training",
          note: "Source of the ResNet50 weights. Whether they are then frozen or fine-tuned is not stated.",
        },
        {
          name: "Hockey Fight",
          role: "mentioned-only",
          note: "Its statistics appear in T2 (p8) alongside the datasets actually used, but no experiment is run on it. The paper explicitly declines it: 'in contrast to other datasets used in VD, such as HockeyFight, where data is collected in the same environments with many similar objects'.",
        },
        {
          name: "Movies",
          role: "mentioned-only",
          note: "Listed in T2 (p8) as 'Movie Fights', 200 clips. Never run.",
        },
        {
          name: "Crowd Violence",
          role: "mentioned-only",
          note: "Listed in T2 (p8), 246 clips. Never run.",
        },
        {
          name: "Sports-1M",
          role: "mentioned-only",
          note: "Named in Related Works as the dataset a cited 3D CNN was evaluated on. No experiment here.",
        },
      ],
      split:
        "Stated for RWF only: 80% training, 20% testing, single split. No split is stated for UCF-Crime or for any of its four variants -- not a ratio, not a fold count, not a protocol reference. There is no validation set anywhere in the paper, no cross-validation, and no repeated runs, so no result carries a spread.",
      metrics: ["AUC", "Accuracy", "Precision", "Recall", "F1-score"],
      protocolNotes: [
        "The UCF-Crime protocol is missing entirely. Every number in Tables 5, 7 and 8 -- including the 97.48% AUC in the abstract -- rests on a train/test split the paper never describes. Only RWF's 80/20 is given.",
        "Figure 10 contradicts the headline number, on both the value and the argument. The text says 'the blue line indicates the highest AUC value at 97.48% when h = 8'. The figure's y-axis tops out below 96.5%, so 97.48% is not plotted anywhere on it; its highest point is roughly 96.4% and it falls at h = 6, not h = 8. The figure that exists to justify eight heads shows six heads winning.",
        "The two no-attention baselines disagree by about nine points. T8 puts ResNetConvLSTM's UCF-Crime binary AUC at 81.71%; F10's 'No Attention' line sits at roughly 91.1%. The attention gain is +15.77 points on the first reading and about +5.3 on the second. The paper reports both and reconciles neither.",
        "Table 5's rows disagree with the paragraph describing them. The text says 'the MIL-C3D model proposed by Sultani et al. [9] gained 74% in AUC'; the table lists Sultani et al. [9] as 'SVM, 50' and puts 74 against Liu et al.'s PFMF. The text says Zhong et al. presented TSN on RGB and optical flow at 82% and 78%; the table lists TSN-OpticalFlow at 78.08 and the second row as C3D at 81.08, not TSN-RGB.",
        "The abstract's margin does check out against the paper's own table. 97.48% against the best competitor in T5, CLIP-TSA at 87.58%, is 9.90 points -- 'roughly 10 percent' as claimed. That margin applies to UCF-Crime AUC only; on RWF the margin over Violence 4D is 1.54 points.",
        "The two headline datasets are not compared on the same metric. RWF is compared on accuracy alone (T4) and UCF-Crime on AUC alone (T5), so neither table shows both, and the abstract quotes 97.48% AUC for UCF-Crime while T8 gives that configuration's accuracy as 92.98%.",
        "The multi-class result is close to failure and the abstract does not mention it. On AllCat, 14 balanced classes with a 7.1% chance floor, KianNet scores 23.88% accuracy against the baseline's 22.72% -- described as an improvement 'marginally from 22.72% to 23.88%'. T7's precision, recall and F1 on the same task are 24.23, 25 and 24.60.",
        "NREF is built in a way that makes it easier, and the paper says so approvingly: its normal clips are 'gained by the trimmed parts of the violent video, which has the same objects and backgrounds, which helps the model to be trained more accurately'. Drawing both classes from the same source videos removes the background shortcut in one direction and installs a same-scene prior in the other; it is not a harder test.",
        "No cross-dataset test. UCF-Crime and RWF are trained and tested independently, and nothing is transferred between them.",
        "No confusion matrix, ROC curve, per-class rate or false-positive rate is shown for any experiment. Precision and recall appear once, on AllCat only (T7), so the binary results -- the ones the paper leads with -- cannot be read for false-alarm behaviour at all.",
        "The reference numbering is unreliable, which makes the comparison tables hard to audit. T4 attributes Flow Gated Net to 'Cheng et al. [16]' while [16] is Chen et al. on CBAM for micro-expression recognition and RWF is [17]; the text credits 'Violence 4D [47]' while [47] is Nievas et al. on Hockey Fight and Violence 4D is [23]; the text attributes TSN results to 'Zhong et al. in [17]'. Page 4 also carries two unrendered LaTeX citation commands -- '(citejoo2022clip,zhang2021generative)' -- in the published version.",
        "Both datasets are real surveillance footage, which is the paper's strongest methodological choice and it argues for it explicitly. UCF-Crime and RWF were picked over Hockey Fight precisely because the latter is 'collected in the same environments with many similar objects'. Among the papers in this review that is an unusually deliberate rejection of the staged and broadcast benchmarks.",
      ],
    },
  },

  concepts: [
    {
      id: "frame-difference",
      title: "The network never sees a frame",
      tagline: "Motion by subtraction",
      highlight: {
        label: "What ResNet50 receives",
        value: "20 difference images",
        note: "no raw frames at all",
      },
      note: [
        "Most models in this collection feed a backbone the pixels and ask it to work out what moved. KianNet does the subtraction first. Twenty frames are sampled at equal intervals across the clip, each is subtracted from its successor, and the differences -- not the frames -- become the input tensor (20, 224, 224, 3). Everything that did not move is cancelled to near zero before a single convolution runs.",
        "Figure 5 shows what that looks like: two ordinary daylight surveillance frames on the left, and on the right a near-black image with a few coloured smears where two people are moving. The pavement, the parked cars, the building are all gone. So is any information about what the scene is.",
        "The appeal is that motion becomes explicit and almost free. There is no optical flow field to compute before inference, no third convolutional dimension, no second stream — one subtraction per pair. Compared with the two-stream papers, whose reported speeds usually exclude the cost of computing flow, this is the cheapest motion encoding in the review.",
        "The cost is that appearance is thrown away, and the paper concedes it in the future-work list: it proposes 'using the original image alongside the moving parts gained from the subtraction of frames to improve the feature extraction'. There is a second cost it does not concede. ResNet50 arrives pre-trained on ImageNet, and the paper spends a paragraph arguing that this gives it 'a strong foundation for learning relevant features'. Those features were learned on photographs. They are being applied to sparse difference maps, and no from-scratch control is run to show the transfer survives.",
      ],
      takeaways: [
        "Input is (20, 224, 224, 3) — twenty difference images, not twenty frames.",
        "No optical flow, no 3D convolution, no second stream. Subtraction is the whole motion mechanism.",
        "Static appearance is destroyed by construction. The paper's own future work proposes adding the raw frames back.",
        "An ImageNet backbone runs on near-black difference maps, with no experiment testing whether that pre-training still helps.",
      ],
      visual: {
        kind: "two-stream-flow",
        options: {
          mode: "streams",
          // The frames are subtracted, not combined: everything static cancels
          // and only the moving region survives into the backbone.
          join: "subtract",
          hue: 320,
          labels: { rgb: "frame at time t", flow: "frame at time t+1" },
          copy: {
            chips: { rgb: "frame t", flow: "frame t+1", both: "the difference" },
            backbone: "ImageNet ResNet50",
            readout: "RWF-2000 accuracy",
            deltaLabel: "vs a single frame",
            lines: {
              rgb: "One frame on its own. KianNet never sends this to the backbone — a still image shows appearance, and appearance is exactly what the design discards.",
              flow: "The next sampled frame. Also never sent on its own. Neither frame is an input to the network.",
              both: "Subtract one from the other. What survives is the moving region; the static scene cancels to near zero. This difference image is the only thing ResNet50 ever receives.",
            },
          },
          // T4 p10. The paper never runs either frame alone, and never runs
          // raw frames instead of differences, so those cells stay undefined
          // and the readout reports them as unmeasured.
          accuracy: { both: 96.21 },
        },
        caption:
          "Two lanes for the two frames of a pair, meeting at the subtraction. Select a single frame: the paper never measured that configuration — no raw-frame control exists anywhere in it — and the readout says so rather than inventing a number.",
      },
      pdfPage: 5,
    },

    {
      id: "attention-across-space",
      title: "The attention layer never looks across time",
      tagline: "49 tokens, one frame",
      highlight: {
        label: "What the 8 heads compare",
        value: "7 × 7 positions",
        note: "within a single timestep",
      },
      note: [
        "KianNet's contribution is a placement: multi-head self-attention sandwiched between two ConvLSTM layers. The first ConvLSTM produces a 7×7×256 hidden state per timestep, the MHSA re-weights it, and the second ConvLSTM runs over the re-weighted sequence. The stated reason is that a second recurrent pass lets the model 'revisit and further process the features prioritized by the previous attention layers'.",
        "What the attention actually attends over is worth being precise about, because the paper's prose and its equations point in different directions. Equation 1 reshapes the input to (n_row × n_column, n_channels) before forming Q, K and V. There is no frame axis in that reshape. The tokens are the 49 spatial positions of one feature map, so each head compares regions of a single frame against each other — this is spatial self-attention, applied per timestep. Figure 9 draws the same thing: one 7×7×256 tensor in, heads out, concatenate, then the ConvLSTM.",
        "So despite the paper's spatiotemporal framing, no attention weight ever connects timestep t to timestep t+1. All temporal modelling in KianNet is done by the two ConvLSTMs' recurrent state, exactly as it would be without the attention layer. The module selects where to look inside a frame; it does not select when.",
        "The design rationale given for eight heads is object count — heads are meant to correspond to the several people simultaneously involved in a fight. That is a testable claim, and it is not tested. No attention map is visualised on any frame anywhere in the paper, and no experiment checks whether heads separate onto distinct people. In a paper whose title is about attention, that absence is the finding.",
      ],
      takeaways: [
        "Equation 1's reshape drops the frame axis. Attention is computed across the 49 spatial positions of one timestep, never across timesteps.",
        "Temporal modelling belongs entirely to the two ConvLSTMs, before and after the attention layer.",
        "Eight heads are justified by an object-count story that the paper never verifies — no attention map is shown.",
        "The placement itself is unablated: no variant puts the MHSA elsewhere, and no variant runs two ConvLSTMs without it.",
      ],
      pdfPage: 7,
    },

    {
      id: "the-ablation",
      title: "One table, three changes, one attributed cause",
      tagline: "Reading Table 8",
      highlight: {
        label: "UCF-Crime binary AUC",
        value: "81.71 → 97.48",
        note: "+15.77, all credited to attention",
      },
      note: [
        "Table 8 is the paper's case for its contribution: ResNetConvLSTM against KianNet on four cuts of UCF-Crime, in both AUC and accuracy, with KianNet ahead in all eight cells. The binary column carries the headline — AUC from 81.71 to 97.48, accuracy from 62.50 to 92.98 — and the ablation section reads it as the effect of 'using a multi-head self-attention module followed by a ConvLSTM layer mechanism'.",
        "Three things change between those two columns, not one. The baseline is not a stripped-down KianNet but the authors' own previously published model [8]. The ablation section notes in passing that 'a more powerful backbone network was used than in previous work'. And the added block is the MHSA *and* a second ConvLSTM layer. Attention, an extra recurrent pass, and a backbone change all move together, and the whole delta is reported as the value of attention.",
        "The AllCat column is the one the abstract leaves out, and it is the most informative. Fourteen balanced classes give a 7.1% floor; the baseline scores 22.72% and KianNet 23.88%. The paper calls that an improvement 'marginally from 22.72% to 23.88%', which is fair, but it means the model that scores 97.48% AUC at telling violent from normal cannot tell shoplifting from stealing at better than a quarter correct.",
        "Note also which metric goes with which dataset. UCF-Crime is compared to prior work on AUC alone and RWF on accuracy alone, so no table shows both for either. The abstract quotes the AUC for one and the accuracy for the other — in both cases the higher of the two available numbers.",
      ],
      takeaways: [
        "The ablation's baseline is a different published model, not KianNet minus attention. Backbone and recurrent depth change alongside the attention module.",
        "AllCat sits near the floor: 23.88% against 7.1% chance, on the task of naming which of 13 crimes occurred.",
        "AUC and accuracy diverge sharply on the same configuration — 97.48 against 92.98 on binary — and each table shows only one of them.",
        "There is no validation split anywhere, so none of these figures is a clean held-out result.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          mode: "outcome",
          hue: 320,
          baselineId: "resnet-convlstm",
          metricLabel: "Reported value",
          datasetLabel: "UCF-Crime cut and metric",
          // T8 p10. Floors are the majority-class rate implied by T3's class
          // counts (p9) and apply to the accuracy chips only.
          datasets: [
            {
              id: "binary-auc",
              label: "Binary · AUC",
              title: "1900 videos, 950 anomalous / 950 normal",
            },
            {
              id: "binary-acc",
              label: "Binary · accuracy",
              title: "The same configuration the abstract quotes as 97.48% AUC",
              floor: 50,
              floorLabel: "always predict one class",
            },
            {
              id: "nref-acc",
              label: "NREF · accuracy",
              title: "300 videos: road accident, explosion, fighting, normal",
              floor: 50,
              floorLabel: "always predict normal",
            },
            {
              id: "majcat-acc",
              label: "4MajCat · accuracy",
              title: "600 videos in four 150-video super-categories",
              floor: 25,
              floorLabel: "always predict one of four",
            },
            {
              id: "allcat-acc",
              label: "AllCat · accuracy",
              title: "700 videos, 50 from each of 14 categories",
              floor: 7.14,
              floorLabel: "one of 14 balanced classes",
            },
          ],
          models: [
            {
              id: "resnet-convlstm",
              label: "ResNetConvLSTM",
              metrics: {
                "binary-auc": { accuracy: 81.71 },
                "binary-acc": { accuracy: 62.5 },
                "nref-acc": { accuracy: 65.38 },
                "majcat-acc": { accuracy: 62.22 },
                "allcat-acc": { accuracy: 22.72 },
              },
            },
            {
              id: "kiannet",
              label: "KianNet",
              metrics: {
                "binary-auc": { accuracy: 97.48 },
                "binary-acc": { accuracy: 92.98 },
                "nref-acc": { accuracy: 73.84 },
                "majcat-acc": { accuracy: 73.75 },
                "allcat-acc": { accuracy: 63.71 },
              },
            },
          ],
        },
        caption:
          "Table 8, with the chance floor drawn on every accuracy cut. One bar per model because this paper reports no sensitivity or specificity on any binary experiment. Switch to AllCat to see both models sitting close to a floor the paper never draws.",
      },
      pdfPage: 10,
    },

    {
      id: "figure-ten",
      title: "The figure drawn to justify eight heads shows six winning",
      tagline: "Where 97.48% is not",
      highlight: {
        label: "F10's highest point",
        value: "≈ 96.4% at h = 6",
        note: "the text claims 97.48% at h = 8",
      },
      note: [
        "Figure 10 exists to justify one choice: how many attention heads. It plots UCF-Crime binary AUC against h ∈ {1, 2, 4, 6, 8, 10}, with a red dashed line for the no-attention baseline, and the text reads it off as 'the blue line indicates the highest AUC value at 97.48% when h = 8. Consequently, we decided to use eight heads for our further experiments.'",
        "The figure does not say that. Its y-axis runs from about 91 to about 96.5, so 97.48% is not on the chart at all — there is no point, and no axis room, at that value. The highest plotted point is roughly 96.4%, and it sits at h = 6. The point at h = 8 is slightly below it, around 96.3%. On its own figure, the paper chose the second-best setting and quoted a number a full point above the best.",
        "The red baseline is the second problem. It sits at roughly 91.1% AUC, while Table 8 gives the no-attention model's UCF-Crime binary AUC as 81.71%. Those are two different baselines for the same comparison, nine points apart. Take Table 8's and attention is worth +15.77 points, which is the paper's claim. Take Figure 10's and the same module is worth about +5.3.",
        "None of this makes the model bad, and the gap between 96.4 and 97.48 would be unremarkable in a paper that reported a validation split, a seed, or a spread. This one reports none of the three, so there is nothing to absorb the discrepancy: the figure and the table are the entire evidence, and they disagree about both the number and which configuration produced it.",
      ],
      takeaways: [
        "F10's axis never reaches 97.48%, and its maximum falls at h = 6, not the h = 8 the paper adopts.",
        "F10's no-attention baseline (≈91.1%) and T8's (81.71%) differ by about nine points, changing the attention gain from +15.8 to about +5.3.",
        "Head count was selected on the same UCF-Crime binary metric that is then reported, with no validation split anywhere in the paper.",
        "Every value read off F10 here is an estimate from an unlabelled line chart — the figure prints no numbers.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          mode: "outcome",
          hue: 320,
          // The no-attention lane is the only one carrying a value in both
          // views, so the readout's delta is exactly the disputed quantity:
          // about +5.3 by the figure, +15.77 by the table.
          baselineId: "no-attention",
          metricLabel: "UCF-Crime binary AUC",
          datasetLabel: "Source",
          datasets: [
            {
              id: "f10",
              label: "Figure 10 (p7)",
              title:
                "The head sweep, read off an unlabelled line chart — values are estimates",
            },
            {
              id: "text",
              label: "Text and tables",
              title: "What the abstract, T5 and T8 report for the same experiment",
            },
          ],
          models: [
            // F10 p7: read off the plotted line. The figure prints no values,
            // so every f10 entry below is an estimate from bar/point height.
            { id: "h1", label: "h = 1", metrics: { f10: { accuracy: 96.1 } } },
            { id: "h2", label: "h = 2", metrics: { f10: { accuracy: 95.4 } } },
            { id: "h4", label: "h = 4", metrics: { f10: { accuracy: 96.0 } } },
            { id: "h6", label: "h = 6", metrics: { f10: { accuracy: 96.4 } } },
            {
              id: "h8",
              label: "h = 8 (chosen)",
              metrics: { f10: { accuracy: 96.3 }, text: { accuracy: 97.48 } },
            },
            { id: "h10", label: "h = 10", metrics: { f10: { accuracy: 94.3 } } },
            {
              id: "no-attention",
              label: "no attention",
              metrics: { f10: { accuracy: 91.1 }, text: { accuracy: 81.71 } },
            },
            {
              id: "reported",
              label: "KianNet as reported",
              // Only ever stated in prose and tables; it is not a point on F10.
              metrics: { text: { accuracy: 97.48 } },
            },
          ],
        },
        caption:
          "The head sweep as Figure 10 draws it, beside what the text and tables claim for the same experiment. Everything is measured against the no-attention lane, the one value both sources report — and they put it nine points apart. Switch to 'Text and tables' and most lanes go empty: the sweep exists only in the figure, which never reaches the 97.48% the text reads off it.",
      },
      pdfPage: 7,
    },
  ],
};
