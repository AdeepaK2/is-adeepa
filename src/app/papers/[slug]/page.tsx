import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPaper, papers } from "@/data/papers";
import { getStudyModule } from "@/data/modules";
import { PaperHeader } from "@/components/study/paper-header";
import { StudyShell } from "@/components/study/study-shell";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return papers.map((paper) => ({ slug: paper.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const paper = getPaper(slug);
  if (!paper) return { title: "Paper not found" };

  return {
    title: paper.shortTitle,
    description: paper.summary,
  };
}

export default async function PaperPage({ params }: PageProps) {
  const { slug } = await params;
  const paper = getPaper(slug);
  if (!paper) notFound();

  const studyModule = getStudyModule(slug);

  return (
    <>
      <PaperHeader paper={paper} studyModule={studyModule} />
      <StudyShell paper={paper} studyModule={studyModule} />
    </>
  );
}
