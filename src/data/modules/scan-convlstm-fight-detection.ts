import type { StudyModule } from "@/types/study";

/**
 * Chaturvedi, Dhiman & Vishwakarma (2024), "Fight detection with spatial and
 * channel wise attention-based ConvLSTM model". Expert Systems 41:e13474.
 *
 * Review extraction only -- no study module has been authored for this paper.
 *
 * Table map, for anyone checking the numbers against the PDF:
 *   T1 p6  dataset description        T3 p8  prior work, Hockey/Crowd/Movies
 *   T2 p6  ConvLSTM variant ablation  T4 p8  prior work, RWF-2000
 *
 * Figures: F1 p3 (whole pipeline), F2 p4 (the SCan-ConvLSTM cell), F3 p6
 * (dataset samples), F4 p7 (ROC curves, no AUC printed), F5 p9 (saliency
 * visualisation), F6 p9 (performance bar chart).
 *
 * Three of this paper's own headline numbers appear twice with two different
 * values -- see the protocol notes. Where they conflict, both are recorded and
 * the table figure is used for the results block, since T2 and T3 agree with
 * each other and the running text does not agree with either.
 */
export const moduleScanConvLstm: StudyModule = {
  slug: "scan-convlstm-fight-detection",

  premise:
    "ConvLSTM already keeps the 2D structure of a feature map while it walks a clip. This paper's move is to put attention inside that recurrence rather than in front of it: at every timestep, the cell's input is re-weighted first by location and then by channel, and both weightings are computed from the previous hidden state — so where the model looks is refined as the clip plays rather than fixed once. The ablation is the interesting part, and it does not go the way the text says it does.",

  results: [
    { label: "RWF-2000", value: "84.32%", note: "±0.47, T2 — but T4 reports 85.97" },
    { label: "Hockey Fight", value: "99.83%", note: "±0.52, T2 and T3 — text says 99.16" },
    { label: "Crowd Violence", value: "98.753%", note: "±0.63, T2 — its own spatial-only variant scores 100" },
    { label: "Cost", value: "not reported", note: "no parameters, FLOPs, FPS or hardware" },
  ],

  review: {
    architecture: {
      family: "CNN-LSTM",
      backbone:
        "ResNet-50 as a per-frame spatial feature extractor at a fixed 224×224 input, feeding a single ConvLSTM encoder and then a classifier (F1). The paper never states whether the ResNet-50 is pre-trained, on what, or whether it is frozen or fine-tuned.",
      motionEncoding:
        "Purely recurrent. ResNet-50 sees one frame at a time and knows nothing about motion; the only place change across frames can be represented is the ConvLSTM's cell and hidden state as it is stepped along the clip. There are no 3D kernels, no optical flow, no frame differencing and no second stream — the paper is explicit that it uses the RGB stream alone, and treats that as its efficiency argument.",
      inputs: [
        "RGB frames only, resized to 224×224 and normalised to [0,1]",
        "The number of frames sampled per clip is never stated — §4 says only 'followed by sampling'",
      ],
      fusion:
        "None in the multi-stream sense; there is one stream. Spatiotemporal fusion happens inside the ConvLSTM cell, where the convolutional gates operate on 2D feature maps rather than flattened vectors, so spatial structure survives the temporal encoding.",
      supervision:
        "Supervised binary classification, one label per clip, fight / non-fight. RMSprop, initial learning rate 0.0001, mini-batch of eight clips. Every dataset is annotated at video level (T1).",
      notes: [
        "Two attention blocks sit in series at the cell's input, not on its output: spatial attention first (Eq. 7-9), then channel-wise attention (Eq. 10-15), and the resulting Z_t is what the standard ConvLSTM equations (1)-(6) consume.",
        "Both blocks read the previous hidden state H_(t-1) alongside the current input. That is what makes this recurrent attention rather than a CBAM block bolted onto a backbone — the weights at frame t depend on what the model has already seen, and can be refined step by step.",
        "The paper's ablation ladder is its own architecture three times over: plain ConvLSTM, then SAtt-ConvLSTM (spatial attention only), then SCan-ConvLSTM (spatial then channel). Common settings are used across all three on each dataset, which makes T2 a genuinely clean comparison — and its result is not the one the text reports.",
        "Two equations do not describe what the text says they do. §3.2 says an 'elementwise sum operation is performed on attention map α_t and original input feature X_t', but Eq. 9 is a Hadamard product. Eq. 15, Z_t = Σ_(i=1..c) u_i β_t^i, sums over channels, which would collapse the channel axis to one map — as written it cannot be the tensor that a ConvLSTM cell then convolves. Both read as transcription errors rather than design choices, but the specification is what it is.",
        "The backbone choice is not a lightweight one. A full ResNet-50 is run over every sampled frame at 224×224 before the recurrence starts, and the paper's efficiency claim rests entirely on there being one stream rather than two — never on what that one stream costs.",
      ],
    },

    attention: {
      used: true,
      kinds: ["spatial", "channel"],
      mechanisms: [
        {
          name: "Spatial attention (the SAtt block)",
          placement:
            "On the ConvLSTM cell's input, before the gates. Y_t = ω_Y * tanh(ω_xa * X_t + ω_ha * H_(t-1) + b_A), then a softmax over all spatial positions of Y_t gives the 2D map α_t, applied as X̂_t = α_t ⊙ X_t. Recomputed at every timestep.",
          reportedEffect:
            "Isolated cleanly as SAtt-ConvLSTM in T2. Over plain ConvLSTM: +2.25 on RWF-2000 (79.12 → 81.37), +1.25 on Hockey Fight (98.21 → 99.46), +3.65 on Crowd Violence (96.35 → 100), +6.89 on the pooled Gen_Test_Case (89.96 → 96.85), and no change on Movies, which is already at 100 for every variant.",
        },
        {
          name: "Channel-wise attention",
          placement:
            "Immediately after the spatial block and still before the gates. Mean-pools X̂_t and H_(t-1) to one scalar per channel, concatenates the pair, then a two-layer bottleneck (ReLU then sigmoid, with c̃ < c) produces one weight β_t^i per channel.",
          reportedEffect:
            "Isolated as the T2 step from SAtt-ConvLSTM to SCan-ConvLSTM, and it does not help everywhere. It adds +2.95 on RWF-2000 (81.37 → 84.32), +0.37 on Hockey Fight and +1.56 on Gen_Test_Case, but costs −1.25 on Crowd Violence, where the spatial-only variant reaches 100% ±0% and the full model falls to 98.753% ±0.63%.",
        },
      ],
      notes: [
        "The channel block is squeeze-and-excitation with the hidden state added to the squeeze. Mean-pool to a scalar per channel, bottleneck, expand, sigmoid, rescale — the SE recipe, except that the descriptor concatenates the pooled input with the pooled H_(t-1), so the channel weights are also conditioned on the clip's history.",
        "There is no temporal attention here, which is easy to miss given the paper's framing. Nothing weights one frame against another; every frame is processed, and the only mechanism for deciding a frame matters less is whatever the forget gate does. The two attention axes are 'where in the frame' and 'which feature channel', both applied identically at every timestep.",
        "Putting attention on the cell input rather than the backbone output is the paper's real contribution and it is the part that is properly measured. T2 isolates each block on five test cases with common settings — better ablation discipline than most papers in this library manage.",
        "That same table is where the paper's claim breaks. The text reads T2 as showing 'significant overall improvement in classification accuracy over the different variants'; on Crowd Violence the proposed model is beaten by its own spatial-only ablation, and T3 then lists the losing 98.753 against prior work while the 100% variant sits unmentioned one table above.",
        "Fig. 5 visualises the attention weights as saliency maps on RWF-2000 and Hockey Fight clips and the highlighted regions do fall on the fight. It is qualitative only — a handful of frames, no localisation metric, no quantitative check that the attention lands on the right region.",
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
        note: "The efficiency argument is made repeatedly and never measured. §4 dismisses the Flow Gated Network because 'its two stream learning model is computationally expensive from practical application' and concludes that using RGB alone 'makes SCan-ConvLSTM model suitable for practical surveillance application'; the abstract calls the fusion 'efficient' and the closing paragraph calls the model 'efficient for violence detection'. There is no inference time, frame rate, latency or wall-clock figure anywhere in the paper, and the conclusion lists 'better efficiency' as future work.",
      },
      edgeDeployment: {
        status: "not-addressed",
        note: "No edge, embedded or on-camera deployment is discussed. No memory footprint, power figure or accelerator is named.",
      },
      notes: [
        "No hardware is named at all. Not a GPU, not a CPU, not a cloud environment — the implementation paragraph gives the optimizer, learning rate and batch size and stops there. Nothing in the paper could be reproduced as a timing.",
        "The per-clip cost is not determinable even in principle, because the number of sampled frames per clip is never given. A recurrent model's cost is linear in that number and it is the one hyperparameter the paper omits.",
        "One stream is cheaper than two, which is true and is the whole of the argument. It says nothing about the absolute cost of running a full ResNet-50 at 224×224 over every sampled frame and then stepping a ConvLSTM with two extra attention blocks per cell over the sequence.",
        "The specific model called too expensive for practical use is measured elsewhere in this library: V001's T9 puts the Flow Gated Network at 0.27 M parameters and 94.7 FPS. That number is from the other paper, not this one — but it is the comparison this paper's efficiency claim rests on, and this paper reports nothing that could be set against it.",
      ],
    },

    evaluation: {
      datasets: [
        {
          name: "RWF-2000",
          role: "evaluation",
          note: "2000 clips, 5 s each, variable resolution, surveillance-camera footage (T1). The only genuinely operational dataset of the four, the one the paper scores worst on, and the one it describes as the most challenging and diverse.",
        },
        {
          name: "Hockey Fight",
          role: "evaluation",
          note: "1000 clips, 500 violent, ~50 frames each at 360×288, 1.6-1.96 s (T1). Broadcast sport with a uniform background; the paper attributes its near-perfect score here to 'the lack of diversity of samples'.",
        },
        {
          name: "Crowd Violence",
          role: "evaluation",
          note: "246 clips from YouTube, evenly split, 1.04-6.52 s, variable resolution (T1). Crowd scenes in the wild. The dataset where the full model is beaten by its own spatial-only ablation.",
        },
        {
          name: "Movies",
          role: "evaluation",
          note: "200 clips, fights cut from action films against non-fight clips from public action datasets (T1). Rebalanced by the authors for equal class counts. Every variant and eight of the fifteen baselines in T3 score 100% on it.",
        },
      ],
      split:
        "Five-fold cross-validation on each dataset, with no held-out validation set. A fifth test case, Gen_Test_Case, pools all four into 3446 clips (1723 fight, 1723 non-fight) and runs the same five-fold scheme over the pool.",
      metrics: [
        "Accuracy",
        "Standard deviation over a ±10-epoch window around the best epoch",
        "F1 score",
        "ROC curves (F4, no AUC value printed)",
      ],
      protocolNotes: [
        "The reported accuracy is anchored to the best epoch on the evaluation data. §4 states it plainly: 'accuracy is averaged over a radius of 10 epochs around the epoch where the model achieved the best result and the standard deviation of the accuracies is calculated.' So the mean is centred on a peak selected by looking at the number being reported, and the ± is epoch-to-epoch wobble around that peak — not fold-to-fold variance, and not a measure of how reliably the model would perform on unseen data. Every ± in T2 and T3 has to be read that way, which is also why they are so implausibly small.",
        "Three headline numbers appear twice with two different values. Hockey Fight is 99.83% ±0.52% in T2 and T3, 99.16% ±0.36% in the p7 text, and '99.9%' in a paragraph on the same page. Crowd Violence is 98.753% ±0.63% in T2 and T3 but 97.65% ±0.82% in that same p7 sentence. RWF-2000 is 84.32% ±0.47% in T2 and 85.97% in T4. The tables agree with each other; the running text agrees with neither.",
        "The RWF-2000 comparison in T4 is not like-for-like. This paper evaluates with five-fold cross-validation over the whole set, while the baselines it is ranked against — ConvLSTM, C3D, the I3D variants, Flow Gated Network, SPIL — are the published figures on RWF-2000's own official held-out split. Cross-validated and held-out numbers on the same data are not the same quantity, and the paper does not note the difference.",
        "The proposed model loses to its own ablation on Crowd Violence, and the paper reports the loss without acknowledging it. SAtt-ConvLSTM reaches 100% ±0% in T2; SCan-ConvLSTM reaches 98.753% ±0.63%. The text immediately below calls the full model a 'significant overall improvement over the different variants', and T3 carries the 98.753 forward into the state-of-the-art comparison.",
        "Gen_Test_Case tests pooling, not generalisation. All four datasets are merged and then cross-validated over the merged pool, so every fold trains and tests on clips from all four sources. It shows the model can fit a heterogeneous set; it says nothing about transfer. There is no cross-dataset test anywhere in the paper — no train-on-one, test-on-another result of any kind.",
        "Movies is saturated and carries no information. Every ConvLSTM variant scores 100% ±0%, as do Rethinking 3DCNN, ConvLSTM, Bi-ConvLSTM, C3D, all three I3D variants and Flow Gated Network in T3. Reporting it as a win is reporting a tie among nine methods.",
        "F1 score is reported alongside accuracy in T2, which is more than accuracy alone — but T3 and T4, the two tables that compare against prior work, drop it and rank on accuracy only. No precision, recall or confusion matrix appears anywhere, so the false-positive behaviour that decides whether an alarm is usable is not recoverable from the paper.",
        "F4 plots ROC curves for three datasets and prints no AUC on the figure or in the text, so the curves cannot be compared numerically against anything, including each other.",
        "On the distance-from-deployment axis the results run backwards, as they usually do: Movies (film) 100%, Hockey Fight (broadcast sport) 99.83%, Crowd Violence (in-the-wild, mixed devices) 98.75%, RWF-2000 (surveillance) 84.32%. The 15-point gap between the last two is the honest measure of what this model does on CCTV.",
        "The ResNet-50 backbone's initialisation is never specified — pre-trained or not, on what, frozen or fine-tuned. On datasets of 200 to 2000 clips that choice usually dominates the result, and it is not recoverable from the paper.",
      ],
    },
  },
};
