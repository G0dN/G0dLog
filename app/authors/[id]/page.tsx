import { notFound, redirect } from "next/navigation";
import { authorCanonicalPath, getPublicAuthor } from "../../../lib/content";

export default async function LegacyAuthorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await getPublicAuthor(id);
  if (!row) notFound();
  redirect(authorCanonicalPath(row.author));
}
