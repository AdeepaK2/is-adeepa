import type { StudyModule } from "@/types/study";

/**
 * Chatterjee, Roy Choudhury, Gourisaria, Banerjee, Dey, Sahni & León-Castro
 * (2025), "Temporal-Aware Transformer Approach for Violence Activity
 * Recognition". IEEE Access 13:70780-70789.
 *
 * Review extraction and study module.
 *
 * Table map, for anyone checking the numbers against the PDF:
 *   T1 p8  classification report, MobileTransformerSeq
 *   T2 p8  classification report, MobBiLSTM
 *   T3 p9  the two proposed models against the dataset's originating paper
 *   T4 p9  the two proposed models against five other architectures
 *   T5 p10 k-fold cross-validation for all seven
 *
 * None of the five tables extracts as text; their cells were read off pages
 * rendered at 200 dpi. Doing that is what surfaces this paper's central
 * problem: its headline accuracies appear in six places with five different
 * values, and two of the values cannot be accuracies on the test set it
 * describes. Every conflicting figure is recorded in the protocol notes rather
 * than reconciled, because the paper does not reconcile them.
 *
 * Figures: F1 p3 (workflow), F2 p5 and F6 p6 (model schematics), F3 p5
 * (MobileNetV2), F4-F5 p5 (LSTM and BiLSTM cells), F7-F8 p7-p8 (training
 * curves), F9-F10 p8 (confusion matrices), F11-F12 p9 (ROC), F13 p10
 * (qualitative frames -- see the note on its labels).
 */
export const moduleTemporalAwareTransformer: StudyModule = {
  slug: "temporal-aware-transformer",

  premise:
    "The architecture here is the field's default: a lightweight 2D CNN over frames, a temporal module over the resulting sequence, a softmax at the end. The paper's move is to build it twice — once with a BiLSTM, once with a transformer encoder — and report that self-attention wins by 1.6 points. What makes it worth reading closely is not the result but the reporting: the same model's accuracy is printed with five different values across the paper, and two of those values are arithmetically impossible on the 200-clip test set the paper describes.",

  results: [
    { label: "MobileTransformerSeq", value: "97.2%", note: "abstract and T4 — but T1's own row says 0.97 and the conclusion says 95.5%" },
    { label: "MobBiLSTM", value: "95.6%", note: "abstract and T4 — T2's per-class recalls imply 93.5%, which §IV-C prints" },
    { label: "k-fold", value: "95.75% ±3.15", note: "T5, and 1.45 points below the single-split figure" },
    { label: "Cost", value: "not reported", note: "no parameters, FLOPs, FPS, latency — and no hardware named" },
  ],

  review: {
    architecture: {
      family: "Vision Transformer",
      backbone:
        "MobileNetV2 as a per-frame spatial feature extractor, applied to sixteen 64×64 frames per clip, feeding one of two temporal modules. MobileTransformerSeq uses a transformer encoder: sinusoidal positional encoding, multi-head self-attention over the sixteen frame embeddings, a ReLU feedforward block, then the last frame's output through a fully connected softmax layer. MobBiLSTM uses a bidirectional LSTM instead, with the standard input, forget and output gates written out in Eqs. 2–7. Whether MobileNetV2 is ImageNet-pre-trained, frozen or fine-tuned is never stated; nor is the number of encoder layers, attention heads or embedding width.",
      motionEncoding:
        "Entirely by the temporal module over per-frame features — MobileNetV2 sees one frame at a time and knows nothing about motion. In the transformer variant, any relation between two frames is a self-attention weight computed from their embeddings; in the BiLSTM variant it is carried in the recurrent state, forwards and backwards. There is no 3D convolution, no optical flow and no frame differencing. Before either module runs, the input is decimated: every second frame is dropped and the remainder subsampled at regular intervals down to sixteen.",
      inputs: [
        "RGB frames at 64×64, normalised to [0,1] — an unusually small input, and the paper gives no reason for the choice beyond standardisation",
        "Sixteen frames per clip, obtained by dropping every second frame and then dividing the remaining count by the sequence length to sample at regular intervals",
        "One label per video, one-hot encoded; 0 for non-violence, 1 for violence",
      ],
      fusion:
        "None — a single stream throughout. The only combination step is the classifier, which consumes the temporal module's output for the final position in the sequence.",
      supervision:
        "Supervised binary clip classification, trained for 15 epochs at batch size 8. Optimiser and learning rate are never stated.",
      notes: [
        "The two models differ in exactly one component, which makes the comparison between them the cleanest experiment in the paper: same backbone, same input pipeline, same classifier head, BiLSTM against transformer encoder. That is a genuinely useful ablation and it is not framed as one.",
        "Self-attention here is temporal only. It relates frame to frame over a sixteen-element sequence; it does not attend within a frame, and there is no patch embedding anywhere. Calling the family Vision Transformer is a filing convenience — structurally this is the CNN-plus-sequence-model pattern with the recurrence replaced.",
        "Both variants classify from the last position in the sequence, so neither can produce a verdict before the clip has been fully consumed. For the BiLSTM this is intrinsic: the backward pass starts at the final frame. The paper describes the system as real-time detection twenty-two times.",
        "64×64 is small enough to matter. At that resolution a fight in a wide street scene occupies a few dozen pixels, and the discriminative signal available is closer to scene-level texture and gross motion than to what any individual is doing. No experiment varies it.",
        "Architectural hyperparameters are absent throughout — encoder depth, head count, embedding dimension, LSTM hidden units, learning rate, optimiser. The model as described cannot be reimplemented from the paper.",
      ],
    },

    attention: {
      used: true,
      kinds: ["self", "temporal"],
      mechanisms: [
        {
          name: "Multi-head self-attention over the frame sequence (TransformerSeq)",
          placement:
            "After MobileNetV2 and positional encoding, over the sixteen per-frame embeddings. Standard scaled dot-product attention, softmax(AB^T/√d_b)C in Eq. 10, followed by a ReLU feedforward block (Eq. 11). Number of layers and heads not stated.",
          reportedEffect:
            "Isolated cleanly against the BiLSTM variant, because nothing else changes between them: 97.2% against 95.6% on the single split (T4), and 95.75% ±3.15% against 94.35% ±2.82% under cross-validation (T5). A margin of 1.6 and 1.4 points respectively — and, in the k-fold case, well inside the reported standard deviations.",
        },
      ],
      notes: [
        "This is the only paper in the library so far whose attention mechanism relates one frame to another rather than one region or channel to another. Every position can attend to every other position in the sixteen-frame window, so a cue at frame 2 and its consequence at frame 14 are one hop apart — which is exactly the thing a recurrent state has to carry step by step and a convolution cannot reach at all.",
        "There is no spatial or channel attention. Nothing weights a region of a frame or a feature map, so the model has no mechanism for locating violence within the image, and no attention map is ever visualised.",
        "Positional encoding is what keeps the sequence ordered, since self-attention is permutation-invariant. The paper uses the standard sinusoidal scheme (Eqs. 8–9). Worth contrasting with V006, whose temporal weighting discards frame order entirely.",
        "The comparison the field usually wants — attention against no attention — is available here in a form most papers do not offer, since the BiLSTM variant is the same model with the attention removed and a recurrence put back. On the more reliable of the two protocols the gain is 1.4 points against a ±2.8 spread, which is a weaker result than the abstract's framing suggests.",
      ],
    },

    efficiency: {
      parameters: undefined,
      flops: undefined,
      modelSize: undefined,
      throughput: undefined,
      hardware: undefined,
      realTime: {
        status: "claimed-without-evidence",
        note: "Real-time detection is the paper's stated purpose and the phrase appears twenty-two times, beginning in the abstract and ending in the conclusion. Nothing measures it. There is no inference time, no frame rate, no latency figure and no wall-clock number anywhere, and — unusually even among papers that measure nothing — no hardware is named at all. The 'real-time prediction' subsection in §III-F describes a predict-video function that extracts frames, runs the model and displays a confidence score; it reports no timing. Both variants also classify from the last position of a sixteen-frame sequence, so no verdict exists until the clip has been fully read.",
      },
      edgeDeployment: {
        status: "claimed-without-evidence",
        note: "MobileNetV2 is chosen explicitly for 'mobile and embedded vision applications' and the introduction anticipates deployment on edge devices such as drones and body cameras. No edge or embedded device is used, no memory footprint or power figure is given, and no parameter count appears — not even MobileNetV2's, which is published and could have been quoted.",
      },
      notes: [
        "The efficiency argument rests entirely on the choice of backbone. MobileNetV2 is lightweight, therefore the system is suitable for real-time embedded use — an inference from a component's reputation, with nothing measured about the assembled model.",
        "Not one number in the paper describes cost. No parameters, no FLOPs, no model size, no throughput, no training time, no hardware. Against V010, which times both halves of its pipeline on named devices, or V015, which reports parameters and CPU throughput for three models under one protocol, this is the weakest efficiency reporting in the library.",
        "The one design decision with a clear and large cost implication is the 64×64 input, and it is presented as standardisation rather than as an efficiency measure. Sixteen frames at 64×64 is a very small tensor; whatever this model costs, it is dominated by that choice, and the paper never connects the two.",
        "A transformer encoder over sixteen positions is cheap — self-attention is quadratic in sequence length, and sixteen is short — so the swap from BiLSTM to transformer plausibly costs little. The paper claims TransformerSeq's 'lightweight structure enables effective processing' and reports nothing that would let anyone check it against the BiLSTM it replaced.",
      ],
    },

    evaluation: {
      datasets: [
        {
          name: "RLVS",
          role: "evaluation",
          note: "The only dataset, and the paper never names it — it is cited as [19], Soliman et al. (2019), and described as 2,000 YouTube videos evenly split into 1,000 violent and 1,000 non-violent, with real-life street fight scenarios across varied environments and lighting. The non-violent class covers sports, eating, walking and other daily activity. The paper's own limitations paragraph is candid about the consequence: the footage is YouTube video rather than surveillance, and subtle or ambiguous violence such as verbal confrontation is absent.",
        },
      ],
      split:
        "80% train, 10% validation, 10% test, by Scikit-learn's train_test_split. The test set is 200 clips, confirmed by the support column of T1 and T2. Two statements contradict this: §IV-A says '1600 videos are used for testing, 200 for validation, and 200 for training', which reverses training and testing, and the same paragraph reports 'a validation split of 20%' against the 10% stated twice elsewhere. T5 additionally reports k-fold cross-validation, with k never specified.",
      metrics: [
        "Accuracy",
        "Precision, recall and F1 per class (T1, T2)",
        "Macro and weighted averages (T1, T2)",
        "Confusion matrices (F9, F10)",
        "AUC and ROC curves (F11, F12)",
        "k-fold cross-validation mean and standard deviation (T5)",
      ],
      protocolNotes: [
        "The paper's headline accuracies appear in six places with five different values, and the tables do not agree with the prose. For MobBiLSTM: 95.6% in the abstract, §IV-A, T3 and T4; 0.95 in T2's own accuracy row; 93.5% in §IV-C's prose; 94% in §III-F; and, for the cross-validated protocol, 94.35% in T5 against 96.35% in the sentence introducing T5. For MobileTransformerSeq: 97.2% in the abstract, §IV-A, T3 and T4; 0.97 in T1's accuracy row; and 95.5% in the conclusion. None of these is reconciled anywhere.",
        "Two of the headline values cannot be accuracies on the test set the paper describes. T1 and T2 both give the support as 200, so accuracy on that set must be a multiple of 0.5%. 97.2% would require 194.4 correctly classified clips and 95.6% would require 191.2. Neither is attainable. The neighbouring achievable values are 97.0% (194/200) and 95.5% (191/200) — and 95.5% is precisely the figure the conclusion gives.",
        "T2's own rows imply an accuracy the table's accuracy row contradicts. With supports of 99 and 101 and recalls of 0.91 and 0.96, the correctly classified counts are forced to 90 and 97, giving 187/200 = 93.5% — which is the value §IV-C prints. Every other cell of T2 is internally consistent with those counts: precision 90/94 = 0.96 and 97/106 = 0.92, F1 0.93 and 0.94, macro averages 0.94 and 0.93. Only the accuracy row, at 0.95, does not follow. T1 has no such problem: supports 97 and 103 with recalls 0.96 and 0.98 give 93 and 101, so 194/200 = 0.97, matching its own row exactly.",
        "The confusion-matrix paragraph restates the support counts as if they were correct classifications. §IV-B-1 says the MobileTransformerSeq model 'correctly classifies 97 non-violent and 103 violent samples' and that MobBiLSTM 'correctly classifies 99 non-violent and 101 violent samples'. Those are the support columns of T1 and T2; if they were correct classifications both models would be at 100%, which contradicts every accuracy figure in the paper.",
        "F1 scores conflict between tables in the same way. T4 gives MobileTransformerSeq an F1 of 96.2% and MobBiLSTM 95.4%, while T1 and T2 report macro and weighted F1 of 0.97 and 0.93 for the same models on the same test set.",
        "The cross-validated numbers are the ones to trust, and they are lower. T5 puts MobileTransformerSeq at 95.75% ±3.15% and MobBiLSTM at 94.35% ±2.82%, against 97.2% and 95.6% on the single split. Five of the seven models score lower under cross-validation than on the single split, by 1.4 to 3.5 points, which is the expected direction and the reason the single-split figures should not be the headline. The value of k is never stated.",
        "The margin the paper is built on does not survive its own error bars. Transformer against BiLSTM is 1.6 points on the single split and 1.4 under cross-validation, where the standard deviations are ±3.15% and ±2.82%. The comparison is clean — one component changes and nothing else — but the effect is well inside the run-to-run spread the paper itself reports.",
        "Only one baseline is a published result. T3 compares against 'the approach used in [19]' at 89.5% accuracy and 88.9% F1, which is the dataset's originating paper. The other five rows of T4 and T5 are architectures the authors assembled and trained themselves; no citation in that table points to a published RLVS result. So the comparison is largely against this paper's own reimplementations, under its own training budget of 15 epochs.",
        "One dataset, no cross-dataset test, and no surveillance footage. RLVS is YouTube video of real street fights, which is closer to operational conditions than film or broadcast sport but is not CCTV, and nothing establishes transfer to anything else. The paper's limitations paragraph says as much and recommends incorporating real surveillance footage in future work.",
        "Figure 13, the qualitative result, contains a visible misclassification the surrounding text does not acknowledge. Two frames from the same street-brawl video — one showing several people beating a person on the ground, another showing a man swinging a stick — are labelled 'NonViolence' in green, while the text states that the model 'accurately identified violent sequences such as street fights and physical altercations with high confidence'.",
        "Two smaller slips worth recording for anyone matching the tables up: the same model is labelled Baseline-2 in T4 and Baseline-3 in T5, and §IV-C opens by attributing T3 to MobBiLSTM before explaining the result in terms of MobileTransformerSeq two sentences later.",
        "To the paper's credit, the metric set is complete — per-class precision, recall and F1 with supports, macro and weighted averages, confusion matrices, ROC curves with AUC (0.97 and 0.93), and a cross-validated protocol with standard deviations. Publishing the support column is what makes the arithmetic checkable at all. The problem is not that the paper measured too little; it is that the numbers it reports do not agree with each other.",
      ],
    },
  },

  concepts: [
    {
      id: "swap",
      title: "Two models that differ in exactly one component",
      tagline: "BiLSTM or self-attention",
      highlight: {
        label: "Transformer over BiLSTM",
        value: "+1.4",
        note: "under cross-validation, against a ±2.8 standard deviation",
      },
      note: [
        "The paper builds the same pipeline twice. MobileNetV2 reads sixteen 64×64 frames and produces sixteen embeddings; a temporal module relates them; a fully connected softmax reads the last position. The only thing that changes between the two models is the middle.",
        "MobBiLSTM puts a bidirectional LSTM there. Information moves along the sequence one step at a time, forwards and backwards, and whatever relates frame 2 to frame 14 has to survive twelve gated updates to get there.",
        "MobileTransformerSeq puts a transformer encoder there instead. Sinusoidal positional encoding restores the order that self-attention would otherwise ignore, then multi-head attention lets every frame attend directly to every other one. Frame 2 and frame 14 are a single weight apart. On a sixteen-element sequence this is also cheap — attention is quadratic in length, and sixteen is short.",
        "Because nothing else differs, this is a clean ablation of recurrence against self-attention, and it is the most useful experiment in the paper. The paper does not frame it as an ablation; it presents two proposed models and reports that one is better.",
        "The margin is 1.6 points on the single split and 1.4 under cross-validation. In the cross-validated table the standard deviations are ±3.15% and ±2.82%, so the difference is comfortably inside the spread. The result points the right way and does not establish much.",
        "One property both variants share, and neither can escape, is that the verdict comes from the last position in the sequence. For the BiLSTM the backward pass literally starts at the final frame. The paper calls this system real-time detection twenty-two times.",
      ],
      takeaways: [
        "Same backbone, same input pipeline, same classifier. Only the temporal module changes — a rare clean comparison.",
        "Self-attention makes any two of the sixteen frames one hop apart; the BiLSTM makes distant pairs travel through every step between them.",
        "1.4 points of gain against ±2.8 of run-to-run spread. Directionally right, statistically thin.",
        "Neither variant can emit a decision before the clip ends, which is not what the phrase real-time usually promises.",
      ],
      visual: {
        kind: "bidirectional-sequence",
        options: {
          hue: 115,
          // Sixteen is the paper's stated sequence length (§III-C-2).
          frames: 16,
          // Only the bidirectional configuration exists. No forward-only LSTM is
          // trained anywhere, so the price of the backward pass is unmeasured.
          accuracy: { bidirectional: 95.6 },
          labels: {
            forward: "forward LSTM",
            backward: "backward LSTM",
            verdict: "last position → dense → softmax",
          },
          copy: {
            readout: "MobBiLSTM accuracy",
            directionLabel: "Recurrence",
            chips: { forward: "forward only", bidirectional: "bidirectional" },
            lines: {
              forward:
                "A forward-only recurrence has a state after every frame, so a verdict can be read as soon as you want one — the shape a live alarm needs. The paper never trains this configuration.",
              bidirectional:
                "The MobBiLSTM variant. The backward pass begins at frame sixteen, so nothing can be classified until the whole sequence has arrived. Swapping in the transformer encoder does not change this: it too classifies from the last position.",
            },
          },
        },
        caption:
          "The sixteen-frame window, forward recurrence above and backward below, with the verdict block staying pale until both passes land. The accuracy shown is the 95.6% that T4 prints — the same model is given four other values elsewhere in the paper, which the next concept takes up.",
      },
      pdfPage: 6,
    },

    {
      id: "numbers",
      title: "The same accuracy, printed five different ways",
      tagline: "Which number is the result?",
      highlight: {
        label: "MobBiLSTM accuracy",
        value: "93.5 – 96.35%",
        note: "five values across abstract, tables, prose and conclusion",
      },
      note: [
        "Track one model's accuracy through the paper and it does not hold still. MobBiLSTM is 95.6% in the abstract, in §IV-A, in Table 3 and in Table 4. It is 0.95 in Table 2's own accuracy row. It is 93.5% in the prose of §IV-C. It is 94% in §III-F. Under cross-validation it is 94.35% in Table 5 and 96.35% in the sentence that introduces Table 5. MobileTransformerSeq fares slightly better: 97.2% in four places, 0.97 in Table 1, and 95.5% in the conclusion.",
        "Two of these cannot be right, and the reason is arithmetic rather than judgement. Tables 1 and 2 both give the support as 200 clips, so any accuracy on that test set is a whole number of clips out of 200 — a multiple of 0.5%. 97.2% would need 194.4 clips classified correctly. 95.6% would need 191.2. Neither is a thing that can happen. The achievable values on either side are 97.0% (194/200) and 95.5% (191/200), and 95.5% is exactly what the conclusion reports.",
        "Table 2 also disagrees with itself, and its own rows say which side is right. With supports of 99 and 101 and recalls of 0.91 and 0.96, the correct counts are pinned to 90 and 97 — no other integers round to those recalls. That gives 187 correct out of 200, or 93.5%, which is the figure §IV-C prints. Every other cell of the table follows from those same counts: precision 90/94 = 0.96 and 97/106 = 0.92, F1 0.93 and 0.94, macro averages 0.94 and 0.93. Only the accuracy row, at 0.95, does not.",
        "Table 1 has no such problem. Supports of 97 and 103 with recalls of 0.96 and 0.98 give 93 and 101 correct, so 194/200 = 0.97, matching its own accuracy row exactly. The MobileTransformerSeq report is internally sound; it is the abstract's 97.2% that does not correspond to it.",
        "The confusion-matrix paragraph compounds it. §IV-B-1 says the transformer model 'correctly classifies 97 non-violent and 103 violent samples' and the BiLSTM model '99 non-violent and 101 violent'. Those are the support columns — the number of clips of each class in the test set. Read as correct classifications they would put both models at 100%.",
        "None of this makes the paper's conclusion wrong. The transformer variant does beat the BiLSTM variant in every table, and both beat the dataset's originating baseline. But a reader cannot say what either model scored, and the difference between 93.5% and 95.6% is larger than the 1.6-point margin the paper's argument rests on.",
      ],
      takeaways: [
        "Accuracy on a 200-clip test set must be a multiple of 0.5%. Both abstract figures, 97.2% and 95.6%, are impossible.",
        "T2's per-class recalls and supports force 187/200 = 93.5%, which the paper prints in §IV-C and contradicts in its own accuracy row.",
        "T1 is internally consistent at 194/200 = 97.0%; the abstract's 97.2% is not that number.",
        "The support column is what makes all of this checkable. Publishing it is good practice, and here it is what exposes the rest.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          hue: 115,
          mode: "outcome",
          metricLabel: "Accuracy",
          datasetLabel: "Model",
          baselineId: "abstract",
          // Every place each model's accuracy is stated, as a separate lane.
          // Switch models to see the spread for each. The "implied by" lanes are
          // arithmetic on the paper's own printed supports and recalls.
          datasets: [
            {
              id: "mbl",
              label: "MobBiLSTM",
              title: "five different values across the paper",
            },
            {
              id: "mts",
              label: "MobileTransformerSeq",
              title: "three different values across the paper",
            },
          ],
          models: [
            {
              id: "kfold-prose",
              label: "§IV-C prose, introducing T5",
              metrics: { mbl: { accuracy: 96.35 } },
            },
            {
              id: "abstract",
              label: "Abstract, §IV-A, T3 and T4",
              metrics: { mbl: { accuracy: 95.6 }, mts: { accuracy: 97.2 } },
            },
            {
              id: "report-row",
              label: "Accuracy row of T1 / T2",
              metrics: { mbl: { accuracy: 95.0 }, mts: { accuracy: 97.0 } },
            },
            {
              id: "conclusion",
              label: "Conclusion",
              metrics: { mts: { accuracy: 95.5 } },
            },
            {
              id: "kfold",
              label: "T5, k-fold cross-validation",
              metrics: {
                mbl: { accuracy: 94.35, accuracySd: 2.82 },
                mts: { accuracy: 95.75, accuracySd: 3.15 },
              },
            },
            {
              id: "section3f",
              label: "§III-F",
              metrics: { mbl: { accuracy: 94.0 } },
            },
            {
              id: "implied",
              label: "Implied by T1 / T2's own recalls and supports",
              metrics: { mbl: { accuracy: 93.5 }, mts: { accuracy: 97.0 } },
            },
          ],
        },
        caption:
          "One lane per place in the paper where each model's accuracy is stated, measured against the abstract's figure. The bottom lane is not quoted from anywhere — it is what the classification report's own recalls and supports force the accuracy to be. For MobBiLSTM it sits 2.1 points below the headline.",
      },
      pdfPage: 8,
    },

    {
      id: "input",
      title: "Sixteen frames at 64×64, and what that can still contain",
      tagline: "The input pipeline",
      highlight: {
        label: "Frame size",
        value: "64 × 64",
        note: "the smallest input of any paper in this library",
      },
      note: [
        "Before either temporal module runs, the video is reduced twice. Every second frame is discarded outright. What remains is then divided by the sequence length, sixteen, and sampled at regular intervals — so an RLVS clip of a few hundred frames arrives as sixteen stills. Each of those is resized to 64×64 and scaled to [0,1].",
        "64×64 is small. For comparison, V007 and V008 both use 224×224, V015 uses 320×240, and even V006's most aggressive downsampling keeps 50×80. At 64×64, a street fight filmed from across a road occupies a few dozen pixels; limbs, weapons and facial expression are simply not present in the tensor. What survives is scene composition, gross motion between samples, colour and blur.",
        "That is not automatically fatal — RLVS violent clips are street fights filmed close and handheld, often filling the frame, and the class boundary against sports and walking may well be visible at that scale. It does mean the model is very unlikely to be reading the interaction dynamics the introduction describes, and it puts a ceiling on transfer to wide-angle surveillance footage where the subjects are small.",
        "The paper offers no justification for the resolution beyond standardising input size, and runs no experiment varying it. Nor does it vary the sequence length, or test whether dropping every second frame costs anything. All three are presented as preprocessing rather than as choices with consequences.",
        "The decimation also interacts with the real-time framing. Sixteen frames sampled 'at regular intervals' across the whole clip means the sampling interval depends on the clip's total length — which is only known once the clip has ended. This is offline clip classification, not a stream being consumed as it arrives.",
      ],
      takeaways: [
        "Every second frame dropped, then subsampled to exactly sixteen, then resized to 64×64.",
        "At 64×64 the model cannot be reading fine-grained interaction; scene-level appearance and gross motion are what remain.",
        "No experiment varies the resolution, the sequence length, or the frame-skipping. All three are fixed by assertion.",
        "Regular-interval sampling across the whole clip requires knowing the clip length in advance, which a live stream does not provide.",
      ],
      pdfPage: 3,
    },

    {
      id: "comparison",
      title: "The single split flatters almost everything",
      tagline: "T4 against T5",
      highlight: {
        label: "InceptionV3 + BiLSTM",
        value: "62.6% → 67.2%",
        note: "the one model cross-validation helps",
      },
      note: [
        "The paper reports the same seven models twice: once on the single 80/10/10 split (T4) and once under k-fold cross-validation (T5). Reading the two tables against each other is more informative than either alone.",
        "Five of the seven score lower under cross-validation, by between 1.2 and 4.0 points. MobileTransformerSeq falls from 97.2% to 95.75%, MobBiLSTM from 95.6% to 94.35%, MobileNetV2 + GRU from 92.4% to 88.89%, MobileNetV3 + ViT from 91.2% to 87.43%, CNN + TransformerSeq from 91.3% to 89.34%. That is the expected direction: a single split is one draw, and the draw that gets reported tends to be a good one.",
        "Two move the other way. Xception + ResNet101V2 + BiLSTM is essentially unchanged at 93.1% and 93.14%, and InceptionV3 + BiLSTM rises from 62.6% to 67.2% — still far below everything else, and a 62.6% on a balanced two-class problem is barely above chance for a model of that size, which suggests something went wrong in training it rather than that the architecture is unsuited.",
        "The ordering is mostly stable across the two protocols, which is the reassuring part: the transformer variant leads in both, and the same models cluster at the bottom. What changes is the size of the margins, and the standard deviations in T5 — ±2.12% to ±4.97% — put most of the gaps between neighbouring models inside the noise.",
        "One structural caveat on the comparison as a whole. Only one row in the paper is a published result: T3's 'approach used in [19]' at 89.5%, the RLVS dataset's own originating paper. Every other architecture in T4 and T5 was assembled and trained by these authors under this paper's budget of 15 epochs. So this is largely a comparison of the authors' reimplementations against each other, which is a legitimate exercise but a different claim from beating the state of the art.",
      ],
      takeaways: [
        "Five of seven models score lower under cross-validation; the single-split numbers are the optimistic ones.",
        "The proposed model's lead survives both protocols but shrinks from 1.6 to 1.4 points against ±3 standard deviations.",
        "k is never stated, so the cross-validation cannot be reproduced exactly.",
        "Only one baseline is a published figure. The other five are this paper's own reimplementations.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          hue: 115,
          mode: "outcome",
          metricLabel: "Accuracy",
          datasetLabel: "Protocol",
          baselineId: "mts",
          // T4 p9 and T5 p10. Standard deviations exist only for the k-fold
          // protocol, which is why only that axis carries whiskers.
          datasets: [
            {
              id: "kfold",
              label: "k-fold cross-validation",
              title: "T5 — k is never stated",
              floor: 50,
              floorLabel: "balanced-class chance",
            },
            {
              id: "single",
              label: "Single 80/10/10 split",
              title: "T4 — one draw, 200 test clips",
              floor: 50,
              floorLabel: "balanced-class chance",
            },
          ],
          models: [
            {
              id: "mts",
              label: "MobileTransformerSeq (proposed)",
              metrics: {
                single: { accuracy: 97.2 },
                kfold: { accuracy: 95.75, accuracySd: 3.15 },
              },
            },
            {
              id: "mbl",
              label: "MobBiLSTM (proposed)",
              metrics: {
                single: { accuracy: 95.6 },
                kfold: { accuracy: 94.35, accuracySd: 2.82 },
              },
            },
            {
              id: "xception",
              label: "Xception + ResNet101V2 + BiLSTM",
              metrics: {
                single: { accuracy: 93.1 },
                kfold: { accuracy: 93.14, accuracySd: 3.32 },
              },
            },
            {
              id: "mnv2-gru",
              label: "MobileNetV2 + GRU",
              metrics: {
                single: { accuracy: 92.4 },
                kfold: { accuracy: 88.89, accuracySd: 4.97 },
              },
            },
            {
              id: "cnn-transformer",
              label: "CNN + TransformerSeq (baseline)",
              metrics: {
                single: { accuracy: 91.3 },
                kfold: { accuracy: 89.34, accuracySd: 2.12 },
              },
            },
            {
              id: "mnv3-vit",
              label: "MobileNetV3 + positional encoder + ViT",
              metrics: {
                single: { accuracy: 91.2 },
                kfold: { accuracy: 87.43, accuracySd: 3.65 },
              },
            },
            {
              id: "inception",
              label: "InceptionV3 + BiLSTM",
              metrics: {
                single: { accuracy: 62.6 },
                kfold: { accuracy: 67.2, accuracySd: 2.66 },
              },
            },
          ],
        },
        caption:
          "The same seven models under both protocols, measured against the proposed transformer variant. Switching from the single split to cross-validation pulls five of the seven lanes back and adds the whiskers that were missing — most of the gaps between neighbouring models sit inside them.",
      },
      pdfPage: 9,
    },

    {
      id: "cost",
      title: "Real-time, twenty-two times, with nothing timed",
      tagline: "The unmeasured premise",
      highlight: {
        label: "Hardware named",
        value: "none",
        note: "no GPU, no CPU, no device, anywhere in the paper",
      },
      note: [
        "Real-time detection is what this paper says it is for. The phrase appears twenty-two times: in the abstract, in the introduction's case for automated surveillance, in the justification for MobileNetV2, in the description of TransformerSeq's advantages, and in the conclusion. §III-F even has a subsection titled 'Real-Time Prediction'.",
        "That subsection describes a function. It extracts frames from a video, preprocesses them the same way as during training, runs them through the model, picks the highest-probability class and displays it with a confidence score. It reports no timing of any kind.",
        "Nothing else in the paper does either. There is no inference time, no frame rate, no latency figure, no parameter count, no FLOPs, no model size, no training time. Most unusually, no hardware is named at all — not a GPU, not a CPU, not a cloud instance. Nothing here could be reproduced as a measurement even by someone who wanted to.",
        "The efficiency argument is therefore entirely inherited from the backbone. MobileNetV2 was designed for mobile and embedded vision, so the system is described as suitable for real-time embedded use. That reasoning skips the assembled model, and MobileNetV2's own published parameter count — a number the authors could have quoted without running anything — does not appear.",
        "Two facts about the design push against the claim in a way the paper never addresses. Both variants classify from the last position of a sixteen-frame sequence, so no verdict exists until the clip has been read to the end. And the sixteen frames are sampled at regular intervals across the whole clip, which requires knowing the clip's length in advance. Whatever this model's throughput is, the pipeline around it is built for finished video files, not for a camera feed.",
        "The genuinely cheap thing about this design goes unclaimed: sixteen frames at 64×64 is a tiny input tensor, and self-attention over sixteen positions is a small operation. The model probably is fast. The paper gives no way to know.",
      ],
      takeaways: [
        "Twenty-two mentions of real-time, zero timings, and no hardware named at any point.",
        "The 'Real-Time Prediction' subsection describes a prediction function and reports no latency.",
        "Not one cost figure of any kind — not even MobileNetV2's published parameter count.",
        "Regular-interval sampling over the full clip means the pipeline needs the video to have ended before it starts.",
      ],
      pdfPage: 7,
    },
  ],
};
