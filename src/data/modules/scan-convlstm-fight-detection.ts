import type { StudyModule } from "@/types/study";

/**
 * Chaturvedi, Dhiman & Vishwakarma (2024), "Fight detection with spatial and
 * channel wise attention-based ConvLSTM model". Expert Systems 41:e13474.
 *
 * Review extraction and study module.
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

  concepts: [
    {
      id: "placement",
      title: "The attention goes inside the cell, not in front of it",
      tagline: "Where the gate sits",
      highlight: {
        label: "Both blocks read",
        value: "X_t and H_(t−1)",
        note: "so the weights at frame t depend on what the model has already seen",
      },
      note: [
        "Most attention in this field is a block bolted between a backbone and a classifier: CBAM after a ResNet stage, a squeeze-and-excitation gate on a feature map, computed once from that feature map alone. This paper's contribution is a position, not a mechanism. The two gates it uses are recognisable — a softmax spatial map and a squeeze-and-excitation channel weighting — but they are placed on the input of a ConvLSTM cell, inside the recurrence, and recomputed at every timestep.",
        "That placement changes what the gates can condition on. Both blocks take the previous hidden state H_(t−1) alongside the current frame's features. Spatial attention computes Y_t = ω_Y * tanh(ω_xa * X_t + ω_ha * H_(t−1) + b_A) and softmaxes it across every position to get the map α_t; the channel block mean-pools X̂_t and H_(t−1) to one scalar each per channel, concatenates the pair, and runs it through a ReLU-then-sigmoid bottleneck. Neither weight is a function of the current frame alone.",
        "So where the model looks is refined as the clip plays rather than decided once. At frame one the spatial map has no history to work with; by frame twenty it has been steered by everything before it. That is a genuinely different object from a static attention block, and it is the paper's real idea.",
        "Two caveats on reading the equations. §3.2 says an 'elementwise sum operation is performed on attention map α_t and original input feature X_t', while Eq. 9 writes a Hadamard product — those are different operations and the text and the equation disagree. Eq. 15, Z_t = Σ_(i=1..c) u_i β_t^i, sums over channels, which as written would collapse the channel axis to a single map and leave nothing for a ConvLSTM to convolve. Both look like transcription errors, but the specification is what is printed.",
      ],
      takeaways: [
        "Spatial attention first (Eq. 7–9), then channel attention (Eq. 10–15), then the standard ConvLSTM gates (Eq. 1–6) consume the result.",
        "Conditioning on H_(t−1) is what makes this recurrent attention rather than a CBAM block moved one layer down.",
        "There is no temporal attention anywhere. Nothing weights one frame against another — the two axes are 'where in the frame' and 'which channel', applied identically at every step.",
        "The backbone is a full ResNet-50 at 224×224 per frame, and the paper never says whether it is pre-trained, on what, or frozen.",
      ],
      visual: {
        kind: "attention-map",
        options: {
          hue: 300,
          gridSize: [6, 6],
          channels: 4,
          combine: "product",
          residual: false,
          // T2, p6, RWF-2000 column. `channel` is absent on purpose: the paper
          // never runs a channel-only variant, so the readout says so.
          effect: { spatial: 81.37, both: 84.32 },
          branches: [
            {
              id: "spatial",
              label: "spatial",
              note: "softmax over every position of Y_t, computed from X_t and H_(t−1)",
            },
            {
              id: "channel",
              label: "channel-wise",
              note: "sigmoid weight per channel, from the mean-pooled X̂_t and H_(t−1)",
            },
          ],
          copy: {
            readout: "RWF-2000 accuracy",
            branchLabel: "Attention",
            lines: {
              spatial:
                "SAtt-ConvLSTM. One weight per position, identical on every channel — the map can say where, never which feature.",
              channel:
                "One weight per channel, identical at every position. The paper never runs this variant on its own.",
              both: "SCan-ConvLSTM. Spatial mask first, then per-channel weights on the masked features — a spatial map and a channel vector composing into one gate.",
            },
          },
        },
        caption:
          "The two gates as they compose. The paper applies them in series — the softmax spatial map of Eq. 9, then the per-channel sigmoid weights of Eq. 14–15 on the already-masked features — which is the product this scene draws. Mask shapes are illustrative; the accuracies are T2's RWF-2000 column, and the channel-only lane is blank because that ablation does not exist.",
      },
      pdfPage: 4,
    },

    {
      id: "ablation",
      title: "A clean ablation, and a result the paper does not read correctly",
      tagline: "T2",
      highlight: {
        label: "Crowd Violence",
        value: "100% → 98.75%",
        note: "adding channel attention makes the model worse",
      },
      note: [
        "Table 2 is the best-designed experiment in the paper. It runs three models — plain ConvLSTM, spatial attention only, spatial plus channel — on five test cases, with common settings held across the variants on each dataset. Each attention block is therefore isolated by a single controlled step, which is more ablation discipline than most papers in this library manage.",
        "On four of the five it goes as advertised. Spatial attention adds 2.25 points on RWF-2000, 1.25 on Hockey Fight and 6.89 on the pooled Gen_Test_Case; channel attention on top adds a further 2.95, 0.37 and 1.56. The largest gains land on the hardest cases, which is the pattern you would want.",
        "On Crowd Violence it reverses. SAtt-ConvLSTM — the spatial-only ablation — reaches 100% ±0%. The full proposed model reaches 98.753% ±0.63%. Adding the channel attention that the paper's title is half about costs 1.25 points and takes the model off a perfect score.",
        "The text below the table reads it as 'significant overall improvement in classification accuracy over the different variants' and does not mention the reversal. Table 3 then carries the losing 98.753 forward into the comparison against prior work, where it is presented as the state of the art on Crowd Violence, while the 100% variant sits unmentioned one table above. Both numbers are the paper's own; only one of them is discussed.",
        "It is worth being fair about what this does and does not mean. On 246 clips the difference between 100% and 98.75% is roughly three clips, and 100% on a small benchmark is a sign of saturation more than of quality. The problem is not that the channel block is useless — it clearly helps on RWF-2000. The problem is that a table showing a component hurting on one of five cases is described as improving on all of them.",
      ],
      takeaways: [
        "Three variants, five test cases, common settings — a genuinely controlled ablation of each attention block.",
        "Spatial attention helps everywhere it can. Channel attention helps on three cases, does nothing on the saturated one, and hurts on Crowd Violence.",
        "The 100% ±0% belongs to the ablation, not to the proposed model, and T3 reports the lower number as the headline.",
        "Movies is at 100% ±0% for all three variants, so one of the five columns carries no information about anything.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          hue: 300,
          mode: "outcome",
          metricLabel: "Accuracy",
          datasetLabel: "Test case",
          baselineId: "convlstm",
          // T2, p6. Deltas run against plain ConvLSTM so each attention block's
          // contribution reads directly off the lane.
          datasets: [
            {
              id: "rwf",
              label: "RWF-2000",
              title: "2000 surveillance clips — the hardest of the five",
            },
            {
              id: "crowd",
              label: "Crowd Violence",
              title: "246 in-the-wild crowd clips — where the reversal happens",
            },
            {
              id: "gen",
              label: "Gen_Test_Case",
              title: "all four datasets pooled, 3446 clips",
            },
            {
              id: "hockey",
              label: "Hockey Fight",
              title: "1000 broadcast hockey clips",
            },
            {
              id: "movies",
              label: "Movies",
              title: "200 film clips — 100% for every variant",
            },
          ],
          models: [
            {
              id: "scan",
              label: "SCan-ConvLSTM (proposed)",
              metrics: {
                rwf: { accuracy: 84.32, accuracySd: 0.47 },
                crowd: { accuracy: 98.753, accuracySd: 0.63 },
                gen: { accuracy: 98.41, accuracySd: 0.57 },
                hockey: { accuracy: 99.83, accuracySd: 0.52 },
                movies: { accuracy: 100, accuracySd: 0 },
              },
            },
            {
              id: "satt",
              label: "SAtt-ConvLSTM (spatial only)",
              metrics: {
                rwf: { accuracy: 81.37, accuracySd: 0.31 },
                crowd: { accuracy: 100, accuracySd: 0 },
                gen: { accuracy: 96.85, accuracySd: 0.21 },
                hockey: { accuracy: 99.46, accuracySd: 0.41 },
                movies: { accuracy: 100, accuracySd: 0 },
              },
            },
            {
              id: "convlstm",
              label: "ConvLSTM (no attention)",
              metrics: {
                rwf: { accuracy: 79.12, accuracySd: 0.34 },
                crowd: { accuracy: 96.35, accuracySd: 0.48 },
                gen: { accuracy: 89.96, accuracySd: 0.49 },
                hockey: { accuracy: 98.21, accuracySd: 0.46 },
                movies: { accuracy: 100, accuracySd: 0 },
              },
            },
          ],
        },
        caption:
          "T2 in full, measured against the attention-free ConvLSTM. Switch to Crowd Violence and the spatial-only lane overtakes the proposed model — the one case where the paper's second attention block costs accuracy rather than adding it.",
      },
      pdfPage: 6,
    },

    {
      id: "error-bars",
      title: "The ± is epoch wobble around a peak the paper chose by looking",
      tagline: "How to read every number here",
      highlight: {
        label: "Reported spread",
        value: "±0.21 to ±0.63",
        note: "not fold-to-fold variance — ten epochs either side of the best epoch",
      },
      note: [
        "The error bars in this paper are unusually tight. Violent-flow benchmarks in this library typically report ±3 to ±9 across folds; here almost every cell is under ±0.6, and several are ±0%. That is not because the model is unusually stable. It is because the quantity being measured is different.",
        "Section 4 states the procedure plainly: 'accuracy is averaged over a radius of 10 epochs around the epoch where the model achieved the best result and the standard deviation of the accuracies is calculated.' The mean is centred on a peak, and the peak is identified by looking at the accuracy on the data being reported. The ± is how much the number moved over twenty consecutive epochs of the same run near its best point.",
        "Two things follow. First, the headline is a selected-best figure and not a clean held-out estimate — there is no separate validation set anywhere in the paper. Second, the ± carries no information about how the model would behave on new data. Twenty epochs of one training run near convergence are highly correlated with each other; the spread between them is a measure of training noise, not of generalisation. The ±0% on Crowd Violence and Movies means the model sat at 100% for twenty epochs, which is a statement about the benchmark rather than about reliability.",
        "There is a second reading problem, independent of the first. Three of the paper's headline numbers appear twice with two different values. Hockey Fight is 99.83% ±0.52% in Tables 2 and 3, 99.16% ±0.36% in the page-7 text, and '99.9%' in a paragraph on that same page. Crowd Violence is 98.753% ±0.63% in the tables and 97.65% ±0.82% in the same page-7 sentence. RWF-2000 is 84.32% ±0.47% in Table 2 and 85.97% in Table 4. The tables agree with each other and the running text agrees with neither — which is why every figure quoted in this review is taken from a table.",
      ],
      takeaways: [
        "±0.47 means twenty epochs of one run varied by that much near its peak. It does not mean five folds agreed to that precision.",
        "The best epoch is selected on the reported data, with no held-out validation set, so every headline is a selected-best number.",
        "±0% means the model sat at 100% for twenty epochs on a 200- or 246-clip benchmark.",
        "Three headline numbers are printed twice with different values. Prefer the tables: T2, T3 and T4 are mutually consistent, the prose is not.",
      ],
      pdfPage: 6,
    },

    {
      id: "easy-three",
      title: "State of the art on three benchmarks that had already run out of headroom",
      tagline: "T3",
      highlight: {
        label: "Movies",
        value: "100%",
        note: "shared with nine other methods in the same table",
      },
      note: [
        "Table 3 compares the proposed model against fifteen prior methods on Hockey Fight, Crowd Violence and Movies, and it does win all three. It is worth looking at what winning means on each.",
        "Movies is a tie. The proposed model scores 100% ±0%, and so do Rethinking 3DCNN, ConvLSTM, Bi-ConvLSTM, C3D, all three I3D variants and Flow Gated Network. Nine methods at ceiling on 200 film clips is not a result about any of them; it is a result about the dataset.",
        "Hockey Fight is close to the same situation. The top of the table runs 99.83, 98.5, 98.3, 98.1, 98.0 — a five-way cluster inside 1.8 points on 1000 clips of broadcast hockey with a uniform rink background. The paper itself attributes its score here to 'the lack of diversity of samples'.",
        "Crowd Violence is where the margin is real: 98.753% against Rethinking 3DCNN's 97.17% and Bi-ConvLSTM's 96.32%, with the deep baselines otherwise scattered between 84 and 94. It is also, as the previous concept covered, the dataset where the paper's own spatial-only ablation scored 100% and was not carried forward.",
        "The pattern across the table is the one that shows up in every paper in this library: results run backwards against distance from operational footage. Film 100%, broadcast sport 99.83%, in-the-wild crowd video 98.75%. The fourth dataset, the surveillance one, is in a separate table.",
      ],
      takeaways: [
        "Three wins, but one is a nine-way tie at ceiling and another is a five-way cluster inside two points.",
        "Crowd Violence carries the only substantial margin in T3, +1.58 over the next best.",
        "Handcrafted baselines sit 8 to 17 points below the deep ones, which is the gap this table actually establishes.",
        "T3 drops the F1 scores that T2 reported, so the comparison against prior work ranks on accuracy alone.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          hue: 300,
          mode: "outcome",
          metricLabel: "Accuracy",
          datasetLabel: "Dataset",
          baselineId: "scan",
          // T3, p8. Cells the table leaves blank are absent here rather than
          // zeroed, so the readout reports them as not reported.
          datasets: [
            {
              id: "crowd",
              label: "Crowd Violence",
              title: "246 in-the-wild clips — the only real margin",
            },
            {
              id: "hockey",
              label: "Hockey Fight",
              title: "1000 broadcast clips — five methods inside 1.8 points",
            },
            {
              id: "movies",
              label: "Movies",
              title: "200 film clips — ten methods at 100%",
            },
          ],
          models: [
            {
              id: "scan",
              label: "SCan-ConvLSTM (ours)",
              metrics: {
                hockey: { accuracy: 99.83, accuracySd: 0.52 },
                crowd: { accuracy: 98.753, accuracySd: 0.63 },
                movies: { accuracy: 100, accuracySd: 0 },
              },
            },
            {
              id: "i3d-rgb",
              label: "I3D (RGB only)",
              metrics: {
                hockey: { accuracy: 98.5 },
                crowd: { accuracy: 86.67 },
                movies: { accuracy: 100 },
              },
            },
            {
              id: "rethinking-3dcnn",
              label: "Rethinking 3DCNN",
              metrics: {
                hockey: { accuracy: 98.3, accuracySd: 0.81 },
                crowd: { accuracy: 97.17, accuracySd: 0.95 },
                movies: { accuracy: 100, accuracySd: 0 },
              },
            },
            {
              id: "bi-convlstm",
              label: "Bi-ConvLSTM",
              metrics: {
                hockey: { accuracy: 98.1, accuracySd: 0.58 },
                crowd: { accuracy: 96.32, accuracySd: 1.52 },
                movies: { accuracy: 100, accuracySd: 0 },
              },
            },
            {
              id: "fgn",
              label: "Flow Gated Network",
              metrics: {
                hockey: { accuracy: 98 },
                crowd: { accuracy: 88.87 },
                movies: { accuracy: 100 },
              },
            },
            {
              id: "i3d-fusion",
              label: "I3D (Fusion)",
              metrics: {
                hockey: { accuracy: 97.5 },
                crowd: { accuracy: 88.89 },
                movies: { accuracy: 100 },
              },
            },
            {
              id: "convlstm",
              label: "ConvLSTM",
              metrics: {
                hockey: { accuracy: 97.1, accuracySd: 0.55 },
                crowd: { accuracy: 94.57, accuracySd: 2.34 },
                movies: { accuracy: 100, accuracySd: 0 },
              },
            },
            {
              id: "spil",
              label: "SPIL",
              metrics: {
                hockey: { accuracy: 96.8 },
                crowd: { accuracy: 94.5 },
                movies: { accuracy: 98.5 },
              },
            },
            {
              id: "c3d",
              label: "C3D",
              metrics: {
                hockey: { accuracy: 96.5 },
                crowd: { accuracy: 84.4 },
                movies: { accuracy: 100 },
              },
            },
            {
              id: "hough-2dcnn",
              label: "2D CNN + Hough Forests",
              metrics: {
                hockey: { accuracy: 94.6, accuracySd: 0.6 },
                movies: { accuracy: 99, accuracySd: 0.5 },
              },
            },
            {
              id: "bilinski",
              label: "Bilinski & Bremond",
              metrics: {
                hockey: { accuracy: 93.4 },
                crowd: { accuracy: 96.4 },
                movies: { accuracy: 99 },
              },
            },
            {
              id: "mosift-hik",
              label: "MoSIFT + HIK (handcrafted)",
              metrics: {
                hockey: { accuracy: 90.9 },
                movies: { accuracy: 89.5 },
              },
            },
            {
              id: "deniz",
              label: "Deniz et al. (handcrafted)",
              metrics: {
                hockey: { accuracy: 90.1, accuracySd: 0 },
                movies: { accuracy: 98, accuracySd: 0.22 },
              },
            },
            {
              id: "i3d-flow",
              label: "I3D (Flow only)",
              metrics: {
                hockey: { accuracy: 84 },
                crowd: { accuracy: 88.89 },
                movies: { accuracy: 100 },
              },
            },
            {
              id: "vif",
              label: "ViF (handcrafted)",
              metrics: {
                hockey: { accuracy: 82.9, accuracySd: 0.14 },
                crowd: { accuracy: 81.3, accuracySd: 0.21 },
              },
            },
            {
              id: "substantial-derivative",
              label: "Substantial derivative (handcrafted)",
              metrics: {
                crowd: { accuracy: 85.43, accuracySd: 0.21 },
                movies: { accuracy: 96.89, accuracySd: 0.21 },
              },
            },
          ],
        },
        caption:
          "T3, one lane per method, measured against the proposed model. On Movies the bars stack flat at the ceiling; on Crowd Violence they spread across fourteen points. Blank cells report as not reported rather than as zero.",
      },
      pdfPage: 8,
    },

    {
      id: "rwf",
      title: "The one benchmark with headroom, and a comparison that is not like-for-like",
      tagline: "T4",
      highlight: {
        label: "Hockey Fight → RWF-2000",
        value: "99.83% → 84.32%",
        note: "the same model, 15.5 points apart",
      },
      note: [
        "RWF-2000 gets its own table because it is the only one of the four that still discriminates. Two thousand clips of genuine surveillance footage, five seconds each, covering explosion, shooting and attack rather than just fighting — the paper describes it as the most challenging and largest dataset available, and the numbers agree. The proposed model drops 15.5 points from Hockey Fight to RWF-2000, and that gap is the honest measure of what this architecture does on CCTV.",
        "In T4 it lands mid-table. It beats plain ConvLSTM by 8.97, C3D by 3.22 and both the flow-only and two-stream I3D variants. It loses to I3D RGB by a fraction, to Flow Gated Network by 1.28 and to SPIL-mask by 3.33. The paper reports the losses honestly and explains them — SPIL builds 3D point clouds from skeleton poses, Flow Gated Network runs an optical-flow stream — which is more than many papers do.",
        "The comparison itself, however, is not like-for-like, and the paper does not flag it. This model is evaluated with five-fold cross-validation over the whole of RWF-2000. Every baseline in the table is a published figure on RWF-2000's own official held-out split. Cross-validated accuracy over all 2000 clips and held-out accuracy on the official test set are not the same quantity, and a model that trains on 80% of every fold has seen more of the distribution than one trained once on the official training half.",
        "There is also a number problem. T4 lists the proposed model at 85.97; T2 lists the same model on the same dataset at 84.32 ±0.47. The paper never reconciles them. On the lower figure it loses to I3D RGB as well; on the higher one it edges past it. Which of the two is the result is not recoverable from the paper.",
        "Finally, note what beats it. Flow Gated Network is exactly the model the paper dismisses as 'computationally expensive from practical application' to justify its own single-stream design — and it is 1.28 points ahead on the dataset that matters most, at 0.27 M parameters and 94.7 FPS as measured elsewhere in this library.",
      ],
      takeaways: [
        "84.32% on surveillance footage against 99.83% on broadcast hockey. Only the first number tells you anything about deployment.",
        "Mid-table in T4: ahead of ConvLSTM, C3D and two I3D variants, behind Flow Gated Network and both SPIL variants.",
        "The proposed model is cross-validated; every baseline is a held-out figure on the official split. The two are compared directly anyway.",
        "T2 and T4 disagree on this model's own RWF-2000 accuracy by 1.65 points, and the paper reconciles neither.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          hue: 300,
          mode: "outcome",
          metricLabel: "Accuracy",
          datasetLabel: "Reported in",
          baselineId: "scan-t4",
          // T4, p8, plus the same model's T2 figure as a separate lane so the
          // two conflicting values for it are both visible.
          datasets: [
            {
              id: "rwf",
              label: "RWF-2000",
              title: "2000 surveillance clips, official split for the baselines",
            },
          ],
          models: [
            {
              id: "spil-mask",
              label: "SPIL-mask",
              metrics: { rwf: { accuracy: 89.3 } },
            },
            {
              id: "fgn",
              label: "Flow Gated Network",
              metrics: { rwf: { accuracy: 87.25 } },
            },
            {
              id: "spil-space",
              label: "SPIL-space",
              metrics: { rwf: { accuracy: 86.4 } },
            },
            {
              id: "scan-t4",
              label: "SCan-ConvLSTM (ours, T4)",
              metrics: { rwf: { accuracy: 85.97 } },
            },
            {
              id: "i3d-rgb",
              label: "I3D (RGB only)",
              metrics: { rwf: { accuracy: 85.75 } },
            },
            {
              id: "scan-t2",
              label: "SCan-ConvLSTM (ours, T2)",
              metrics: { rwf: { accuracy: 84.32, accuracySd: 0.47 } },
            },
            {
              id: "c3d",
              label: "C3D",
              metrics: { rwf: { accuracy: 82.75 } },
            },
            {
              id: "i3d-two-stream",
              label: "I3D (TwoStream)",
              metrics: { rwf: { accuracy: 81.5 } },
            },
            {
              id: "convlstm",
              label: "ConvLSTM",
              metrics: { rwf: { accuracy: 77 } },
            },
            {
              id: "i3d-flow",
              label: "I3D (Flow only)",
              metrics: { rwf: { accuracy: 75.5 } },
            },
          ],
        },
        caption:
          "T4, with the proposed model entered twice — once at the 85.97 the table prints and once at the 84.32 that T2 prints for the same model on the same dataset. Between those two lanes sits I3D RGB, so which of the paper's own numbers you take decides whether it wins that comparison.",
      },
      pdfPage: 8,
    },

    {
      id: "efficiency",
      title: "One stream is cheaper than two, and that is the entire efficiency argument",
      tagline: "The unmeasured claim",
      highlight: {
        label: "Efficiency figures reported",
        value: "none",
        note: "no parameters, FLOPs, latency, frame rate — and no hardware named at all",
      },
      note: [
        "The efficiency claim is made four separate times. The abstract calls the fusion efficient. Section 4 dismisses Flow Gated Network because 'its two stream learning model is computationally expensive from practical application' and concludes that using RGB alone 'makes SCan-ConvLSTM model suitable for practical surveillance application'. The closing paragraph calls the model 'efficient for violence detection'. The conclusion then lists 'better efficiency' as future work.",
        "Nothing measures it. There is no parameter count, no FLOPs figure, no model size, no inference time and no frame rate anywhere in the paper. More unusually, no hardware is named at all — not a GPU, not a CPU, not a cloud environment. The implementation paragraph gives the optimizer, the learning rate and the batch size and stops. Nothing here could be reproduced as a timing even by someone who wanted to.",
        "The per-clip cost is not determinable even in principle, because the number of frames sampled per clip is never stated. Section 4 says only that frames are resized to 224×224 'followed by sampling'. A recurrent model's cost is linear in the length of the sequence it steps through, and that length is the one hyperparameter the paper omits.",
        "The argument as made is true and very narrow. One stream is cheaper than two. It says nothing about running a full ResNet-50 over every sampled frame at 224×224, then stepping a ConvLSTM whose every cell now carries two extra attention blocks, each of which convolves the input and the previous hidden state. That is not obviously cheap, and the comparison being invited makes it worse: Flow Gated Network, the model called too expensive for practical use, is measured elsewhere in this library at 0.27 M parameters and 94.7 FPS.",
        "For the review's efficiency axis this is claimed-without-evidence rather than refuted — the paper does not contradict itself, it simply never tests the proposition its architectural choice was made to serve.",
      ],
      takeaways: [
        "Four efficiency claims, zero efficiency measurements, and no hardware named anywhere in the paper.",
        "Frames sampled per clip is never stated, so even a rough cost estimate is impossible.",
        "The saving claimed is 'one stream instead of two'. The cost of that one stream — ResNet-50 per frame plus two attention blocks per recurrent step — is never counted.",
        "The model held up as too expensive is the cheaper one on every figure anyone has published for it.",
      ],
      pdfPage: 7,
    },
  ],
};
