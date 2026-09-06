import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Home from "../../../page";
import { columnCanonicalPath, getPublicColumn } from "../../../../lib/content";

export async function generateMetadata({ params }: { params: Promise<{ id: string; slug: string }> }): Promise<Metadata> {
  const { id, slug } = await params;
  const row = await getPublicColumn(id, slug);
  return row ? { title: row.column.title, description: row.column.description, alternates: { canonical: columnCanonicalPath(row.column) }, openGraph: { type: "website", title: row.column.title, description: row.column.description } } : { title: "专栏不存在" };
}

export default async function ColumnPage({ params }: { params: Promise<{ id: string; slug: string }> }) {
  const { id, slug } = await params;
  const row = await getPublicColumn(id, slug);
  if (!row) notFound();
  if (row.legacySlug) redirect(columnCanonicalPath(row.column));
  return <Home initialColumnId={id} initialColumnSlug={row.column.slug} initialColumns={[{ ...row.column, creatorName: row.creator.displayName }]} initialArticles={row.articles} />;
}
