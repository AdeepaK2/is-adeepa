import type { StudyModule } from "@/types/study";

/**
 * Ehsan, Nahvi & Mohtavipour (2024), "An accurate violence detection framework
 * using unsupervised spatial-temporal action translation network".
 * The Visual Computer 40:1515-1535. DOI 10.1007/s00371-023-02865-3.
 * Accepted 6 April 2023, published online 3 May 2023.
 *
 * Every number here is from the paper's own tables, which is load-bearing in
 * this case: the prose misquotes those tables five separate times, always in
 * the paper's own favour or through a column slip. Tables 4, 5 and 6 agree with
 * each other on 96/98/94, so the tables are the reliable artifact and the
 * narrative around them is not. Both readings are recorded wherever they differ.
 *
 * One figure here is a reconstruction rather than a quotation, and is labelled
 * as such: Table 3's AirtLab F1-score of 0.894 does not follow from the
 * precision and recall printed in the same row, which give about 0.872. The
 * Movies and Hockey rows of that table reconstruct correctly (0.956, 0.949).
 *
 * Table and figure map (physical PDF pages, 1-based -- the journal prints
 * 1515-1535; those are not the page numbers used here):
 *   F1  p3   normal / violent samples     F9  p11  pipeline stages, Movies
 *   T1  p4   prior handcrafted methods    F10 p12  pipeline stages, Hockey
 *   T2  p4   prior deep methods           F11 p13  pipeline stages, AirtLab
 *   F2  p5   framework block diagram      F12 p15  ROC: features, VGG layers
 *   F3  p7   the U-Net generator          T3  p16  confusion matrices + rates
 *   F4  p7   the PatchGAN discriminator   T4  p16  AUC against prior work
 *   F5  p8   output-interpretation flow   T5  p16  person-detection ablation
 *   F6  p8   VGG cosine interpretation    T6  p17  the generality matrix
 *   F7  p10  D and G training losses      F13 p18  pipeline stages, UCSD
 *   F8  p10  encoder / decoder features   T7  p19  UCSD comparison
 *                                         T8  p20  processing time
 *   Eq. 13, the threshold rule, is on p14.
 */
export const moduleAccurateViolence: StudyModule = {
  slug: "accurate-violence-detection",

  premise:
    "Every other paper in this collection learns what violence looks like. This one refuses to. A GAN is trained on normal behaviour only — never shown a single violent clip — and asked to redraw a person's body posture from nothing but the way their motion is changing. On normal actions it succeeds. On violence it produces garbage, and the garbage is the detection. The payoff is the thing the rest of the field keeps failing at: train on Hockey, test on Movies, and this scores 97 where a supervised 2D CNN that scores 100 on its own dataset collapses to 56.",

  results: [
    { label: "Hockey", value: "96%", note: "AUC, T4 — the text says 94" },
    { label: "Hockey → Movies", value: "97%", note: "cross-dataset AUC, T6" },
    { label: "2D CNN, same transfer", value: "56%", note: "from 100 on its own data, T6" },
  ],

  review: {
    architecture: {
      family: "Unsupervised / Generative",
      backbone:
        "A pix2pix-style conditional GAN, called the Spatial-Temporal Action Translation (STAT) network. The generator is a U-Net: 8 convolutional layers down to a bottleneck, 8 de-convolutional layers back up, ReLU throughout, skip connections between same-size layers and dropout after each de-convolution (F3 p7). The discriminator is a PatchGAN with 5 convolutional layers and no fully connected head, so it scores each patch of the image separately and averages (F4 p7). Two off-the-shelf networks sit around it: YOLO for person detection at the front, and an ImageNet-pretrained VGG at the back as a perceptual comparator.",
      motionEncoding:
        "By differential optical flow, and nothing else — the network never sees a pixel of appearance. Farnebäck flow is computed every 2 frames inside each YOLO person box, and then differenced across time: the input is |Δf_x|, |Δf_y| and |Δm|, the frame-to-frame change in the horizontal component, vertical component and magnitude of the flow field (Eqs. 2-3, p6). So the representation is not motion but the rate of change of motion, on the stated argument that normal actions move at constant patterns while violent ones are erratic. That 3-channel motion-variation image is the sole input to the GAN.",
      inputs: [
        "Differential optical flow, 3 channels (|Δf_x|, |Δf_y|, |Δm|), Farnebäck, computed every 2 frames and differenced over 3 consecutive frames",
        "Cropped to YOLO person boxes with confidence ≥ 0.5 and non-max suppression, so background and non-human objects never enter the pipeline",
        "Resized to 256×256. No RGB frames, no raw pixels, no pose, no audio",
      ],
      fusion:
        "None. One stream from motion to posture. The only place two things meet is the discriminator's input, which concatenates the motion feature with the posture image so the GAN is conditional rather than unconditional.",
      supervision:
        "Unsupervised in the one-class sense: trained only on normal behaviour, with no violent sample ever seen during training and no violence label used. The training signal is adversarial (Eq. 4) plus an L1 reconstruction loss between the generated and real posture (Eq. 6); L1 rather than L2 because L2 blurs. At test time only the generator runs, and classification is a threshold on the cosine similarity between VGG block4_conv4 features of the real and reconstructed frames (Eq. 8).",
      notes: [
        "The named contribution is the translation direction. Autoencoder-based rivals compress an input and reconstruct the same input; STAT is asked to map one domain to a different one — temporal motion in, spatial posture out — so a failure to reconstruct is a failure to explain the motion, not a failure to copy an image. Whether that framing is what earns the result is not isolated by any experiment.",
        "Two of the three pipeline stages are off-the-shelf. YOLO and Farnebäck are both prior work, and the paper's own ablation (T5 p16) shows the YOLO stage alone is worth 8, 7 and 5 AUC points on Hockey, Movies and AirtLab. Person detection is doing more measured work than anything the title describes.",
        "Choosing differential flow over raw flow is argued and shown, but only as ROC curves. F12 (p15) plots magnitude against differential magnitude and the differential curve is higher; no AUC is printed for the magnitude-only variant, so the size of the gain cannot be read off the paper.",
        "The comparator is a design choice with consequences. Reconstruction error is measured in VGG feature space rather than by PSNR or MSE, on the argument that pixel metrics 'do not perceive human-level abstraction'. Which VGG layer is a tuned hyperparameter — block2_conv2, block4_conv4 and flatten were compared, and the middle one won.",
        "The framework is object-centric by construction, which makes it the only model here that structurally cannot use background context. The paper treats that as pure gain; it also means a violent act partly outside a person box, or a missed detection, is invisible to everything downstream.",
        "YOLO's own training corpus is never named, so the one supervised component in an 'unsupervised' framework is unspecified. The VGG comparator is likewise pretrained, on ImageNet, which the paper does state.",
      ],
    },

    attention: {
      used: false,
      kinds: ["none"],
      notes: [
        "No attention of any kind in the proposed model — no channel, spatial, temporal or self-attention. Across 21 pages the word appears four times: twice in Related Works describing ref [30]'s multi-stream model, once in Table 2's summary of that same paper, and once in the title of a cited work in the reference list. None of them describe this framework.",
        "Worth keeping deliberately as a baseline for the attention axis. It is the strongest cross-dataset result in the review so far and it contains no attention module at all, which puts a ceiling on how much of the generalisation gap elsewhere can be attributed to attention.",
        "The YOLO person crop is the closest thing to a selection mechanism, and it is not attention: it is a hard, hand-set spatial prior applied before the network, with no learned weighting, no gating and no gradient. The distinction matters because the crop is also this paper's single largest measured effect (T5), which makes it easy to mistake for one.",
        "The PatchGAN discriminator scores patches independently rather than pooling to a scalar, which localises the training signal. That is a loss-function structure, not an attention mechanism — nothing re-weights features at inference, and the discriminator is discarded after training.",
      ],
    },

    efficiency: {
      parameters: undefined,
      flops: undefined,
      modelSize: undefined,
      throughput:
        "0.43 s (T8 p20). The table's scope is stated in the text and is narrow: the figure covers 'the required time for temporal to spatial translation and output interpretation' only. Per what is never said — there is no frame, clip or sample denominator anywhere.",
      hardware:
        "NVIDIA Tesla K80 GPU (T8 p20). Experiments were run in Google Colab on TensorFlow. No CPU figure, and no hardware is named for the YOLO or optical-flow stages.",
      realTime: {
        status: "claimed-without-evidence",
        note: "The claim is made — the timing is 'acceptable for real-time violence detection applications' (p19) — and a number is reported, but the number does not measure the claim. Three reasons. First, T8's figure explicitly excludes the YOLO person detector and the Farnebäck optical flow, which are the two most expensive stages in the pipeline; the paper's own sentence conceding that 'we used a person detector and optical flow extractor ... our computational time is slightly higher' refers to a cost the table does not contain. Second, 0.43 s has no denominator, so it cannot be converted to a frame rate. Third, it is only ever compared to other papers' timings, never to a video frame rate or any stated real-time threshold — and the datasets in question run at 25 and 30 fps. If the figure is per 3-frame sample, the system would process roughly 7 frames of video per second before pre-processing, against a 25 fps input; the paper gives no way to confirm or rule that out.",
      },
      edgeDeployment: {
        status: "not-addressed",
        note: "No edge, embedded, on-camera or mobile deployment is discussed anywhere. The only hardware named is a datacentre-class Tesla K80 accessed through Google Colab. No power, memory-footprint or model-size figure appears.",
      },
      notes: [
        "The text and the table disagree about the headline timing: the prose says the method 'requires 0.41 s' and T8 prints 0.43. The relative ranking the sentence makes does hold against the table — slower than 3D CNN's 0.21 and Fast Fight's 0.42, faster than HF's 0.46, 2D CNN's 0.49, ST-3D CNN's 0.81, DiMolif's 2.8 and ViF's 3.27.",
        "That same sentence is self-contradicting as written: the method is described as 'lower than all methods but slightly higher than Fast Fight and 3D CNN'. The table shows what was meant — lower than all but those two — but the claim as printed cannot be true.",
        "Uncosted pre-processing is the dominant efficiency finding here, and it is unusually explicit. Both excluded stages are expensive: YOLO is a full 24-convolution-layer detector run on every frame, and Farnebäck is a template-matching flow method chosen specifically because it is more accurate than the cheaper gradient methods on fast motion. The paper picked the slower flow algorithm and then reported a time that excludes it.",
        "T8's Resources column is half empty. Five of the ten compared methods report no hardware at all, and the timings are quoted from those papers rather than re-measured, so the column compares numbers produced on unknown and certainly different machines. The paper does not flag this.",
        "No parameter count, FLOPs figure or model size appears anywhere, for a framework that contains a U-Net generator, a PatchGAN discriminator, YOLO and VGG-16. Three of those four are large by the standards of the lightweight models elsewhere in this review.",
        "Training cost is partly recorded and inconsistently labelled: Hockey converged after 'about 8000 iterations', Movies after 'about 15,000 epochs'. Iterations and epochs are not the same unit, and with batch size 1 the distinction matters.",
      ],
    },

    evaluation: {
      datasets: [
        {
          name: "Hockey Fight",
          role: "evaluation",
          note: "1000 clips, 500 per class, 50 frames each at 720×576 and 25 fps (p8-9). The paper's primary and hardest violence benchmark, and it says why: the camera viewpoint is not fixed and the background changes rapidly. Broadcast ice hockey.",
        },
        {
          name: "Movies",
          role: "evaluation",
          note: "200 clips, 100 per class, 360×250 at 25 fps, 1-3 s (p9). Explicitly described as the easier set because the camera is fixed. Action-film footage.",
        },
        {
          name: "AIRTLab",
          role: "evaluation",
          note: "Written 'Airtlab' and 'AirtLab' in the paper. 230 violent and 120 non-violent clips, 1920×1080 at 30 fps, 2-14 s averaging 6 s (p9). The non-violent class is deliberately adversarial — hugging, clapping, cheering, gesturing, teasing — which is why recall drops to 0.78 here against 0.91-0.92 elsewhere.",
        },
        {
          name: "UCSD Ped1",
          role: "evaluation",
          note: "Used as a generalisation test outside violence entirely (T7 p19), scoring 90 AUC. Pedestrian walkway footage where cars, bikes and skaters are the anomalies. The person-detection stage is removed for this experiment, since here the anomalies are non-person objects.",
        },
        {
          name: "UCSD Ped2",
          role: "evaluation",
          note: "The second UCSD partition, 93 AUC (T7 p19). The paper concedes the limit this exposes: 'since the proposed framework is based on chaotic motion distribution modelling, its capabilities will be limited on datasets with uniform motion patterns such as UCSD'.",
        },
        {
          name: "ImageNet",
          role: "pre-training",
          note: "Source of the VGG weights used as the perceptual comparator in the output-interpretation stage. Described as 'over 14 million images of 1000 classes'. Never fine-tuned.",
        },
      ],
      split:
        "75% of the normal clips are used for training; the remaining 25% of normals plus every violent clip form the test set. There is no validation split anywhere, and no cross-validation or repeated runs, so no result carries a spread. The split is stated once, for all three violence datasets at once, with no per-dataset detail.",
      metrics: [
        "AUC",
        "ROC curves",
        "Recall",
        "Selectivity",
        "Precision",
        "F1-score",
      ],
      protocolNotes: [
        "The prose misquotes the paper's own tables five times, which is the single most important thing to know before reading any number in it. Section 4.8 reports '94% and 98% for Hockey and Movies' where T4 gives 96 and 98 — 94 is the AirtLab figure. Section 4.7 reports F1 of '0.936 and 0.991 for Hockey and Movies' where T3 gives 0.949 and 0.955, and 0.991 is the Movies precision column. Double-AE is described as obtaining '96%, 98%, and 96%' where T4 lists 84, 98 and N/A. 3D CNN [22] is credited with 90% AUC on Hockey where T4 says 93. And the timing is given as 0.41 s where T8 says 0.43. Tables 4, 5 and 6 agree with each other on 96/98/94, so the tables are internally consistent and the narrative layer is what fails.",
        "T3 contains an arithmetic error. Its AirtLab row prints precision 0.974 and recall 0.78, which give an F1-score of about 0.872; the row prints 0.894. The Movies and Hockey rows of the same table reconstruct correctly at 0.956 and 0.949, and the Double-AE rows reconstruct correctly too, so it is that one cell rather than a systematic problem with the column.",
        "T3's rows are not counting the same thing. The proposed method's rows count 3-frame samples — 20,000 positive and 3,000 negative on Hockey — while the supervised methods stacked beneath them under identical column headers count clips: [42] reports 271 positive and 241 negative on the same dataset. How a sample-level score becomes a clip-level decision is never described, so T4's AUC comparison against clip-level prior work is not like-for-like either.",
        "The test sets are about 87% violent by construction, because training consumes 75% of the normals and every violent clip goes to test. Hockey is 20,000 against 3,000, Movies 3,000 against 450, AirtLab 30,000 against 3,700. Precision of 0.97-0.99 on a set that positive is close to the base rate; selectivity, at 0.83-0.94, is the column carrying information about false alarms.",
        "The decision threshold is chosen on the test set. Eq. 13 sets it to max(true positive − false positive) read off the ROC curve, giving 0.78 for Hockey, 0.69 for Movies and 0.73 for AirtLab — three different per-dataset operating points, each selected against the numbers being reported. Every rate in T3 is therefore a selected-best figure. T4's AUC is threshold-independent and is the safer number to quote.",
        "The VGG comparison layer was selected the same way. block2_conv2, block4_conv4 and flatten were compared by ROC (F12 p15) and the middle one adopted. That is a second hyperparameter chosen on test data, and with no validation split there was nowhere else to choose it.",
        "The cross-dataset matrix (T6 p17) is this paper's best work and the review's cleanest evidence on generalisation. Trained on Hockey and tested on Movies it scores 97 against ST-3D CNN's 49, 3D CNN's 48 and 2D CNN's 56; trained on Movies and tested on Hockey it scores 92 against 63, 59 and 71. The diagonal tells the other half of the story: 2D CNN scores 100 on its own dataset and 56 off it, which is exactly the failure the paper was written to demonstrate.",
        "One claim in that section overreaches. The text says the framework 'surpasses all these methods' and lists Double-AE at 97% on Hockey → Movies — the same 97% the proposed method scores. That cell is a tie, not a win. The Movies → Hockey cell is a clear win, 92 against 71.",
        "Selectivity is left blank for Double-AE in T3 even though the true negatives and false positives needed to compute it are printed in the same row (239/288 and 1612/2184 give 0.830 and 0.738). A blank where the arithmetic is one column away.",
        "No dataset here is operational CCTV. Hockey is broadcast sport, Movies is film, AIRTLab is staged in a lab, and UCSD is a fixed campus walkway camera. The paper argues at length that supervised methods fail on unseen data and then evaluates transfer entirely between curated sets — the transfer result is real, but it is not evidence about surveillance footage.",
        "The UCSD experiment is reported honestly against its own limits. The framework scores 93 and 90 on Ped2 and Ped1 while ST-AE and ST-CE reach 97 on Ped2, and the paper explains rather than hides the gap: it models chaotic motion, and UCSD's anomalies are uniform. It also notes that the 97-scoring ST-AE only works with a fixed camera and never reports Ped1 at all.",
      ],
    },
  },

  concepts: [
    {
      id: "differential-motion",
      title: "The network never sees a pixel",
      tagline: "Motion in, posture out",
      highlight: {
        label: "Input to the GAN",
        value: "|Δf_x|, |Δf_y|, |Δm|",
        note: "the change in the flow field",
      },
      note: [
        "Almost every model in this collection feeds a network pixels and asks it to find the motion. This one computes the motion first, then throws the pixels away — and then differences the motion as well, so what finally reaches the GAN is the rate at which the flow field is changing.",
        "The pipeline is three subtractions deep. Farnebäck optical flow compares two frames to get displacement. That gives f_x, f_y and a magnitude m. Then those are differenced across time — |f_x(t) − f_x(t−1)| and so on — producing a 3-channel image of motion variation. The argument for the extra step is stated plainly: normal actions like walking and talking move at fairly constant rates, while punching and kicking change speed and direction abruptly, so the second derivative separates the classes better than the first.",
        "It is shown rather than asserted, but only as a picture. Figure 12 plots ROC curves for magnitude against differential magnitude and the differential curve sits above it. No AUC is printed for the magnitude-only variant anywhere in the paper, so the reader can see that differencing helped without being able to say by how much.",
        "The consequence runs through everything downstream. With no appearance information at all, the GAN has to infer a body posture — arms, legs, a silhouette — from a picture of how velocity is changing. That is the translation the paper is named for, and it is also why the reconstruction is such a sharp test: there is no shortcut through copying the input, because the input and the output are in different domains.",
      ],
      takeaways: [
        "Input is |Δf_x|, |Δf_y|, |Δm| — the frame-to-frame change in optical flow, not the flow itself.",
        "No RGB frames, no raw pixels, no pose, no audio. Appearance never enters the network.",
        "Farnebäck was chosen over the cheaper Lucas-Kanade and Horn-Schunck specifically because it holds up on fast motion — and its cost is then excluded from the reported timing.",
        "The differential-vs-raw comparison exists (F12) but is published as curves only, with no number attached.",
      ],
      visual: {
        kind: "reconstruction-gap",
        options: {
          hue: 280,
          // F3 p7: 8 convolutional layers down, 8 de-convolutional layers back,
          // with skip connections between same-size layers.
          depth: 8,
          labels: {
            input: "differential motion",
            generator: "STAT generator",
            generated: "reconstructed posture",
            real: "actual frame",
          },
          cases: [
            {
              id: "normal",
              label: "normal",
              reconstructs: true,
              note: "The only class the generator was ever trained on",
            },
            {
              id: "violent",
              label: "violent",
              reconstructs: false,
              note: "Never seen during training — the reconstruction fails, and that is the detection",
            },
          ],
          // Eq. 13 p14. The paper publishes these cut-offs but never publishes a
          // similarity value or distribution for either class, so `similarity`
          // is omitted on both cases and only the threshold carries a number.
          thresholds: [
            { id: "hockey", label: "Hockey", value: 78, title: "Cosine cut-off 0.78" },
            { id: "movies", label: "Movies", value: 69, title: "Cosine cut-off 0.69" },
            { id: "airtlab", label: "AIRTLab", value: 73, title: "Cosine cut-off 0.73" },
          ],
          copy: {
            readout: "Cut-off similarity",
            caseLabel: "Behaviour shown",
            thresholdLabel: "Dataset",
            lines: {
              normal:
                "Three channels of motion variation enter, and a body posture comes out the other side. The generator was trained on thousands of these, so it redraws them cleanly and the gap against the real frame stays small.",
              violent:
                "The same pipeline, given motion it has never seen. The output is what the paper calls a meaningless image — and because normal is the only thing the model can draw, failing to draw something is the evidence that it is violent.",
            },
          },
        },
        caption:
          "One sequential pipeline, not two streams: motion in, a posture out, and the gap against the real frame deciding the verdict. Switch to violent and the reconstruction breaks apart. The readout shows the published cut-off — the paper prints those three thresholds but never prints a similarity value for either class, so there is no distribution to draw.",
      },
      pdfPage: 7,
    },

    {
      id: "recall-vs-selectivity",
      title: "It misses violence more often than it cries wolf",
      tagline: "Reading the confusion matrices",
      highlight: {
        label: "AIRTLab recall",
        value: "0.78",
        note: "against 0.83 selectivity",
      },
      note: [
        "Table 3 is the most useful table in the paper because it publishes raw counts, not just rates. Every cell can be checked, and most of them check out.",
        "The pattern across all three datasets is the same: selectivity sits above recall. Movies 0.94 against 0.92, Hockey 0.93 against 0.91, AirtLab 0.83 against 0.78. The model is better at leaving normal behaviour alone than at catching violence, which is what you would expect from a system trained only on normality — normal is the class it has actually seen. The paper reads it the same way.",
        "AIRTLab is where it hurts. Recall drops to 0.78, meaning roughly one violent sample in five is missed, and the reason is in the dataset design: AIRTLab's non-violent class was built adversarially out of hugging, clapping, cheering, gesturing and teasing — fast, erratic, physically close actions that look like fighting to a motion-only descriptor. A framework whose entire signal is chaotic motion has no way to tell an enthusiastic hug from a shove.",
        "Precision, meanwhile, reads 0.974 to 0.991 across the board and means less than it appears to. The split sends 75% of normal clips to training and every violent clip to test, so the test sets are roughly 87% violent. On a set that skewed, high precision is largely the base rate. Selectivity is the column that carries information about false alarms, and it is the lower one.",
      ],
      takeaways: [
        "Selectivity exceeds recall on all three datasets — the model's failures are missed violence, not false alarms.",
        "AIRTLab's adversarial non-violent class (hugging, clapping, cheering) drops recall to 0.78, the worst figure in the paper.",
        "Precision of 0.97-0.99 is inflated by test sets that are about 87% violent by construction.",
        "T3's AirtLab F1 of 0.894 does not follow from its own precision and recall, which give about 0.872. The Movies and Hockey rows reconstruct correctly.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          mode: "outcome",
          hue: 280,
          baselineId: "proposed",
          metricLabel: "Recall",
          datasetLabel: "Dataset",
          // T3 p16. The paper prints these as fractions (0.92); they are
          // entered as percentages because the visual formats values with a
          // trailing %. sensitivity = Recall, specificity = Selectivity.
          datasets: [
            { id: "movies", label: "Movies", title: "3000 violent / 450 normal samples, fixed camera" },
            { id: "hockey", label: "Hockey", title: "20,000 violent / 3000 normal samples, moving camera" },
            { id: "airtlab", label: "AIRTLab", title: "30,000 violent / 3700 normal samples, adversarial non-violent class" },
          ],
          models: [
            {
              id: "proposed",
              label: "Proposed (unsup.)",
              metrics: {
                movies: { sensitivity: 92, specificity: 94 },
                hockey: { sensitivity: 91, specificity: 93 },
                airtlab: { sensitivity: 78, specificity: 83 },
              },
            },
            {
              id: "double-ae",
              label: "Double-AE (unsup.)",
              // T3 prints selectivity as a dash for both rows, even though the
              // TN and FP needed to compute it are in the same row.
              metrics: {
                movies: { sensitivity: 93 },
                hockey: { sensitivity: 76 },
              },
            },
            {
              id: "st-3d-cnn",
              label: "ST-3D CNN (sup.)",
              metrics: {
                movies: { sensitivity: 100, specificity: 100 },
                hockey: { sensitivity: 96, specificity: 95 },
              },
            },
            {
              id: "ref-44",
              label: "[44] (sup.)",
              metrics: {
                movies: { sensitivity: 93, specificity: 83 },
                hockey: { sensitivity: 88, specificity: 84 },
              },
            },
          ],
        },
        caption:
          "Table 3 as two bars per lane — recall above, selectivity below — with the red gap between them showing which way each model fails. Switch to AIRTLab: only one lane has any data at all, because nobody else publishes a confusion matrix on it, and the one that does has its worst recall in the paper.",
      },
      pdfPage: 16,
    },

    {
      id: "generality",
      title: "100% on your own dataset, 56% on somebody else's",
      tagline: "The generality matrix",
      highlight: {
        label: "Hockey → Movies",
        value: "97 vs 56",
        note: "this work against 2D CNN, T6",
      },
      note: [
        "Table 6 is why this paper exists. It trains each model on one dataset and tests it on another, which almost nobody in this review does, and the result is stark enough to carry the argument on its own.",
        "Start with the supervised 2D CNN. On Hockey, trained and tested on Hockey, it scores 100 — the highest number anywhere in the paper, and the one its own authors published. Train it on Hockey and test it on Movies and it scores 56. Train on Movies and test on Hockey, 71. The 3D CNNs are worse: ST-3D CNN drops from 96 to 49, 3D CNN from 87 to 48. A coin flip is 50.",
        "The proposed framework barely moves. Hockey → Hockey 96, Hockey → Movies 97, Movies → Movies 98, Movies → Hockey 92. It is never the best model on the diagonal and it is never far from its own best off it, which is the whole claim: a model that has only ever learned what normal looks like has less to unlearn when the scene changes.",
        "Two honest qualifications. Double-AE, the other unsupervised method, also scores 97 on Hockey → Movies — the text says this work 'surpasses all these methods' while listing that 97, and on that cell it is a tie. And every dataset involved is curated: broadcast hockey, action films, staged lab footage. Transferring between Hockey and Movies is a real test of generalisation, but it is not a test on surveillance footage, and the paper's motivating argument is about surveillance footage.",
      ],
      takeaways: [
        "Supervised models lose 30-50 AUC points crossing datasets; this one loses 1-6.",
        "2D CNN goes 100 → 56 and ST-3D CNN 96 → 49. The diagonal was never the hard part.",
        "Double-AE ties on Hockey → Movies at 97. The text presents that cell as a win.",
        "Only this framework reports the AirtLab column at all — every competitor's cell there is N/A, and stays unmeasured here.",
      ],
      visual: {
        kind: "model-lineup",
        options: {
          mode: "outcome",
          hue: 280,
          baselineId: "proposed",
          metricLabel: "AUC",
          datasetLabel: "Trained → tested",
          // T6 p17. Cells the table marks N/A stay undefined -- those methods
          // were never run on that pairing, and the visual reports them so.
          datasets: [
            { id: "h-h", label: "Hockey → Hockey", title: "The diagonal: trained and tested on the same data" },
            { id: "h-m", label: "Hockey → Movies", title: "The paper's headline transfer" },
            { id: "h-a", label: "Hockey → AIRTLab", title: "Only this framework reports it" },
            { id: "m-m", label: "Movies → Movies", title: "The diagonal again" },
            { id: "m-h", label: "Movies → Hockey", title: "Transfer onto the harder, moving-camera set" },
            { id: "m-a", label: "Movies → AIRTLab", title: "Only this framework reports it" },
          ],
          models: [
            {
              id: "proposed",
              label: "This work",
              metrics: {
                "h-h": { accuracy: 96 },
                "h-m": { accuracy: 97 },
                "h-a": { accuracy: 90 },
                "m-m": { accuracy: 98 },
                "m-h": { accuracy: 92 },
                "m-a": { accuracy: 83 },
              },
            },
            {
              id: "double-ae",
              label: "Double-AE",
              metrics: {
                "h-h": { accuracy: 84 },
                "h-m": { accuracy: 97 },
                "m-m": { accuracy: 98 },
                "m-h": { accuracy: 71 },
              },
            },
            {
              id: "daba-net",
              label: "DABA-Net",
              metrics: {
                "h-h": { accuracy: 82 },
                "h-m": { accuracy: 88 },
                "m-m": { accuracy: 92 },
                "m-h": { accuracy: 73 },
              },
            },
            {
              id: "2d-cnn",
              label: "2D CNN",
              metrics: {
                "h-h": { accuracy: 100 },
                "h-m": { accuracy: 56 },
                "m-m": { accuracy: 100 },
                "m-h": { accuracy: 71 },
              },
            },
            {
              id: "st-3d-cnn",
              label: "ST-3D CNN",
              metrics: {
                "h-h": { accuracy: 96 },
                "h-m": { accuracy: 49 },
                "m-m": { accuracy: 99 },
                "m-h": { accuracy: 63 },
              },
            },
            {
              id: "3d-cnn",
              label: "3D CNN",
              metrics: {
                "h-h": { accuracy: 87 },
                "h-m": { accuracy: 48 },
                "m-m": { accuracy: 93 },
                "m-h": { accuracy: 59 },
              },
            },
          ],
        },
        caption:
          "Table 6 in full, one lane per method. Start on a diagonal pairing, where the supervised models look untouchable, then switch to Hockey → Movies and watch three of them fall to within a few points of chance. The two AIRTLab columns have one populated lane each — nobody else ran it.",
      },
      pdfPage: 17,
    },

    {
      id: "prose-vs-tables",
      title: "The tables are right; the sentences about them are not",
      tagline: "Five misquotes",
      highlight: {
        label: "Text vs table, Hockey AUC",
        value: "94 vs 96",
        note: "the paper undersells itself",
      },
      note: [
        "Reading this paper carefully turns up something odd: the prose repeatedly disagrees with the tables it is describing. Not once, which would be a typo, but five times.",
        "Section 4.8 says the framework obtained '94% and 98% for Hockey and Movies'. Table 4 says 96 and 98 — the 94 is the AirtLab figure, shifted one column left. Section 4.7 says the F1-score 'is obtained 0.936 and 0.991 for Hockey and Movies'; Table 3 gives 0.949 and 0.955, and 0.991 is the Movies precision, one column over. Double-AE is described as obtaining '96%, 98%, and 96%' where Table 4 lists 84, 98 and N/A. 3D CNN is credited with 90% on Hockey where Table 4 says 93. And the timing is 0.41 s in the text against 0.43 in Table 8.",
        "There is also one error inside a table rather than around it. Table 3's AirtLab row prints precision 0.974 and recall 0.78, which give an F1-score of about 0.872; the row prints 0.894. Recomputing the other rows — Movies 0.956, Hockey 0.949, and both Double-AE rows — reproduces the printed values exactly, so it is that one cell.",
        "The constructive reading matters as much as the criticism. Tables 4, 5 and 6 independently agree that this framework scores 96, 98 and 94 on Hockey, Movies and AirtLab, and Table 3's counts reconstruct into its own rates almost everywhere. The measurements are recoverable and mostly sound. It is the narrative layer that cannot be quoted from — which, for a review that has to compare eighteen papers on their reported numbers, is exactly the kind of thing worth writing down once and then never trusting again.",
      ],
      takeaways: [
        "Five text/table disagreements: Hockey AUC, two F1 figures, Double-AE's three AUCs, 3D CNN's Hockey AUC, and the processing time.",
        "Two of them are column slips — a neighbouring cell quoted in place of the right one.",
        "T3's AirtLab F1 of 0.894 does not follow from its own precision and recall (≈0.872); every other row does.",
        "T4, T5 and T6 agree with each other throughout, so the tables are the artifact to cite and the prose is not.",
      ],
      pdfPage: 16,
    },
  ],
};
