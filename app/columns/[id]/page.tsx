import { notFound, redirect } from "next/navigation";
import { columnCanonicalPath, getPublicColumn } from "../../../lib/content";

export default async function LegacyColumnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await getPublicColumn(id);
  if (!row) notFound();
  redirect(columnCanonicalPath(row.column));
}
