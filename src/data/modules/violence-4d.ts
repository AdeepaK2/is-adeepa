import type { StudyModule } from "@/types/study";

/**
 * Magdy, Fakhr & Maghraby (2023), "Violence 4D: Violence detection in
 * surveillance using 4D convolutional neural networks". IET Computer Vision
 * 17(3):282-294. DOI 10.1049/cvi2.12162. Received 5 September 2022, accepted
 * 23 November 2022.
 *
 * This extraction required more arithmetic checking than any other paper in the
 * library. Four of its reported results do not follow from the figures it says
 * they were computed from, and two of its ablation tables contain the same four
 * numbers. Every discrepancy below was recomputed from the paper's own counts
 * before being recorded, and both readings are kept wherever they disagree.
 *
 * Table and figure map (physical PDF pages, 1-based):
 *   F1  p4   Violence 4D architecture       F12 p9   Crowd confusion matrix
 *   F2  p4   4D residual block              F13 p9   Movie train/val curves
 *   F3  p5   dense optical flow             F14 p9   Movie confusion matrix
 *   F4  p6   I3D-slowpath of ResNet50       T2  p9   per-dataset metrics
 *   T1  p7   dataset statistics             T3  p10  comparison with prior work
 *   F5  p7   ROI crop samples               T4  p10  optimiser sweep
 *   F6  p7   RWF2000 train/val curves       T5  p10  sampling method
 *   F7  p8   RWF2000 confusion matrix       T6  p10  cropping method
 *   F8  p8   accuracy bar chart             T7  p10  backbone with/without 4D
 *   F9  p8   Hockey train/val curves        T8  p11  4D kernel shape
 *   F10 p8   Hockey confusion matrix        T9  p11  4D block placement
 *   F11 p8   Crowd train/val curves         T10 p11  number of action units U
 */
export const moduleViolence4d: StudyModule = {
  slug: "violence-4d",

  premise:
    "A 3D CNN sees one clip at a time. Whatever happens between clips — the approach, the swing, the aftermath — is outside its receptive field entirely, because the clip is where its time axis ends. Violence 4D borrows V4D's answer from action recognition: sample several short clips across the whole video, call them action units, and add a fourth axis over them so a kernel can reach across clips as well as within one. The idea is sound and the accuracy is competitive. The difficulty is that the paper's numbers do not survive being added up.",

  results: [
    { label: "RWF-2000", value: "94.67%", note: "T2 · but every ablation table says 94.75" },
    { label: "Hockey / Movies", value: "100%", note: "T2, on 150 and 60 test clips" },
    { label: "Cost reported", value: "none", note: "no params, FLOPs, FPS or hardware" },
  ],

  review: {
    architecture: {
      family: "3D CNN",
      backbone:
        "3D ResNet-50, in the I3D slow-path configuration of Figure 4, initialised from ImageNet weights. ResNet-18 appears throughout the ablations as the smaller comparison backbone. The 4D residual blocks are additions to this backbone rather than a replacement for it — the 3D stack is trained first and the 4D blocks are grafted on afterwards.",
      motionEncoding:
        "In two tiers, over two different time axes. Inside an action unit, motion is captured the ordinary 3D way: 3D convolution kernels spanning the unit's 8 frames. Between action units, a 4D residual block convolves along a new fourth axis U whose elements are whole clips sampled from across the video, so a single kernel reaches across footage minutes apart in a way no 3D kernel in the stack can. Dense optical flow (Farnebäck) is computed separately, but only to pick where to crop — it never enters the network as a channel or a stream. The paper's own future work proposes adding flow as an input, confirming it is not one here.",
      inputs: [
        "RGB frames only, resized to 320×256 and cropped to 256×256 on the optical-flow region of interest",
        "4 action units per video × 8 frames each = 32 frames, the configuration behind every headline number (T10)",
        "The tensor entering a 4D convolution is C×U×T×H×W; the extra axis U is the paper's whole contribution",
      ],
      fusion:
        "No multi-modal fusion — there is one RGB stream and nothing to fuse it with. What the paper calls fusion is the aggregation along U: action units pass independently through the shared 3D convolution layers, meet inside the 4D residual blocks, and are finally combined by global average pooling over all units before the fully connected layer and softmax.",
      supervision:
        "Supervised binary classification, violent / non-violent, softmax over two classes. SGD, momentum 0.9, learning rate 0.001, 70 epochs, trained in three stages: 3D ResNet-50 on 8-frame inputs, then weights transferred into Violence 4D with all 4D blocks initialised to zero, then fine-tuning on 8×4 inputs, then the 4D blocks unfrozen. The paper attributes this staging to resource constraints.",
      notes: [
        "Almost nothing here is original. The 4D convolution, the 4D residual block, its factorisation into 3D convolutions via Equations 1 and 2, and the action-unit sampling are all taken from V4D (Guo et al., ICLR 2020, ref. 38). The paper's contribution is applying that architecture to violence detection and adding the optical-flow crop. It is transparent that V4D is the source but does not separate its own delta from the borrowed design anywhere.",
        "Equation 3's mechanism is worth reading closely, because it is what makes the design cheap enough to run: X_3D is permuted from U×C×T×H×W to C×U×T×H×W so a 4D kernel can address it, and permuted back afterwards. Folding U into the batch dimension is what lets an ordinary 3D CNN implementation execute a 4D convolution — no 4D primitive is required.",
        "The paper's motivation against 3D CNNs is that they 'give a huge number of model parameters' (§2.2, repeated in §5). Its response is to add a fourth dimension on top of one, and it never reports a parameter count for anything. §4.4.4 then justifies choosing the 3×3×1×1 kernel over the better-scoring 3×3×3×3 on 'the cost benefit analysis between performance and parameters of model' — an argument from parameter counts that appear nowhere in the paper.",
        "Figure 2's caption credits the 4D residual block to ref. [34], which is Simonyan & Zisserman's two-stream paper; the block is from ref. [38]. Equation 1 is credited to ref. [31] (Fan et al., slow-fast) rather than [38]. Table 1 cites RWF2000 as [2], Hockey as [3], Crowd as [4] and Movie as [45], while the reference list has [3] Movies, [4] Hockey, [5] Crowd and [45] RWF2000 — the citations are shifted by one. Farnebäck's method is cited as [40] in §3.1 and [41] in §4.2, and neither reference is Farnebäck.",
      ],
    },

    attention: {
      used: false,
      kinds: ["none"],
      notes: [
        "No attention of any kind in the proposed model. All six occurrences of the word in the paper are accounted for: one is the ordinary English 'focus their attention' in the introduction, four describe other people's models in Related Works (refs. 28, 29 and 32), and one is a reference-list title. There is no attention module, no gating, no channel or spatial weighting, and no learned re-weighting of the U axis.",
        "The optical-flow region of interest is the thing most likely to be mistaken for spatial attention, and it is not. It is computed by Farnebäck's algorithm before the network runs, summed into one motion-intensity heat map per clip, and used to place a fixed 256×256 crop. Nothing about it is learned, nothing about it is differentiable, and it does not vary with what the network comes to consider important. It is a hand-set spatial prior — the same category as V001's custom spatiotemporal crop.",
        "This makes the paper a useful baseline for the review's attention axis. It is a 2023 paper with a competitive RWF-2000 result and no attention anywhere, which is what the attention papers need to be measured against. Read alongside V011, which reaches 92.0% on the same dataset and does attribute gains to two small attention modules, the pair frames the question of how much attention is actually buying.",
        "The 4D convolution is sometimes described in this literature as capturing 'long-range dependence', which is transformer vocabulary. It is not attention: a 4D kernel has a fixed extent along U and weights that do not depend on the input, so its reach is a receptive field, not a similarity computation.",
      ],
    },

    efficiency: {
      // Deliberately all undefined. The paper reports no parameter count, no
      // FLOPs, no model size, no frame rate and no hardware -- the only timing
      // figure anywhere is T6's per-clip cropping cost, which is preprocessing.
      parameters: undefined,
      flops: undefined,
      modelSize: undefined,
      throughput: undefined,
      hardware: undefined,
      realTime: {
        status: "not-addressed",
        note: "The paper never claims real-time operation for Violence 4D. Real-time appears five times and every one refers to something else — the expense of human monitoring, why bag-of-features methods are unsuitable, ViF's claim, and two reference titles. The abstract's framing is 'an online warning in the event of aberrant activity', which is an application goal rather than a latency claim. Recording this as not-addressed rather than unsupported is the accurate reading: a 4D extension of a 3D ResNet-50 is unlikely to be fast, and the paper does not pretend otherwise.",
      },
      edgeDeployment: {
        status: "not-addressed",
        note: "Nothing on deployment. No edge, embedded, mobile, Jetson, Raspberry Pi, CPU or GPU mention anywhere in the paper — the words do not appear. The only acknowledgement of compute is 'due to resource constraints' explaining why training was staged, which says the authors were short of hardware rather than anything about the model's requirements.",
      },
      notes: [
        "The efficiency claim the paper does make is comparative and unsupported: §4.3 says 'our method is accurate and computationally efficient' and that competing 'models used are much heavier than ours, like Flow Gated Net'. No parameter count, FLOP count or timing is given for Violence 4D or for Flow Gated Net, so there is nothing to check the word 'heavier' against. Adding a fourth convolutional dimension to a 3D ResNet-50 is a priori the expensive direction.",
        "The paper's single timing measurement undercuts its own design choice. T6 times the two cropping strategies at 1.0667 s and 1.7780 s per clip, and the optical-flow crop it adopts is the slower one — 67% more preprocessing time for the 2.35 accuracy points T6 records on ResNet-50. §4.4.2 states the difference as '0.7113 ms per video'. The subtraction is right and the unit is wrong by a factor of a thousand: 1.7780 − 1.0667 = 0.7113 seconds. Whether the authors understood the cost as milliseconds or seconds changes the conclusion completely.",
        "That cost is also the classic uncosted preprocessing case. Dense optical flow over every adjacent frame pair, summed into a heat map, is paid before a single convolution runs, and at 1.778 s for a 5-second RWF-2000 clip it consumes roughly 36% of a real-time budget on its own — before any network cost, which is never measured at all.",
        "T6 gives no hardware, so 1.0667 s and 1.7780 s per clip cannot be compared with any other paper in this review. They are the paper's only cost figures.",
        "T8 is the only place efficiency enters a design decision, and it does so without numbers. 3×3×3×3 is the most accurate kernel on both backbones (92.60 and 94.21), 3×3×1×1 is chosen instead on parameter grounds, and the parameter counts of the two shapes are never given.",
      ],
    },

    evaluation: {
      datasets: [
        {
          name: "RWF-2000",
          role: "evaluation",
          note: "2000 clips, 5 s at 30 fps, variable resolution, real surveillance footage from YouTube (T1 p7). The paper's primary target and the only dataset any ablation runs on. Split 70/15/15 = 1400/300/300, and the confusion matrix in F7 sums to exactly 300, so this split checks out.",
        },
        {
          name: "Hockey Fight",
          role: "evaluation",
          note: "1000 clips, 1.6-1.96 s, 360×288, broadcast ice hockey (T1 p7). Reported at 100%. F10's confusion matrix sums to 150, matching the stated 15% test split.",
        },
        {
          name: "Movies",
          role: "evaluation",
          note: "Listed as 'Movie fight', 200 clips, 1.6-2 s, 720×480, film footage (T1 p7). Reported at 100%. F14's confusion matrix sums to 60, which is 30% of the dataset, not the 15% the paper says it tested on.",
        },
        {
          name: "Crowd Violence",
          role: "evaluation",
          note: "The Violent Flows dataset, 246 clips, 1.04-6.52 s, variable resolution (T1 p7). Reported at 97.29%, the paper's only sub-100 result outside RWF-2000 and the one dataset where it concedes second place. F12's confusion matrix sums to 74, twice the 36.9 clips a 15% split of 246 would give.",
        },
      ],
      split:
        "A single 70/15/15 train/validation/test split per dataset, stated for RWF-2000 in §4.2 and applied to the other three. No cross-validation anywhere, which matters most on Crowd Violence: a 15% test split of 246 clips is about 37 videos, so one clip is worth 2.7 accuracy points. Two of the four confusion matrices contain twice as many clips as this split allows, and the paper never explains the discrepancy.",
      metrics: [
        "Accuracy",
        "Precision",
        "Recall",
        "F1 score (mislabelled — see protocol notes)",
        "Specificity (mislabelled — see protocol notes)",
        "Confusion matrices (F7, F10, F12, F14)",
      ],
      protocolNotes: [
        "The RWF-2000 confusion matrix as described in §4.2 is impossible. It reads '143 true positives, 9 true negatives, 141 false positives, and 7 false negatives', which sums correctly to 300 but gives an accuracy of 50.67%, not the 94.67% reported. Reading the same four counts as TP 143, FP 9, TN 141, FN 7 reproduces the reported accuracy 0.9467, precision 0.9407 and recall 0.9533 exactly. The FP and TN labels are transposed; the underlying result appears sound.",
        "Table 2's F1 and specificity columns are swapped, and this can be shown rather than guessed. From the corrected RWF-2000 counts, F1 = 0.9470 and specificity = 0.9400; T2 prints F1_Score 0.9400 and Specificity 0.9470. From Crowd Violence's counts, F1 = 0.9722 and specificity = 1.0000; T2 prints F1_Score 1.0000 and Specificity 0.9722. The Crowd row is self-evidently wrong even without recomputation, since an F1 of 1.0000 alongside a recall of 0.9459 is arithmetically impossible.",
        "Hyperparameters were selected on the same data the headline is reported from, and the paper does not distinguish the two. T4 sweeps momentum, learning rate and weight decay and its best cell is 94.75%; T5, T6, T7, T9 and T10 all report 94.75% for the chosen configuration; F8's bar chart labels RWF-2000 as 94.75; but T2 and the abstract report 94.67%. The likeliest explanation is that 94.75 is validation and 94.67 test, which would be the correct way round — but the paper never says so, and with a validation and a test set both of exactly 300 clips the reader cannot tell them apart.",
        "T4's sweep cannot separate learning rate from weight decay. Learning rate 0.010 is always paired with weight decay 5×10⁻⁴ and 0.001 always with 5×10⁻³, across all three momentum values. Six runs, and the two hyperparameters never vary independently. §4.2 then reports weight decay 5×10⁻³ for the best model while §4.4 reports 5×10⁻⁴ for the same model; T4's 94.75 row says 5×10⁻³.",
        "Tables 5 and 6 contain the same four accuracies — 87.53, 89.63, 92.40 and 94.75 — assigned to different variables with the axes transposed. T5 credits the 87.53 → 92.40 and 89.63 → 94.75 gaps to sparse versus dense sampling; T6 credits 87.53 → 89.63 and 92.40 → 94.75 to optical-flow versus random cropping. The four runs cannot be evidence for both. §4.4.2's stated improvements of 3.1 and 3.93 points match neither table: T6's own deltas are 2.10 and 2.35. The deltas quoted for T5 (4.87, 5.12) and T7 (6.7, 7.12) do check out against their tables.",
        "T10 does not measure what §4.4.6 concludes from it. The three rows are U=2 with 2 frames, U=4 with 4 frames, and U=4 with 8 frames, so the number of action units and the frames per unit change together and U is never varied alone. 'U does not have a major influence on performance' is not supported by an experiment that never isolates U — and total input frames rise 4 → 16 → 32 across those rows, which is the more plausible driver of 94.50 → 94.62 → 94.75.",
        "F8 disagrees with T2 on two of the four datasets. Its bars are labelled 94.75 and 98 for RWF-2000 and Crowd Violence, against T2's 94.67 and 97.29. The 98 is notable because 98.00 is exactly the Crowd Violence figure T3 attributes to 2D CNNs + LSTM (ref. 48) — the competitor that beats Violence 4D on that dataset.",
        "The abstract's claim to 'outperform the previous methods used on RWF2000' holds, but by less than the framing suggests. T3's best prior RWF-2000 result is 93.80% (2D spatio-temporal representations, ref. 49), so the margin is +0.87 points on a 300-clip test set where one clip is worth 0.33 points. On Hockey Fight the margin over T3's best prior (99.62%) is +0.38, which is one clip in 150. Crowd Violence is a loss: 97.29 against 98.00.",
        "The 100% results on Hockey Fight and Movies are reported without comment, and both come with 100% training and 100% validation accuracy (F9, F13). On 150 and 60 test clips a saturated result is close to uninformative, and F13's Movie curves reaching 100% on train, validation and test simultaneously is the pattern that usually indicates a dataset too easy to distinguish models on. The paper reads it as a strength.",
        "No cross-dataset evaluation. Every result is train and test within one dataset, so nothing here speaks to whether a model trained on one camera set transfers to another. Of the four datasets only RWF-2000 is genuinely surveillance footage; Hockey is broadcast sport, Movies is film, and Crowd Violence is scraped crowd video.",
        "One citation that does check out: T3 credits ref. 48 with 92.00% on RWF-2000, and that paper — V011 in this reading list — does report 92.0% as its headline RWF-2000 figure. The rest of T3's rows were not verified against their sources.",
      ],
    },
  },

  concepts: [
    {
      id: "fourth-dimension",
      title: "The fourth dimension is a stack of clips, not a longer clip",
      tagline: "What U actually is",
      highlight: {
        label: "Input tensor",
        value: "C×U×T×H×W",
        note: "U = 4 action units of T = 8 frames",
      },
      note: [
        "A 3D convolution reads a volume with axes height, width and time. Its time axis is as long as the clip it is given, and 8 or 16 frames is typical — under a second of video. Everything the model can know about how an event developed has to fit inside that window, because outside it there is no tensor.",
        "The usual fix is to make the clip longer, and it scales badly: cost grows with frame count and a 5-second clip at 30 fps is 150 frames. Violence 4D takes the other route. The video is divided into U equal sections, one short clip is sampled from each — an action unit — and those units are stacked along a new axis. The tensor is now C×U×T×H×W, and a 4D kernel of shape 3×3×1×1 spans 3 positions along U and 3 along T at once. It sees three separate moments from across the whole video in one operation, at the cost of covering three clips rather than 150 frames.",
        "The two axes measure different things and that is the point. T is continuous time inside one unit, sampled at 30 fps, and 3D kernels handle it. U is discontinuous time across the video, where consecutive elements may be seconds apart, and only the 4D blocks reach along it. Short-term motion and long-term development are learned by different operations on different axes.",
        "The implementation trick in Equation 3 is what makes this affordable. There is no 4D convolution primitive in a standard framework, so U is folded into the batch dimension, the tensor is permuted from U×C×T×H×W to C×U×T×H×W with the 4D kernel applied, and then permuted back to 3D form. Ordinary 3D convolution machinery executes the whole thing. Equations 1 and 2 are the algebra: because convolution is linear the nested sums commute, so a 4D convolution factorises into 3D convolutions.",
        "None of this originates here. The 4D convolution, the residual block, the factorisation and the action-unit sampling are all V4D's (Guo et al., ICLR 2020). This paper's own additions are the application to violence detection and the optical-flow crop.",
      ],
      takeaways: [
        "U is an axis over clips, not a longer time axis. Adjacent positions along it can be seconds apart.",
        "The headline configuration is U = 4 action units of 8 frames each — 32 frames sampled from a 150-frame clip.",
        "4D convolutions are executed by permuting U into the batch dimension and calling 3D convolutions. No new primitive is needed.",
        "The architecture is V4D's. The paper is open about the source but never separates its own contribution from it.",
      ],
      visual: {
        kind: "volume-grid",
        options: {
          mode: "kernel",
          hue: 75,
          kernel: [3, 3, 3],
          interactive: true,
          // One action unit: 8 frames deep, which is the T axis of C x U x T x H x W.
          size: [8, 5, 8],
        },
        caption:
          "One action unit, with a kernel sliding through it. This is the 3D part — the T axis inside a single unit, where the paper's ordinary 3D ResNet-50 layers do their work. Toggle the kernel to 2D and the reach along time collapses to a single frame. What the scene cannot draw is the fourth axis: picture four of these volumes side by side, sampled from across the video, with a kernel reaching through all four at once.",
      },
      pdfPage: 4,
    },

    {
      id: "roi-crop",
      title: "The optical flow never enters the network",
      tagline: "A crop, not attention",
      highlight: {
        label: "Cropping cost",
        value: "1.778 s",
        note: "per clip, T6 · vs 1.067 s for a random crop",
      },
      note: [
        "The abstract lists 'dense optical flow for the region of interest' alongside ResNet-50 and the 4D blocks as one of the model's three components, which invites reading it as a motion stream. It is not one. Farnebäck's algorithm runs over every adjacent frame pair, the norm of each vector becomes a heat map of movement intensity, the heat maps are summed into one map per clip, and the brightest region is used to place a fixed 256×256 crop inside the 320×256 frame. Then the flow is discarded. What reaches the network is RGB pixels and nothing else.",
        "This matters twice over. For the review's attention axis, a crop chosen by a hand-written algorithm before inference is a fixed spatial prior, not attention — nothing about it is learned, nothing is differentiable, and it cannot change as the network's notion of importance changes. For the architecture axis, it means Violence 4D is a single-stream RGB model despite the optical flow in its abstract. The paper's own future work confirms this, proposing to add flow channels alongside RGB as an extension.",
        "It is also the paper's only measured cost, and the measurement does not favour it. T6 times the flow crop at 1.7780 s per clip against 1.0667 s for random cropping, for 2.35 accuracy points on ResNet-50. That is 67% more preprocessing, paid on every clip, before a single convolution runs. On a 5-second RWF-2000 clip it is roughly 36% of a real-time budget spent deciding where to crop.",
        "Section 4.4.2 states this cost as '0.7113 ms per video'. The subtraction is exactly right and the unit is wrong by a factor of a thousand — the numbers it comes from are 1.7780 and 1.0667 seconds. As milliseconds the crop is free and obviously worth taking; as seconds it is the dominant reported cost of the pipeline. The paper's stated conclusion is the one that follows from the wrong unit.",
      ],
      takeaways: [
        "Optical flow selects a crop and is then thrown away. No flow channel, no second stream, no flow feature reaches the network.",
        "A pre-computed crop is a fixed spatial prior, not attention. It does not adapt and it never receives a gradient.",
        "T6: 1.7780 s per clip for the flow crop against 1.0667 s for a random crop, buying 2.35 points on ResNet-50.",
        "§4.4.2 reports the 0.7113 s difference as 0.7113 ms. Under the correct unit the cost is 36% of a real-time budget, not a rounding error.",
        "No hardware is named for either figure, so neither number can be compared with any other paper in this review.",
      ],
      pdfPage: 10,
    },

    {
      id: "block-placement",
      title: "Two 4D blocks, and where they go matters more than their shape",
      tagline: "Reading the ablation",
      highlight: {
        label: "res3 → res4 → both",
        value: "93.10 → 93.65 → 94.75",
        note: "RWF-2000, T9",
      },
      note: [
        "The 4D blocks are insertions into an otherwise standard 3D ResNet-50, so there are two design questions: what shape the kernel has, and where in the stack the blocks sit. The paper answers both on RWF-2000, and the second answer is the more interesting one.",
        "On shape, T8 tests three kernels at the end of res4. Accuracy rises monotonically with kernel extent — 93.10, 93.65 and 94.21 on ResNet-50 for 3×1×1×1, 3×3×1×1 and 3×3×3×3 — so the widest kernel wins. The paper then chooses 3×3×1×1 anyway, on the grounds of 'the cost benefit analysis between performance and parameters of model'. It is a defensible choice and the parameter counts it turns on are not reported for any of the three shapes.",
        "On placement, T9 puts a single 3×3×1×1 block at res3 (93.10), at res4 (93.65), or one at each (94.75). Two blocks beat either one by more than the best kernel shape gained over the worst — the placement axis is worth 1.65 points against T8's 1.11. The paper's reading is that res3 and res4 capture short- and long-term properties respectively and the combination is richer, which is plausible but untested: nothing isolates whether the gain comes from the depths chosen or simply from having two blocks instead of one, and res5 is only ever tested together with res4.",
        "T7 is the honest headline of the ablation section, and its numbers hold up. Without any 4D blocks the backbones score 85.7 and 87.63; with them, 92.40 and 94.75. That is +6.70 and +7.12 points, and the text quotes both correctly. Whatever else is wrong in this paper's arithmetic, the case that the 4D blocks do substantial work is made on two backbones and is internally consistent.",
        "Every one of these ablations runs on RWF-2000 only. Nothing establishes that the same placement, kernel shape or gain holds on the other three datasets — where the model scores 100%, 100% and 97.29% and there is almost no headroom to measure a difference in.",
      ],
      takeaways: [
        "Placement is worth more than kernel shape: +1.65 points from using two blocks against +1.11 from the widest kernel.",
        "3×3×3×3 is the most accurate kernel and is rejected on parameter grounds the paper never quantifies.",
        "T7 is the strongest result in the paper — +6.70 and +7.12 points from adding 4D blocks, consistent across ResNet-18 and ResNet-50.",
        "All ablations run on RWF-2000 alone. On the other three datasets the model is at or near ceiling.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          mode: "outcome",
          hue: 75,
          baselineId: "none",
          metricLabel: "RWF-2000 accuracy",
          datasetLabel: "Backbone",
          // T7 p10 for the with/without rows, T9 p11 for the placements. Both
          // report accuracy only, so each lane draws one bar and a missing
          // second bar -- the paper never splits into sensitivity/specificity.
          datasets: [
            { id: "r18", label: "ResNet-18", title: "The smaller comparison backbone, T7", floor: 50, floorLabel: "chance" },
            { id: "r50", label: "ResNet-50", title: "The backbone behind every headline number, T7 and T9", floor: 50, floorLabel: "chance" },
          ],
          models: [
            {
              id: "none",
              label: "no 4D block",
              metrics: { r18: { accuracy: 85.7 }, r50: { accuracy: 87.63 } },
            },
            {
              id: "res3",
              label: "1 block at res3",
              // T9 reports placements for ResNet-50 only.
              metrics: { r50: { accuracy: 93.1 } },
            },
            {
              id: "res4",
              label: "1 block at res4",
              metrics: { r50: { accuracy: 93.65 } },
            },
            {
              id: "res3-res4",
              label: "res3 + res4",
              metrics: { r18: { accuracy: 92.4 }, r50: { accuracy: 94.75 } },
            },
          ],
        },
        caption:
          "The two-backbone rows come from T7 and the placement rows from T9, which only ran on ResNet-50 — so the ResNet-18 lane is empty for the single-block placements, because the paper never measured them. Each lane draws one bar rather than two: this paper reports accuracy only, and the missing second bar is where sensitivity and specificity would go.",
      },
      pdfPage: 11,
    },

    {
      id: "arithmetic",
      title: "Four reported numbers do not follow from the counts they came from",
      tagline: "Checking the tables",
      highlight: {
        label: "RWF-2000 confusion matrix",
        value: "50.67%",
        note: "what §4.2's stated counts actually give",
      },
      note: [
        "Section 4.2 describes the RWF-2000 confusion matrix as '143 true positives (TP), 9 true negatives (TN), 141 false positives (FP), and 7 false negatives (FN)'. The four counts sum to 300, which is the test split, so nothing looks wrong at a glance. Compute the accuracy and it is (143 + 9) / 300 = 50.67%, against the 94.67% reported two sentences earlier. A model with 141 false positives against 9 true negatives would be flagging almost every peaceful clip as violent.",
        "The fix is a relabelling, not a different result. Read the same four counts as TP 143, FP 9, TN 141, FN 7 and everything reconciles: accuracy 0.9467, precision 143/152 = 0.9407, recall 143/150 = 0.9533 — all three exactly as T2 reports them. The FP and TN labels are transposed in the text and the underlying experiment appears fine. But it means the paper's stated confusion matrix, the one artifact that would let a reader see the error profile, is unusable as printed.",
        "Table 2's last two columns are swapped, and this one can be proved. From the corrected RWF-2000 counts, F1 = 0.9470 and specificity = 141/150 = 0.9400. T2 prints F1_Score 0.9400 and Specificity 0.9470 — the two values, in the wrong columns. Crowd Violence confirms it independently: its counts give F1 = 0.9722 and specificity = 1.0000, and T2 prints 1.0000 and 0.9722. That row is impossible on its face, since F1 is bounded above by recall and T2's own recall for Crowd Violence is 0.9459.",
        "Then there are the test-set sizes. Every dataset is stated to use a 70/15/15 split. RWF-2000's confusion matrix sums to 300 of 2000 and Hockey's to 150 of 1000, both exactly 15%. Crowd Violence's sums to 74 of 246 and Movies' to 60 of 200 — both exactly 30%. Two of the four test sets are twice the size the protocol allows, and this is never mentioned. On Crowd Violence, where 246 clips means one clip is worth 2.7 accuracy points, the size of the test set is not a detail.",
        "Tables 5 and 6 are the same experiment reported twice. Both contain the accuracies 87.53, 89.63, 92.40 and 94.75; T5 arranges them as dense versus sparse sampling and T6 as random versus optical-flow cropping, with the axes transposed. Four runs cannot establish two independent ablations. §4.4.2's claimed improvements of 3.1 and 3.93 points match neither arrangement — T6's own deltas are 2.10 and 2.35.",
        "None of this makes the architecture wrong, and the 4D blocks' +7 points in T7 survives all of it. What it does mean is that the reported metrics cannot be taken at face value: two of five columns in the results table are mislabelled, one confusion matrix is unusable as written, half the test splits contradict the stated protocol, and one ablation is double-counted. This is what checking a paper's arithmetic is for.",
      ],
      takeaways: [
        "§4.2's confusion matrix gives 50.67% accuracy as labelled. Swapping the FP and TN labels reproduces every reported metric exactly.",
        "T2's F1 and specificity columns are transposed, provable from both non-saturated datasets. Crowd Violence's F1 of 1.0000 is impossible against its recall of 0.9459.",
        "Crowd Violence and Movies were tested on 30% of their clips, not the stated 15%. RWF-2000 and Hockey match the protocol.",
        "T5 and T6 report the same four runs as two different ablations, and the text's deltas for T6 match neither.",
        "94.67% or 94.75%? T2 and the abstract say the first; T4, T5, T6, T7, T9, T10 and F8 all say the second. The paper never reconciles them or says which is validation.",
      ],
      pdfPage: 9,
    },

    {
      id: "comparison",
      title: "A +0.87 margin, and a bar chart that plots the competitor's number",
      tagline: "Reading Table 3",
      highlight: {
        label: "RWF-2000 margin",
        value: "+0.87",
        note: "94.67 vs T3's best prior 93.80",
      },
      note: [
        "The abstract's comparative claim is narrow and, read literally, correct: 'these results outperform the previous methods used on RWF2000 datasets'. T3's best prior RWF-2000 figure is 93.80% and Violence 4D reports 94.67%, so the margin is +0.87 points. On a 300-clip test set one clip is worth 0.33 points, which puts the improvement at under three clips — and the paper reports no standard deviation, runs no cross-validation and repeats no run, so there is no way to ask whether three clips is inside the noise.",
        "Hockey Fight is tighter still. The best prior in T3 is 99.62%, Violence 4D reports 100%, and the test set is 150 clips — a margin of one clip in 150 against a dataset several methods already sit above 99% on. Movies is at ceiling, with nine of the sixteen rows in T3 reporting 100%. A dataset where most methods score full marks cannot separate them, and the paper treats its own 100% there as a result.",
        "Crowd Violence is the honest part of §4.3. Violence 4D scores 97.29% against 98.00% for 2D CNNs + LSTM, and the paper says so — 'Crowd violence achieved a higher result than violence 4D, as we obtained the second-best result'. It immediately adds that the models beating it are 'much heavier than ours', which would be a fair defence if any parameter count appeared anywhere in the paper.",
        "Figure 8 is where it goes wrong. Its four bars are labelled 94.75, 100, 100 and 98 for RWF-2000, Hockey, Movies and Crowd Violence, against T2's 94.67, 100, 100 and 97.29. The RWF-2000 discrepancy is the 94.67-versus-94.75 confusion that runs through the whole paper. The Crowd Violence bar is stranger: 98.00 is precisely the figure T3 attributes to the competitor that beats Violence 4D on that dataset. A chart of the paper's own accuracies appears to have picked up the number it was losing to.",
        "One row of T3 was checked against its source. Ref. 48 is Kang, Park & Park — V011 in this reading list — and T3 credits it with 92.00% on RWF-2000, which is exactly that paper's headline figure. The citation is faithful. The remaining fifteen rows were not verified.",
      ],
      takeaways: [
        "RWF-2000: +0.87 points over T3's best prior, on a 300-clip test set with no variance reported.",
        "Hockey Fight: +0.38 over the best prior, which is one clip in 150. Movies: nine of sixteen rows in T3 already score 100%.",
        "Crowd Violence is a loss the paper concedes — 97.29 against 98.00 — defended on model weight it never measures.",
        "F8's Crowd Violence bar reads 98, which is the competitor's T3 figure rather than the paper's own 97.29.",
        "T3's citation of V011 at 92.00% on RWF-2000 checks out against that paper.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          mode: "outcome",
          hue: 75,
          baselineId: "violence-4d",
          metricLabel: "Accuracy",
          // T3 p10, transcribed in full. Cells the table leaves as a dash stay
          // undefined -- that method was never run on that dataset.
          datasets: [
            { id: "rwf", label: "RWF-2000", title: "2000 clips, real surveillance. The paper's target; nine of sixteen rows never ran on it.", floor: 50, floorLabel: "chance" },
            { id: "crowd", label: "Crowd Violence", title: "246 clips. The one dataset Violence 4D does not lead.", floor: 50, floorLabel: "chance" },
            { id: "movie", label: "Movies", title: "200 clips of film footage. Nine of sixteen rows score 100%.", floor: 50, floorLabel: "chance" },
            { id: "hockey", label: "Hockey Fight", title: "1000 clips of broadcast ice hockey.", floor: 50, floorLabel: "chance" },
          ],
          models: [
            { id: "vif", label: "ViF", metrics: { crowd: { accuracy: 81.3 }, hockey: { accuracy: 82.9 } } },
            { id: "convlstm", label: "ConvLSTM", metrics: { crowd: { accuracy: 94.57 }, movie: { accuracy: 100 }, hockey: { accuracy: 97.1 } } },
            { id: "fightnet", label: "FightNet", metrics: { movie: { accuracy: 100 }, hockey: { accuracy: 97 } } },
            { id: "convnet3d", label: "3D ConvNet", metrics: { crowd: { accuracy: 94.3 }, movie: { accuracy: 99.97 }, hockey: { accuracy: 99.62 } } },
            { id: "c3d", label: "C3D", metrics: { crowd: { accuracy: 84.44 }, movie: { accuracy: 100 }, hockey: { accuracy: 96.5 } } },
            { id: "i3d-rgb", label: "I3D (RGB)", metrics: { crowd: { accuracy: 86.67 }, movie: { accuracy: 100 }, hockey: { accuracy: 98.5 } } },
            { id: "i3d-flow", label: "I3D (flow)", metrics: { crowd: { accuracy: 88.89 }, movie: { accuracy: 100 }, hockey: { accuracy: 84 } } },
            { id: "i3d-fusion", label: "I3D (fusion)", metrics: { crowd: { accuracy: 88.89 }, movie: { accuracy: 100 }, hockey: { accuracy: 97.5 } } },
            { id: "flow-gated", label: "Flow gated net", metrics: { rwf: { accuracy: 87.25 }, crowd: { accuracy: 88.87 }, movie: { accuracy: 100 }, hockey: { accuracy: 98 } } },
            { id: "sepconv-m", label: "SepConvLSTM-M", metrics: { rwf: { accuracy: 89.75 }, movie: { accuracy: 100 }, hockey: { accuracy: 99 } } },
            { id: "sepconv-a", label: "SepConvLSTM-A", metrics: { rwf: { accuracy: 87.75 }, movie: { accuracy: 100 }, hockey: { accuracy: 99 } } },
            { id: "sepconv-c", label: "SepConvLSTM-C", metrics: { rwf: { accuracy: 89.25 }, movie: { accuracy: 100 }, hockey: { accuracy: 99.5 } } },
            { id: "spil", label: "SPIL convolution", metrics: { rwf: { accuracy: 89.3 }, crowd: { accuracy: 94.5 }, movie: { accuracy: 98.5 } } },
            { id: "cnn2d-lstm", label: "2D CNNs + LSTM", metrics: { rwf: { accuracy: 92 }, crowd: { accuracy: 98 }, movie: { accuracy: 100 }, hockey: { accuracy: 99.6 } } },
            { id: "spatio-2d", label: "2D spatio-temporal", metrics: { rwf: { accuracy: 93.8 }, crowd: { accuracy: 90.6 }, movie: { accuracy: 99.5 }, hockey: { accuracy: 94.4 } } },
            { id: "violence-4d", label: "Violence 4D", metrics: { rwf: { accuracy: 94.67 }, crowd: { accuracy: 97.29 }, movie: { accuracy: 100 }, hockey: { accuracy: 100 } } },
          ],
        },
        caption:
          "Table 3 in full, one lane per method, with the delta measured against Violence 4D. Empty lanes are methods the table leaves as a dash — never run on that dataset, not scored zero. Switch to Movies and the reason a 100% result says little becomes visible: most of the field is already there.",
      },
      pdfPage: 10,
    },
  ],
};
