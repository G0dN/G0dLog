import Home from "../../page";

export default async function AuthorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Home initialAuthorId={id} />;
}
