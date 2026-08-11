import type { StudyModule } from "@/types/study";
import { module3dCnn } from "./3d-cnn";
import { moduleAiViolentIncident } from "./ai-violent-incident-detection";
import { moduleAirtlab } from "./airtlab-deep-learning";
import { moduleEfficientRealtime } from "./efficient-realtime-modeling";
import { moduleKianNet } from "./kiannet-cnn-lstm";
import { moduleMultiFrameFusion } from "./multi-frame-feature-fusion";
import { moduleVdNet } from "./vd-net-edge-surveillance";

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
  "efficient-realtime-modeling": moduleEfficientRealtime,
  "kiannet-cnn-lstm": moduleKianNet,
  "multi-frame-feature-fusion": moduleMultiFrameFusion,
  "vd-net-edge-surveillance": moduleVdNet,
};

export function getStudyModule(slug: string): StudyModule | undefined {
  return studyModules[slug];
}
