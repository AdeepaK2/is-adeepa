import type { StudyModule } from "@/types/study";
import { module3dCnn } from "./3d-cnn";
import { moduleAiViolentIncident } from "./ai-violent-incident-detection";
import { moduleAirtlab } from "./airtlab-deep-learning";
import { moduleCbamUbiFights } from "./cbam-ubi-fights";
import { moduleCnnConvLstmTemporalAttention } from "./cnn-convlstm-temporal-attention";
import { moduleEdgeVisionIiot } from "./edge-vision-iiot";
import { moduleEfficientRealtime } from "./efficient-realtime-modeling";
import { moduleKianNet } from "./kiannet-cnn-lstm";
import { moduleMultiFrameFusion } from "./multi-frame-feature-fusion";
import { moduleScanConvLstm } from "./scan-convlstm-fight-detection";
import { moduleSpikingNeuralNetworks } from "./spiking-neural-networks";
import { moduleSwin3dart } from "./swin-3dart";
import { moduleTemporalAwareTransformer } from "./temporal-aware-transformer";
import { moduleSpatioTemporal } from "./spatio-temporal-model";
import { moduleVdNet } from "./vd-net-edge-surveillance";
import { moduleViolence4d } from "./violence-4d";

/**
 * Registry of authored study modules, keyed by paper slug.
 *
 * To add a paper's interactive walkthrough:
 *   1. create `src/data/modules/<slug>.ts` exporting a `StudyModule`
 *   2. register it below
 *   3. flip that paper's `status` to `"ready"` in `src/data/papers.ts`
 *
 * Papers without an entry fall back to the overview + PDF reader, so the app
 * stays usable while modules are written one at a time.
 */
export const studyModules: Record<string, StudyModule> = {
  "3d-cnn": module3dCnn,
  "ai-violent-incident-detection": moduleAiViolentIncident,
  "airtlab-deep-learning": moduleAirtlab,
  "cbam-ubi-fights": moduleCbamUbiFights,
  "cnn-convlstm-temporal-attention": moduleCnnConvLstmTemporalAttention,
  "edge-vision-iiot": moduleEdgeVisionIiot,
  "efficient-realtime-modeling": moduleEfficientRealtime,
  "kiannet-cnn-lstm": moduleKianNet,
  "multi-frame-feature-fusion": moduleMultiFrameFusion,
  "scan-convlstm-fight-detection": moduleScanConvLstm,
  "spatio-temporal-model": moduleSpatioTemporal,
  "spiking-neural-networks": moduleSpikingNeuralNetworks,
  "swin-3dart": moduleSwin3dart,
  "temporal-aware-transformer": moduleTemporalAwareTransformer,
  "vd-net-edge-surveillance": moduleVdNet,
  "violence-4d": moduleViolence4d,
};

export function getStudyModule(slug: string): StudyModule | undefined {
  return studyModules[slug];
}
