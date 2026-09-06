import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { articleCanonicalPath, getPublicArticle } from "../../../lib/content";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const row = await getPublicArticle(id);
  return row ? { title: row.article.title, description: row.article.bodyMarkdown.slice(0, 160), alternates: { canonical: articleCanonicalPath(row.article) }, openGraph: { type: "article", title: row.article.title, description: row.article.bodyMarkdown.slice(0, 160) } } : { title: "文章不存在" };
}

export default async function LegacyArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await getPublicArticle(id);
  if (!row) notFound();
  redirect(articleCanonicalPath(row.article));
}
