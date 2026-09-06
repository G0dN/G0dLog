import type { Metadata } from "next";
import Home from "../page";

export const metadata: Metadata = { title: "工作台", robots: { index: false, follow: false } };

export default function StudioPage() {
  return <Home initialView="studio" />;
}
