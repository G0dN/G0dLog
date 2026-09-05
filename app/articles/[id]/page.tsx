import Home from "../../page";

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Home initialView="reader" initialArticleId={id} />;
}
