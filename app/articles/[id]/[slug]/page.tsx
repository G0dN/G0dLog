import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Home from "../../../page";
import { articleCanonicalPath, getPublicArticle } from "../../../../lib/content";

export async function generateMetadata({ params }: { params: Promise<{ id: string; slug: string }> }): Promise<Metadata> {
  const { id, slug } = await params;
  const row = await getPublicArticle(id, slug);
  return row ? { title: row.article.title, description: row.article.bodyMarkdown.slice(0, 160), alternates: { canonical: articleCanonicalPath(row.article) }, openGraph: { type: "article", title: row.article.title, description: row.article.bodyMarkdown.slice(0, 160), authors: [row.author.displayName] } } : { title: "文章不存在" };
}

export default async function ArticlePage({ params }: { params: Promise<{ id: string; slug: string }> }) {
  const { id, slug } = await params;
  const row = await getPublicArticle(id, slug);
  if (!row) notFound();
  if (row.legacySlug) redirect(articleCanonicalPath(row.article));
  const initialArticle = { ...row.article, columnSlug: row.column.slug, columnTitle: row.column.title, authorSlug: row.author.slug, authorName: row.author.displayName };
  const initialColumn = { ...row.column, creatorName: "" };
  return <Home initialView="reader" initialArticleId={id} initialArticleSlug={row.article.slug} initialArticles={[initialArticle]} initialColumns={[initialColumn]} />;
}
