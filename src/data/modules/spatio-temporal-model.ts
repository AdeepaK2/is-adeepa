import type { StudyModule } from "@/types/study";

/**
 * Mahmoodi & Nezamabadi-pour (2024), "A spatio-temporal model for violence
 * detection based on spatial and temporal attention modules and 2D CNNs".
 * Pattern Analysis and Applications 27:46.
 *
 * Review extraction only -- no study module has been authored for this paper.
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
};
