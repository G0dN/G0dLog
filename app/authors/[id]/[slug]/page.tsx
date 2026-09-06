import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Home from "../../../page";
import { authorCanonicalPath, getPublicAuthor, getPublicColumns } from "../../../../lib/content";
import { publicAvatarUrl } from "../../../../lib/site-config";

export async function generateMetadata({ params }: { params: Promise<{ id: string; slug: string }> }): Promise<Metadata> {
  const { id, slug } = await params;
  const row = await getPublicAuthor(id, slug);
  return row ? { title: row.author.displayName, description: row.author.signature ?? "", alternates: { canonical: authorCanonicalPath(row.author) }, openGraph: { type: "profile", title: row.author.displayName, description: row.author.signature ?? "" } } : { title: "作者不存在" };
}

export default async function AuthorPage({ params }: { params: Promise<{ id: string; slug: string }> }) {
  const { id, slug } = await params;
  const row = await getPublicAuthor(id, slug);
  if (!row) notFound();
  if (row.legacySlug) redirect(authorCanonicalPath(row.author));
  const columns = await getPublicColumns();
  return <Home initialAuthorId={id} initialAuthorSlug={row.author.slug} initialAuthor={{ id: row.author.id, slug: row.author.slug, displayName: row.author.displayName, avatarUrl: publicAvatarUrl(row.author.avatarUrl), signature: row.author.signature }} initialColumns={columns.filter((column) => column.creatorId === id)} initialArticles={row.articles} />;
}
