import Home from "../../page";

export default async function ColumnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Home initialColumnId={id} />;
}
