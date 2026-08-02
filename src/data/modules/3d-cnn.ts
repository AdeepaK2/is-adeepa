import type { StudyModule } from "@/types/study";

/**
 * Pratama, Yudistira & Bachtiar (2024), "Violence recognition on videos using
 * two-stream 3D CNN with custom spatiotemporal crop".
 * Multimedia Tools and Applications 83:61995-62017.
 *
 * Every accuracy quoted here is a validation number from the paper's own
 * tables, and each concept's `visual.options` carries the table it needs so the
 * visuals stay generic. Configurations the authors did not run are simply
 * absent -- the visuals report those as unmeasured rather than interpolating.
 *
 * Table map, for anyone checking the numbers against the PDF:
 *   T2 p12  frame count, from scratch          T6 p16  optical flow stream
 *   T3 p13  location range, from scratch       T7 p17  fusion schemes
 *   T4 p14  location range, pre-trained        T8 p17  comparison to prior work
 *   T5 p16  freeze depth                       T9 p18  parameters and speed
 */
export const module3dCnn: StudyModule = {
  slug: "3d-cnn",

  premise:
    "CCTV footage is only useful after the fact unless something is watching it. This paper builds a violence classifier for RWF-2000 -- 2,000 five-second surveillance clips labelled fight or non-fight -- out of a 3D ResNet-18 backbone run twice: once over colour frames, once over optical flow, with the two outputs added at the end. Most of the work is not architectural. It is finding which frames to feed the network and where the weights should start.",

  results: [
    { label: "RWF-2000", value: "90.5%", note: "two-stream fusion" },
    { label: "Best prior result", value: "89.75%", note: "SepConvLSTM-M, T8" },
    { label: "Cost", value: "66.6 M", note: "parameters, ~5 FPS" },
  ],

  concepts: [
    {
      id: "volume",
      title: "The kernel moves through time, not just across the frame",
      tagline: "3D convolution",
      highlight: {
        label: "Activation tensor",
        value: "N × L × 112 × 112",
        note: "filters × frames × height × width",
      },
      note: [
        "A 2D convolution slides a small window across height and width. Stack a video's frames and you have a third axis, time, that the window never touches. Whatever changes between frame 40 and frame 41 is outside its receptive field, and no amount of extra depth puts it back.",
        "3D convolution gives the kernel extent along that axis too. A 3×3×3 kernel covers three frames at once, so a single output value already encodes how a patch changed over a short span. Stack the stages and later layers see longer spans assembled from shorter ones.",
        "The cost lands in the tensor. Activations are N × L × H × W -- filters, frame length, height, width -- and that L axis multiplies the work at every layer. It is why the input is cropped to 112×112, and why the number of frames stops being an implementation detail and becomes a hyperparameter worth tuning.",
      ],
      takeaways: [
        "A 2D kernel cannot compare two frames. That is a receptive field limitation, not something depth or training fixes.",
        "Every residual stage uses 3×3×3. Only the stem is larger, at 7×7×7 with stride 1 in time and 2 in space.",
        "Spatial resolution is traded for temporal reach: frames go in at 112×112, well below the 224×224 they were extracted at.",
      ],
      visual: {
        kind: "volume-grid",
        options: {
          mode: "kernel",
          interactive: true,
          size: [7, 5, 7],
          kernel: [3, 3, 3],
          hue: 210,
          speed: 0.55,
        },
        caption:
          "One clip as a volume: width and height across, time into the screen. Switch the kernel between 2D and 3D and watch how much of the time axis it touches.",
      },
      pdfPage: 4,
    },

    {
      id: "two-streams",
      title: "Two streams: what it looks like, and how it moves",
      tagline: "Appearance and motion",
      highlight: {
        label: "Flow vs RGB, from scratch",
        value: "86% / 83%",
        note: "motion is the stronger signal for this task",
      },
      note: [
        "The model gets two copies of every clip. The RGB stream sees colour frames -- who is in the scene, what the room looks like, where people are standing. The optical flow stream sees per-pixel motion instead: two channels holding horizontal and vertical displacement, computed with OpenCV's dense flow before training ever starts.",
        "They are the same 3D ResNet-18 and differ only at the input layer, three channels against two. Neither stream sees the other's data at any point during training.",
        "Trained from scratch, the flow stream reaches 86% and the RGB stream 83%. For violence that ordering is reasonable: a fight is defined by how bodies move, not by what the room contains. A displacement field also cancels out lighting, decor and skin tone, so the flow stream starts with much of the irrelevant variation already removed.",
      ],
      takeaways: [
        "RGB stream: 3 input channels. Flow stream: 2. Everything after the first convolution is identical.",
        "Optical flow is precomputed, not learned. 149 RGB frames per clip yield 74 flow frames, since each one needs a pair.",
        "Flow is the stronger input and also the more fragile one -- camera shake and compression noise register as motion that means nothing.",
        "Neither stream is doing detection or tracking. Both are whole-clip classifiers producing one label for five seconds of video.",
      ],
      visual: {
        kind: "two-stream-flow",
        options: {
          mode: "streams",
          hue: 210,
          accuracy: { rgb: 89.25, flow: 88.5, both: 90.5 },
        },
        caption:
          "Each stream at its own best configuration, and the two fused. RGB: 49-149 crop, Kinetics + Moments in Time. Flow: 74 frames, Kinetics.",
      },
      pdfPage: 7,
    },

    {
      id: "sampling",
      title: "Which frames you feed it beats how many",
      tagline: "Spatiotemporal cropping",
      highlight: {
        label: "Frames 49-149",
        value: "89.25%",
        note: "against 87.5% for all 149 frames, same weights",
      },
      note: [
        "Every clip is five seconds at 30 fps, extracted to 149 frames. The network does not take all of them. You pick a window, and that choice is worth several points of accuracy.",
        "Two things vary independently. How many frames: from scratch, 50 beats 149 (83% against 81.75%), so more is not better -- a longer window dilutes the moment that matters. And where in the clip: on the same budget, the middle window 50-100 beats the opening 0-50 by 3.5 points, and once pre-training is added, 49-149 is the best window of all.",
        "The third setting shows what happens when the sampled frames are not consecutive. Video-wise random sampling scatters N frames across the whole clip and sorts them; it collapses to 76.5% against 89.25%. The gaps destroy exactly the short-range motion the 3D kernels exist to read, which is a useful negative result: the model is genuinely using temporal continuity, not just aggregating stills.",
      ],
      takeaways: [
        "Frame count has a peak, not a slope: 16 → 77.25%, 30 → 79.25%, 50 → 83%, 100 → 82%, 149 → 81.75%.",
        "Consecutive frames matter more than the count. Scattering 50 frames across the clip scores 72.5% against 83% for 50 in a row, from scratch.",
        "The middle and end of these clips carry more signal than the opening. The authors are careful to say this locates the useful frames, not the violence -- it likely reflects how RWF-2000 was cut.",
        "Custom spatiotemporal crop, the paper's named contribution, fixes a start and end point. It only makes sense for clips of uniform, known length, as RWF-2000's are.",
      ],
      visual: {
        kind: "sequence-timeline",
        options: {
          totalFrames: 149,
          hue: 210,
          // T2, plus the R-50 row of T4 for the pre-trained columns.
          random: [
            { frames: 16, scratch: 77.25 },
            { frames: 30, scratch: 79.25 },
            { frames: 50, scratch: 83, kinetics: 84.25, kineticsMit: 85.5 },
            { frames: 100, scratch: 82 },
            { frames: 149, scratch: 81.75 },
          ],
          // T3 (scratch) and T4 (pre-trained).
          custom: [
            { start: 0, end: 50, scratch: 79.25, kinetics: 86, kineticsMit: 87 },
            { start: 0, end: 100, scratch: 81.5, kinetics: 85, kineticsMit: 86.5 },
            { start: 0, end: 149, scratch: 81.25, kinetics: 86.5, kineticsMit: 87.5 },
            { start: 49, end: 149, scratch: 82, kinetics: 86.5, kineticsMit: 89.25 },
            { start: 50, end: 100, scratch: 82.75, kinetics: 86.5, kineticsMit: 86.25 },
            { start: 99, end: 149, scratch: 80.75, kinetics: 86.5, kineticsMit: 85.5 },
          ],
          // VWR rows of T3 and T4.
          videowise: [
            { frames: 50, scratch: 72.5, kinetics: 72.75, kineticsMit: 76.5 },
            { frames: 100, scratch: 79.75, kinetics: 85.25, kineticsMit: 85.75 },
          ],
        },
        caption:
          "The clip as a filmstrip; lit frames are the ones the model sees. Windows the paper did not run report as unmeasured rather than guessing.",
      },
      pdfPage: 13,
    },

    {
      id: "transfer",
      title: "Pre-training is the biggest lever, and freezing throws it away",
      tagline: "Transfer learning",
      highlight: {
        label: "Same crop, pre-trained",
        value: "+7.25",
        note: "82% from scratch → 89.25% from Kinetics + Moments in Time",
      },
      note: [
        "Nothing else in the paper moves the number this far. Identical architecture, identical 49-149 crop: 82% trained from scratch, 89.25% initialised from weights pre-trained on Kinetics plus Moments in Time -- together 1,039 action classes and well over a million clips.",
        "Two sources are compared. Kinetics alone gives 86.5%; adding Moments in Time gives 89.25%. RWF-2000 offers 1,600 training clips, nowhere near enough to learn general motion features from nothing, so the useful features have to arrive already formed and fine-tuning only adapts them.",
        "Freezing is the counterintuitive result. Holding the first stage fixed drops accuracy to 85.25%, the first two to 85.75% -- both clearly worse than fine-tuning everything. The standard argument for freezing is that early layers learn generic features worth protecting, but surveillance footage is not Kinetics: low resolution, fixed overhead framing, heavy compression. Those early filters need to move.",
      ],
      takeaways: [
        "Transfer learning is worth +7.25 points on an otherwise identical run. It is the single largest effect in the paper.",
        "Freezing early layers cost 3.5-4 points here. Treat 'freeze the early layers' as a hypothesis to test, not a default.",
        "Both pre-training sets are general action recognition, not violence. What transfers is motion features, not the task.",
        "Every single run hit 100% training accuracy while validation plateaued far below it. The model overfits throughout, so only the validation column carries information -- worth remembering when reading the tables.",
      ],
      visual: {
        kind: "resnet-stack",
        options: {
          hue: 210,
          stages: [
            { name: "conv1", channels: 64 },
            { name: "conv2", channels: 64 },
            { name: "conv3", channels: 128 },
            { name: "conv4", channels: 256 },
            { name: "conv5", channels: 512 },
          ],
          // T4, the 49-149 row.
          sources: { scratch: 82, kinetics: 86.5, kineticsMit: 89.25 },
          // T5.
          freeze: [
            { layers: 1, accuracy: 85.25 },
            { layers: 2, accuracy: 85.75 },
          ],
          freezeSource: "kineticsMit",
        },
        caption:
          "The backbone's five stages. The upper pulse is data going forward; the lower one is gradients coming back, and it stops wherever you freeze. All numbers use the RGB stream at the 49-149 crop.",
      },
      pdfPage: 14,
    },

    {
      id: "fusion",
      title: "Adding the two outputs beats either stream alone",
      tagline: "Late fusion",
      highlight: {
        label: "RWF-2000",
        value: "90.5%",
        note: "+1.25 over the better single stream",
      },
      note: [
        "The streams are never merged inside the network. Each produces its own class scores, the two score vectors are added, and the softmax runs on the sum. That is the whole fusion mechanism -- no shared layers, no attention, no learned weighting.",
        "It works because the streams fail on different videos. Step through the examples: crowded market footage where camera shake wrecks the optical flow while RGB still reads the scene, and a stretched greyscale clip of children where RGB breaks and the flow is clean. In both, the confident stream outvotes the confused one.",
        "It is not a universal rescue. Where a video is dark, low-detail and barely moving, neither stream has anything to work with and the sum fails too. The best combination -- RGB from Kinetics + Moments in Time, flow from Kinetics -- reaches 90.5%, the top row of the paper's own comparison table. The margin over prior work is thinner than the architecture-versus-architecture story suggests: SepConvLSTM-M was already at 89.75%, so the gain is 0.75 points, and only against the Flow Gated Network's 87.25% is it the 3.25 the cost comparison below is drawn against.",
        "The cost deserves stating plainly. This is 66.6 million parameters at roughly 5 FPS, against 0.27 million at 94.7 FPS for the Flow Gated Network it beats by 3.25 points. It is the accurate model, not the deployable one, and the authors name pruning as the obvious next step.",
      ],
      takeaways: [
        "Late fusion: sum the two streams' output scores, then softmax. No joint training and no learned fusion weights.",
        "Which flow model you fuse in matters: flow trained from scratch drops the fused result to 87%, below the RGB stream on its own.",
        "Two streams cost roughly 250× the parameters and 20× the latency of the Flow Gated Network, to beat it by 3.25 points and the best prior result by 0.75. For a live CCTV alarm that may be the wrong trade.",
        "The paper's Table 9 labels its parameter column MB, while the surrounding text says millions of parameters. Read it as millions.",
      ],
      visual: {
        kind: "two-stream-flow",
        options: {
          mode: "fusion",
          hue: 210,
          accuracy: { rgb: 89.25, flow: 88.5, both: 90.5 },
          // T7. The RGB stream is fixed at 49-149 with Kinetics + Moments in Time.
          fusion: [
            {
              id: "scratch",
              label: "scratch",
              accuracy: 87,
              title: "Optical flow stream trained from scratch",
            },
            {
              id: "kinetics",
              label: "K",
              accuracy: 90.5,
              title: "Optical flow stream pre-trained on Kinetics",
            },
            {
              id: "kineticsMit",
              label: "K+M",
              accuracy: 89.75,
              title: "Optical flow stream pre-trained on Kinetics + Moments in Time",
            },
          ],
          // The qualitative analysis, figures 15-18.
          cases: [
            {
              id: "lift",
              label: "lift",
              rgb: true,
              flow: true,
              fused: true,
              note: "A man grabs a woman inside a lift. Motion looks gentle on camera but the optical flow is unmistakable, and both streams get it alone.",
            },
            {
              id: "market",
              label: "market",
              rgb: true,
              flow: false,
              fused: true,
              note: "Chaos in a traditional market. Camera shake and noise swamp the optical flow, which ends up tracking unimportant pixels; RGB carries the fused prediction.",
            },
            {
              id: "children",
              label: "children",
              rgb: false,
              flow: true,
              fused: true,
              note: "Children play-fighting in a living room. The portrait video is stretched and greyscale when resized, which breaks the RGB stream, while the flow shows the movement cleanly.",
            },
            {
              id: "basement",
              label: "basement",
              rgb: false,
              flow: false,
              fused: false,
              note: "Ground fighting in a dark basement. Nominally 30 fps but effectively about one, so there is neither detail nor motion. Both streams fail and the fusion fails with them.",
            },
          ],
        },
        caption:
          "Pick an example to see which stream survives it. The RGB stream is fixed at its best configuration; the chips choose which optical flow model is fused in.",
      },
      pdfPage: 17,
    },
  ],
};
