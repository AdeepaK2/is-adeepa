import type { StudyModule } from "@/types/study";

/**
 * Mahmoodi & Nezamabadi-pour (2024), "A spatio-temporal model for violence
 * detection based on spatial and temporal attention modules and 2D CNNs".
 * Pattern Analysis and Applications 27:46.
 *
 * Review extraction and study module.
 *
 * Table map, for anyone checking the numbers against the PDF:
 *   T1 p12  dataset description        T5 p15  ablation, feature fusion
 *   T2 p12  implementation details     T6 p15  ablation, STA pooling type
 *   T3 p13  precision/recall/F/AUC     T7 p15  ablation, entropy disk radius
 *   T4 p13  comparison to prior work   T8 p16  ablation, ESM removed
 *   F8 p13  summed confusion matrices
 *
 * Method figures: F1 p6 (whole architecture), F2 p6 (ESM), F4 p9 (STA block),
 * F5 p10 (the 2D CNN with feature fusion). Section 5.4, "Computational
 * complexity", runs p14-p15 and contains no measurement of this model -- see
 * the efficiency notes.
 */
export const moduleSpatioTemporal: StudyModule = {
  slug: "spatio-temporal-model",

  premise:
    "3D CNNs and two-stream networks read motion well and cost a great deal to run. This paper's bet is that you can keep an ordinary 2D CNN and hand it the time axis instead: an entropy filter over frame differences marks where movement is, a squeeze-and-excitation block weights sixteen sampled frames and then collapses them into three channels, and a small 2D CNN classifies the result as if it were a single image. It wins clearly on Surveillance Fight, ties or loses on the other three, and never measures the efficiency it is arguing for.",

  results: [
    { label: "Surveillance Fight", value: "98.44%", note: "±6.9, best in T4 by 5.34" },
    { label: "Hockey Fight", value: "99.7%", note: "±1.44, second to Violence 4D's 100" },
    { label: "Violent Flows", value: "98.53%", note: "±6.83, third of eleven in T4" },
    { label: "Cost", value: "not reported", note: "no parameters, FLOPs or FPS anywhere" },
  ],

  review: {
    architecture: {
      family: "2D CNN + Attention",
      backbone:
        "A three-layer 2D CNN trained from scratch: 10 filters at 5×5, then 20 and 30 at 3×3, each followed by 2×2-stride max-pooling and batch normalisation. ELU throughout, 20% dropout. No pre-trained backbone anywhere in the model.",
      motionEncoding:
        "By frame differencing, twice, before the network ever runs. The ESM takes |G_t − G_(t−1)| between consecutive greyscale frames, weights it by a local-entropy map of that same difference, and adds the result back onto G_(t−1) -- so motion arrives as brightened pixels in an otherwise static frame. The STA block then stacks sixteen of those frames as channels and learns a weight per channel. There is no 3D kernel, no recurrence and no optical flow: after the squeeze the time axis is gone, and the classifier sees one three-channel image.",
      inputs: [
        "Greyscale frames and their consecutive differences -- the ESM works on |G_t − G_(t−1)|, not on colour",
        "Sixteen ESM output frames per clip, chosen at random from the T−1 available, stacked as a W×H×16 tensor",
        "Resolution is set per dataset, not globally: 60×90 Hockey Fight, 50×80 Violent Flows, 100×180 Action Movies, 100×198 Surveillance Fight (T2)",
      ],
      fusion:
        "Two kinds, and the paper uses one word for both. Temporal fusion is the squeeze: a 1×1 convolution with three ELU filters collapses W×H×16 to W×H×3. Feature fusion is inside the classifier -- a flatten-plus-dense branch (300 then 100 units) runs alongside the convolutional branch and the two are concatenated, then passed through dense layers of 300, 100 and 2 with softmax.",
      supervision:
        "Supervised binary classification, one label per clip, violent / non-violent. Trained from scratch with RMSProp at lr 0.0001; batch 64 on Hockey Fight and 48 on the other three (T2).",
      notes: [
        "The squeeze to three channels is the load-bearing idea, and it is what makes the 2D-CNN claim work at all: sixteen frames become an RGB-shaped tensor, so an image classifier can take a video. What it costs is everything past the sixteenth frame -- the model has no mechanism for a clip longer than the window it sampled.",
        "Frame selection is random, not learned and not ordered. Section 4.2 picks sixteen of the h_t 'randomly ... to lower the processing time and deal with the hardware limitations'. The temporal attention weights are therefore applied to an arbitrary subset, and nothing in the model knows what order those sixteen frames were in.",
        "The ESM has no learned parameters. The entropy filter, the disk-shaped structuring element of radius 9 and the frame differencing are all fixed operations chosen by hand -- T7 tunes the radius by comparing accuracy at 5, 7 and 9.",
        "Input resolution differs per dataset (T2), and the fusion branch flattens a feature map into a 300-unit dense layer. The model therefore has a different size on each of the four datasets. The paper never reports any of the four.",
        "The whole design is explicitly a cost argument -- the abstract's case against 3D CNNs and multi-stream networks is that they 'require a lot of parameters ... and have high computational complexity'. That argument is never closed with a measurement of this model.",
      ],
    },

    attention: {
      used: true,
      kinds: ["spatial", "temporal"],
      mechanisms: [
        {
          name: "Entropy Spatial Module (ESM)",
          placement:
            "Before the network, on the raw frames. Operates on each consecutive greyscale pair and emits one map per pair, which is what the rest of the model consumes.",
          reportedEffect:
            "Removing it drops accuracy from 98.53 to 97.25 on Violent Flows and 98.44 to 97.1 on Surveillance Fight (T8). The ablation replaces it with plain frame differences, so the +1.28 and +1.34 measure the entropy weighting, not differencing itself.",
        },
        {
          name: "Temporal attention part of the STA block",
          placement:
            "On the W×H×16 stack of ESM frames, immediately before the squeeze convolution. Global average pooling over space, a 2-unit ReLU dense layer, a 16-unit sigmoid dense layer, then per-frame multiplication. Both dense layers carry 30% dropout.",
          reportedEffect:
            "Never isolated. No ablation removes the temporal attention; T6 only swaps its global average pooling for global max pooling, which moves accuracy by 0.34 and 0.46 points. The module's own contribution is unmeasured.",
        },
      ],
      notes: [
        "This is a squeeze-and-excitation block with time in the channel slot. Global pool, bottleneck to 2, expand to 16, sigmoid, rescale -- the standard SE recipe, applied to a tensor whose sixteen channels happen to be frames. The paper's own introduction calls it 'a channel attention module' before Section 4.2 renames it temporal attention; both descriptions are of the same block.",
        "Both mechanisms are content-dependent rather than hand-set priors: the entropy map is recomputed per frame pair and the frame weights come from the clip's own pooled statistics. The ESM is unusual in doing that with zero learned parameters -- it is attention computed by a fixed formula, not by a trained one, which is why the authors can claim the spatial attention costs nothing.",
        "Neither module is self-attention and nothing computes a frame-to-frame or region-to-region relation. Every weight is produced independently per frame or per pixel, so no interaction between two distant moments is representable.",
        "The two mechanisms are what the paper is selling, and only one of them is measured. The ESM ablation (T8) is clean; the temporal attention has no corresponding row anywhere in the paper.",
      ],
    },

    efficiency: {
      parameters: undefined,
      flops: undefined,
      modelSize: undefined,
      throughput: undefined,
      hardware: "Google Colab, in Python/Keras (§5.2). Tier and accelerator are not stated, and no timing is measured on it.",
      realTime: {
        status: "claimed-without-evidence",
        note: "The abstract opens on real-time detection as the requirement, and the introduction states that reducing parameters 'makes the model more practical for real-time applications'. Nothing measures it. There is no inference time, no frame rate, no latency figure and no wall-clock number of any kind in the paper, on any of the four datasets or any hardware.",
      },
      edgeDeployment: {
        status: "not-addressed",
        note: "No edge, embedded or on-camera deployment is discussed. No memory footprint, power draw or accelerator is named, and the only compute environment mentioned is Google Colab.",
      },
      notes: [
        "Section 5.4 is titled 'Computational complexity' and contains no measurement. It derives the cost of a 3D convolution, D_k³ × W_b × H_b × l_b × C_b × C_a, and of a 2D convolution, D_k² × W_b × H_b × C_b × C_a, and concludes that 3D CNNs 'have more parameters and higher complexity than 2D CNNs'. That is a statement about the two operators in general, true before this paper was written. It says nothing about how this model compares to any specific 3D CNN it is benchmarked against.",
        "The efficiency claim is thus entirely relative and entirely unquantified. Every comparison in T4 is on accuracy alone; not one baseline is compared on parameters, FLOPs or speed, including the ones the discussion criticises for having 'an excessive number of parameters' and 'too many parameters because of ResNet50'.",
        "The ESM is uncosted pre-processing, and it is not cheap. A local-entropy filter over a disk of radius 9 is a sliding-window histogram at every pixel of every frame difference, run outside the network on every frame of every clip. The paper's cost argument covers the convolutional operator and stops there.",
        "The classifier's parameter count is likely dominated by dense layers, not convolutions -- three conv layers of 10, 20 and 30 filters against dense layers of 300 and 100 units fed from flattened feature maps, on inputs up to 100×198. That makes the 2D-versus-3D convolution argument in §5.4 an argument about the smaller half of the model. None of it is reported, so this is a structural observation, not a number.",
        "Sixteen frames per clip is a fixed budget regardless of clip length, which does bound inference cost -- on Violent Flows, where clips run to 169 frames, the model reads sixteen of them. Worth noting as a genuine efficiency property, and one the paper does not claim.",
      ],
    },

    evaluation: {
      datasets: [
        {
          name: "Hockey Fight",
          role: "evaluation",
          note: "1000 clips, 500 violent, 40-49 frames each (avg 41), 288×360 (T1). Resized to 60×90. Broadcast sport, not surveillance.",
        },
        {
          name: "Crowd Violence",
          role: "evaluation",
          note: "Called 'Violent Flows' throughout, citing Hassner et al. 246 clips, evenly split, 26-169 frames (avg 89), 240×320 (T1). Resized to 50×80. Crowd scenes -- riots, sports clashes -- and the dataset this model is weakest on relative to its competitors.",
        },
        {
          name: "Movies",
          role: "evaluation",
          note: "Called 'Action Movies'. 200 clips, evenly split, 42-60 frames, 576×720 (T1). Resized to 100×180. Fight scenes cut from action films; the furthest of the four from operational CCTV, and the one where four separate methods including this one all reach 100%.",
        },
        {
          name: "Surveillance Camera Fight",
          role: "evaluation",
          note: "Called 'Surveillance Fight', citing Akti et al. 300 clips, evenly split, 20-142 frames (avg 57), mixed resolutions (T1). Resized to 100×198. Real surveillance footage, the closest of the four to the deployment case, and the only dataset where this model clearly leads.",
        },
      ],
      split:
        "Five-fold cross-validation, repeated six times, for thirty runs per dataset; accuracy is reported as the mean over those thirty with a standard deviation. T2's sample counts are cumulative over the thirty runs -- 6000 test and 24,000 train on Hockey Fight is 200 and 800 clips per fold, thirty times over. There is no held-out validation set on any dataset.",
      metrics: [
        "Accuracy",
        "Standard deviation over 30 runs",
        "Precision",
        "Recall",
        "F-score",
        "AUC",
        "Summed confusion matrix (F8)",
      ],
      protocolNotes: [
        "The metric set is better than most in this library. Precision, recall, F-score and AUC are all reported per dataset in T3, and F8 gives the summed confusion matrices -- so the false-positive behaviour that an alarm actually turns on is visible, not hidden behind an accuracy figure. Violent Flows precision 97.97 against recall 99.04; Surveillance Fight 98.1 against 98.76.",
        "There is no validation set, and every design choice was made by comparing on the cross-validated test folds. The disk radius of 9 (T7), global average over max pooling (T6), and the feature-fusion branch (T5) are all selected on the same Violent Flows and Surveillance Fight numbers that are then reported as results. The headline figures are selected-best, not held-out.",
        "The standard deviations are large enough to swallow the margins. Violent Flows is 98.53 ±6.83 and Surveillance Fight 98.44 ±6.9 -- a spread that size means individual folds land in the eighties. Against that, T7's radius sweep spans 0.88 points and T6's pooling swap 0.34, and neither difference is separable from the run-to-run variance the paper itself reports.",
        "The 'superior performance' claim in the abstract and conclusion holds on one dataset of four, by the paper's own T4. On Surveillance Fight it leads by 5.34 points over the next best (93.1). On Action Movies it reaches 100 and so do three other methods. On Hockey Fight, Violence 4D scores 100 against its 99.7. On Violent Flows it is third, behind EVOKEYNET+DEEPKEYFRM at 99.29 and Dual stream CNN + echo state network at 99.01.",
        "To the authors' credit, §5.3's discussion concedes each of those losses explicitly and names the winning method in every case, including the observation that multi-stream architectures are better suited to crowded scenes. It is the abstract and the conclusion that make the claim without qualification, not the analysis.",
        "The sixteen frames the model reads are drawn at random per run, so the thirty-run spread mixes fold variance with sampling variance. Nothing separates the two, and no experiment varies the number of frames.",
        "No cross-dataset test anywhere. Each dataset is trained and tested on itself, at its own input resolution, so the four results describe four separately-fitted models rather than one model's generality.",
        "Three of the four datasets are staged, filmed or broadcast rather than operational -- hockey broadcast, action films, and crowd footage. Surveillance Camera Fight is the one that matches the stated deployment, and it is the hardest of the four for every method in T4.",
        "T4 leaves cells blank rather than filling them, which is the honest thing to do, but it also means most baselines are compared on one or two datasets only. Just two prior methods carry a Surveillance Fight number at all.",
      ],
    },
  },

  concepts: [
    {
      id: "squeeze",
      title: "Sixteen frames go in, three channels come out, and the clock stops",
      tagline: "The squeeze",
      highlight: {
        label: "STA squeeze",
        value: "W×H×16 → W×H×3",
        note: "one 1×1 convolution, three ELU filters",
      },
      note: [
        "Every architecture in this library has to answer one question before anything else: how does time get into the representation. 3D CNNs answer it with kernels that span several frames. Recurrent models answer it with a state carried between steps. Two-stream models answer it by computing optical flow outside the network and feeding it in as a second input.",
        "This paper answers it by getting rid of time. Sixteen processed frames are stacked as a W×H×16 tensor, a temporal attention block weights each of the sixteen, and then a 1×1 convolution with three output filters collapses the whole stack into W×H×3. Three channels is not an arbitrary number — it is the shape an ordinary image classifier expects. After the squeeze the tensor is indistinguishable from a colour photograph, and the 2D CNN that follows has no idea it is looking at a video.",
        "This is why the paper can claim a 2D backbone honestly. The spatiotemporal modelling all happens before the first convolution, in a block with almost no weights, and everything expensive downstream operates on a single image.",
        "What it costs is everything past the sixteenth frame. Violent Flows clips run to 169 frames; the model reads sixteen of them, drawn at random, and has no mechanism for a longer clip beyond sampling a different sixteen. Nothing in the model records what order those frames were in either — after the squeeze, a shuffled clip and an ordered one produce the same three channels.",
      ],
      takeaways: [
        "The time axis is consumed by a 1×1 convolution before the classifier runs. No 3D kernel, no recurrence, no optical flow anywhere in the model.",
        "Three output channels is chosen to match an RGB-shaped input, not for any property of the data.",
        "Sixteen frames is a fixed budget regardless of clip length — a genuine efficiency property, and one the paper never claims.",
        "The frames are picked at random and their order is discarded, so the temporal attention weights an arbitrary unordered subset.",
      ],
      visual: {
        kind: "volume-grid",
        options: {
          mode: "wave",
          size: [8, 5, 16],
          hue: 25,
          speed: 0.5,
        },
        caption:
          "The tensor the STA block receives: width and height across the face, the sixteen sampled ESM frames running back into the screen. The squeeze convolution flattens that whole depth to three, and every layer after it is an ordinary 2D CNN.",
      },
      pdfPage: 7,
    },

    {
      id: "esm",
      title: "Spatial attention with nothing to train",
      tagline: "Entropy Spatial Module",
      highlight: {
        label: "ESM removed (T8)",
        value: "−1.28 / −1.34",
        note: "Violent Flows / Surveillance Fight",
      },
      note: [
        "Most attention modules in this field are small neural networks: pool, bottleneck, expand, sigmoid, learn the weights by backpropagation. The ESM is not. It is three fixed operations with no parameters at all.",
        "Take the absolute difference of two consecutive greyscale frames. Run a local-entropy filter over that difference, using a disk-shaped window of radius 9 — high entropy where the neighbourhood is textured or busy, low where it is smooth. Multiply the entropy map elementwise back onto the difference, then add the result to the earlier frame. What comes out is the original scene with the moving, textured regions brightened.",
        "Calling this attention is fair on the definition that matters: the weights are computed from the content, per frame pair, rather than fixed in advance the way a crop or a centre bias would be. What is unusual is that the formula producing them was chosen by hand and never updated by training. The authors get a content-dependent spatial mask for zero learned parameters, which is exactly what lets them argue the module is free.",
        "The ablation for it is clean, and rarer than it should be. Table 8 swaps the ESM for plain frame differences and keeps everything else, so the 1.28 and 1.34 points measure the entropy weighting itself and not the differencing underneath it. Table 7 then sweeps the disk radius over 5, 7 and 9 — the gain is real, but its size is inside the run-to-run spread the same tables report.",
      ],
      takeaways: [
        "Frame difference → local entropy filter (disk radius 9) → elementwise product → add back to the previous frame. No learned weights at any step.",
        "T8 is a fair ablation: the control is plain frame differencing, so the delta isolates the entropy term rather than motion encoding as a whole.",
        "Free at training time is not free at inference time. A sliding-window entropy histogram at every pixel of every frame is real work, and it happens outside the network where the paper's cost argument never reaches.",
        "The radius sweep is not monotonic across datasets: on Surveillance Fight radius 5 (98.22) beats radius 7 (98.16), and 9 wins by 0.22 over 5.",
      ],
      pdfPage: 6,
    },

    {
      id: "ablations",
      title: "Every component is ablated except the one the title names",
      tagline: "T5-T8, and a gap",
      highlight: {
        label: "Largest single ablation effect",
        value: "+1.90",
        note: "feature fusion on Violent Flows — a classifier trick, not an attention module",
      },
      note: [
        "The paper runs four ablations, both on Violent Flows and on Surveillance Fight. Remove the feature-fusion branch from the classifier (T5). Swap the STA block's global average pooling for global max pooling (T6). Change the entropy disk radius (T7). Replace the ESM with plain frame differences (T8). Every one of them moves accuracy in the expected direction, and the paper reports each with its standard deviation.",
        "There is one row missing, and it is the one the title is about. Nothing anywhere in the paper removes the temporal attention. T6 changes how it pools and finds a 0.34 and 0.46 point difference, which tells you the pooling choice barely matters — but it never asks what happens if the sixteen frames are squeezed without being weighted first. The temporal half of 'spatial and temporal attention modules' has no measurement of its own contribution.",
        "The other thing the table shows is which piece is actually earning. The biggest single effect in the whole ablation set is feature fusion, worth 1.90 points on Violent Flows — larger than the ESM's 1.28, and larger than anything the two attention modules produce. Feature fusion is a second flatten-plus-dense branch running alongside the convolutional one and concatenated with it. It is a classifier-side trick, not a spatiotemporal idea, and it is the strongest component in the paper.",
        "Read all of it against the standard deviations in the same cells. Violent Flows results carry a spread of ±6.8 to ±8.9 across thirty runs. Every one of these ablation deltas is smaller than that spread, which does not make them wrong — the mean over thirty runs is a much tighter quantity than a single run — but it does mean no individual fold would have told you any of this.",
      ],
      takeaways: [
        "Four ablations, two datasets each, all reported with standard deviations. That is more thorough than most papers in this library.",
        "No ablation removes the temporal attention. T6's pooling swap is the closest thing, and it holds the module in place.",
        "Feature fusion (+1.90 on Violent Flows) outweighs the ESM (+1.28) and dwarfs the pooling choice (+0.34).",
        "Every ablation was measured on the same cross-validated folds the headline results come from, so these are selections made on the test set.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          hue: 25,
          mode: "outcome",
          metricLabel: "Accuracy",
          datasetLabel: "Dataset",
          baselineId: "full",
          // T5 p15, T6 p15, T7 p15, T8 p16. Both ablation datasets only -- the
          // paper runs no ablation on Hockey Fight or Action Movies.
          datasets: [
            {
              id: "violent-flows",
              label: "Violent Flows",
              title: "246 crowd clips, the paper's hardest ablation set",
            },
            {
              id: "surveillance-fight",
              label: "Surveillance Fight",
              title: "300 real surveillance clips",
            },
          ],
          models: [
            {
              id: "full",
              label: "Proposed (full)",
              metrics: {
                "violent-flows": { accuracy: 98.53, accuracySd: 6.83 },
                "surveillance-fight": { accuracy: 98.44, accuracySd: 6.9 },
              },
            },
            {
              id: "no-fusion",
              label: "− feature fusion",
              metrics: {
                "violent-flows": { accuracy: 96.63, accuracySd: 8.88 },
                "surveillance-fight": { accuracy: 97.7, accuracySd: 6.49 },
              },
            },
            {
              id: "no-esm",
              label: "− ESM (frame differences only)",
              metrics: {
                "violent-flows": { accuracy: 97.25, accuracySd: 7.72 },
                "surveillance-fight": { accuracy: 97.1, accuracySd: 8.5 },
              },
            },
            {
              id: "max-pool",
              label: "STA with global max pooling",
              metrics: {
                "violent-flows": { accuracy: 98.19, accuracySd: 7.92 },
                "surveillance-fight": { accuracy: 97.98, accuracySd: 7.97 },
              },
            },
            {
              id: "radius-7",
              label: "entropy disk radius 7",
              metrics: {
                "violent-flows": { accuracy: 98.25, accuracySd: 7.44 },
                "surveillance-fight": { accuracy: 98.16, accuracySd: 7.56 },
              },
            },
            {
              id: "radius-5",
              label: "entropy disk radius 5",
              metrics: {
                "violent-flows": { accuracy: 97.65, accuracySd: 8.55 },
                "surveillance-fight": { accuracy: 98.22, accuracySd: 8.96 },
              },
            },
            // No metrics on purpose. The paper runs no ablation that removes
            // the temporal attention, so both datasets read "not reported".
            {
              id: "no-temporal-attention",
              label: "− temporal attention",
            },
          ],
        },
        caption:
          "Every ablation the paper reports, measured against the full model. Whiskers are the standard deviation over thirty runs, from the same cells. The last lane is empty on purpose: removing the temporal attention is the one experiment the paper does not run.",
      },
      pdfPage: 15,
    },

    {
      id: "comparison",
      title: "Superior performance, on one dataset out of four",
      tagline: "T4 read carefully",
      highlight: {
        label: "Surveillance Fight",
        value: "+5.34",
        note: "98.44 against the next best 93.1 — and behind on two of the other three",
      },
      note: [
        "The abstract and the conclusion both say the method achieves superior performance. The paper's own comparison table says something more specific and more interesting.",
        "On Surveillance Fight the claim is unambiguous and large. 98.44% against 93.1% for the next best method, a lead of 5.34 points, on the only one of the four datasets made of real surveillance footage — and the one where every other method in the table struggles, with two of the four entries sitting in the seventies. If a single number in this paper matters, it is this one.",
        "The other three are ties or losses. Action Movies is 100%, and so are three other rows — the dataset is saturated and has been for years. Hockey Fight is 99.7% against Violence 4D's 100%. Violent Flows is 98.53%, which is third of the eleven methods carrying a number in that column, behind EVOKEYNET + DEEPKEYFRM at 99.29 and a dual-stream CNN with an echo state network at 99.01.",
        "The discussion section, to the authors' credit, concedes every one of those losses by name and offers a reason for the Violent Flows result: crowd scenes with occlusion and clutter suit multi-stream architectures better than a single squeezed stream. That analysis is honest. It is the abstract and the conclusion that drop the qualification.",
        "One structural caveat on the whole table. Most cells are blank, because most prior work reports on Hockey Fight and Action Movies and stops. Only four other methods carry a Surveillance Fight number at all, so the dataset this paper wins on is also the one with the thinnest comparison behind it.",
      ],
      takeaways: [
        "One clear win (Surveillance Fight, +5.34), one saturated tie (Action Movies, 100% shared four ways), two losses (Hockey Fight and Violent Flows).",
        "The win is on the dataset closest to real deployment, which makes it the most meaningful of the four despite being the only one.",
        "Comparisons are on accuracy alone. Not one baseline in T4 is compared on parameters, FLOPs or speed — including the ones the discussion criticises for having too many parameters.",
        "Blank cells outnumber filled ones. Read a lead over four methods differently from a lead over fourteen.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          hue: 25,
          mode: "outcome",
          metricLabel: "Accuracy",
          datasetLabel: "Dataset",
          baselineId: "proposed",
          // T4, p13. Blank cells in the table are left absent here, so the
          // readout reports them as not reported rather than implying a zero.
          datasets: [
            {
              id: "surveillance-fight",
              label: "Surveillance Fight",
              title: "300 real surveillance clips — the only clear win",
            },
            {
              id: "violent-flows",
              label: "Violent Flows",
              title: "246 crowd clips — third of eleven",
            },
            {
              id: "hockey",
              label: "Hockey Fight",
              title: "1000 broadcast hockey clips",
            },
            {
              id: "action-movies",
              label: "Action Movies",
              title: "200 film clips — saturated at 100%",
            },
          ],
          models: [
            {
              id: "proposed",
              label: "Proposed method",
              metrics: {
                hockey: { accuracy: 99.7, accuracySd: 1.44 },
                "violent-flows": { accuracy: 98.53, accuracySd: 6.83 },
                "action-movies": { accuracy: 100 },
                "surveillance-fight": { accuracy: 98.44, accuracySd: 6.9 },
              },
            },
            {
              id: "violence-4d",
              label: "Violence 4D",
              metrics: {
                hockey: { accuracy: 100 },
                "violent-flows": { accuracy: 97.29 },
                "action-movies": { accuracy: 100 },
              },
            },
            {
              id: "evokeynet",
              label: "EVOKEYNET + DEEPKEYFRM",
              metrics: {
                hockey: { accuracy: 98.98 },
                "violent-flows": { accuracy: 99.29 },
              },
            },
            {
              id: "dual-stream-esn",
              label: "Dual stream CNN + echo state network",
              metrics: {
                hockey: { accuracy: 99 },
                "violent-flows": { accuracy: 99.01 },
                "surveillance-fight": { accuracy: 93.1 },
              },
            },
            {
              id: "3dcnn-interest-frames",
              label: "3D CNN + interest frames",
              metrics: {
                hockey: { accuracy: 99.4, accuracySd: 0.73 },
                "violent-flows": { accuracy: 97.49, accuracySd: 3.32 },
                "action-movies": { accuracy: 100 },
              },
            },
            {
              id: "two-cascade-tsm",
              label: "Two-cascade TSM",
              metrics: {
                hockey: { accuracy: 98.995 },
                "violent-flows": { accuracy: 97.959 },
              },
            },
            {
              id: "modified-3dcnn",
              label: "Modified 3D CNN",
              metrics: {
                hockey: { accuracy: 98.96 },
                "action-movies": { accuracy: 99.97 },
              },
            },
            {
              id: "edge-vision",
              label: "Edge Vision",
              metrics: {
                hockey: { accuracy: 98.5 },
                "surveillance-fight": { accuracy: 75.9 },
              },
            },
            {
              id: "objdet-lstm",
              label: "Object detection + LSTM",
              metrics: {
                hockey: { accuracy: 98 },
                "violent-flows": { accuracy: 98.21 },
                "surveillance-fight": { accuracy: 74 },
              },
            },
            {
              id: "vision-based-fight",
              label: "Vision-based fight detection",
              metrics: {
                hockey: { accuracy: 98 },
                "action-movies": { accuracy: 100 },
                "surveillance-fight": { accuracy: 72 },
              },
            },
            {
              id: "objdet-3dcnn",
              label: "Object detection + 3D CNN",
              metrics: {
                hockey: { accuracy: 96 },
                "violent-flows": { accuracy: 98 },
                "action-movies": { accuracy: 99.9 },
              },
            },
            {
              id: "hough-2dcnn",
              label: "Hough forest + 2D CNN",
              metrics: {
                hockey: { accuracy: 94.6, accuracySd: 0.6 },
                "action-movies": { accuracy: 99, accuracySd: 0.5 },
              },
            },
            {
              id: "homo",
              label: "HOMO (handcrafted)",
              metrics: {
                hockey: { accuracy: 89.3, accuracySd: 0.91 },
                "violent-flows": { accuracy: 76.83, accuracySd: 1.76 },
              },
            },
            {
              id: "ovif",
              label: "OViF (handcrafted)",
              metrics: {
                hockey: { accuracy: 84.2, accuracySd: 3.33 },
                "violent-flows": { accuracy: 76.8, accuracySd: 3.9 },
              },
            },
            {
              id: "vif",
              label: "ViF (handcrafted)",
              metrics: {
                hockey: { accuracy: 81.6, accuracySd: 0.22 },
                "violent-flows": { accuracy: 81.2, accuracySd: 1.79 },
              },
            },
          ],
        },
        caption:
          "T4 in full, one lane per method, measured against the proposed model. Switch datasets to watch the lead appear and disappear. Lanes that report nothing on a dataset say so rather than showing a bar — most of this table is blank, and that shapes what the comparison can mean.",
      },
      pdfPage: 13,
    },

    {
      id: "cost",
      title: "A section called Computational complexity that never measures this model",
      tagline: "The unclosed argument",
      highlight: {
        label: "Efficiency figures reported",
        value: "none",
        note: "no parameters, FLOPs, model size, latency or frame rate, on any dataset",
      },
      note: [
        "The entire premise is a cost argument. 3D CNNs and multi-stream networks are said to require a lot of parameters and have high computational complexity; the proposed design replaces them with a 2D CNN so that violence detection becomes practical for real-time use. Section 5.4 is where that argument should close.",
        "What Section 5.4 contains is the algebraic cost of a 3D convolution, D_k³ × W_b × H_b × l_b × C_b × C_a, the cost of a 2D convolution, D_k² × W_b × H_b × C_b × C_a, and the observation that the first has an extra dimension and is therefore larger. That is true of the two operators in general and was true long before this paper. It says nothing about how this model compares to any specific network in Table 4.",
        "Nothing else in the paper fills the gap. There is no parameter count, no FLOPs figure, no model size, no inference time and no frame rate — not for the proposed model, not for any baseline, on any of the four datasets. The only compute environment named is Google Colab, with no tier and no accelerator, and no timing is taken on it.",
        "Two details make the missing number harder to guess than usual. The input resolution changes per dataset, and the fusion branch flattens a feature map straight into a 300-unit dense layer — so the model has four different sizes and its weight count is probably dominated by dense layers rather than by the three convolutional layers Section 5.4's argument is about. And the ESM runs outside the network on every frame of every clip, a sliding-window entropy histogram per pixel, which the convolution-operator comparison does not cover at all.",
        "For the review's efficiency axis this lands as claimed-without-evidence, and it is worth being precise about what that means. The design is plausibly cheap. Three convolutional layers with 10, 20 and 30 filters over inputs no larger than 100×198, reading sixteen frames per clip, is a small model by any standard in this library. The objection is not that the claim is false — it is that a paper whose entire contribution is efficiency reports not one efficiency measurement.",
      ],
      takeaways: [
        "Section 5.4 compares two convolution operators in the abstract. It never instantiates either with this model's dimensions.",
        "Zero efficiency numbers appear anywhere in the paper, for the proposed model or for any of the fourteen baselines it is compared against.",
        "The ESM's entropy filtering is uncosted pre-processing, outside the scope of the operator comparison entirely.",
        "Four input resolutions means four model sizes, none of them reported. A single parameter count would not even have been enough.",
      ],
      pdfPage: 14,
    },
  ],
};
