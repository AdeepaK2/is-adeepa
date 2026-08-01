import { Hero } from "@/components/home/hero";
import { PaperLibrary } from "@/components/home/paper-library";
import { FamilyMap } from "@/components/home/family-map";
import { allDatasets, architectureFamilies, papers } from "@/data/papers";

export default function HomePage() {
  return (
    <>
      <Hero />
      <PaperLibrary
        papers={papers}
        families={architectureFamilies}
        datasets={allDatasets()}
      />
      <FamilyMap />
    </>
  );
}
