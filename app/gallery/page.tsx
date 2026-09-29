import type { Metadata } from "next";
import { Gallery } from "@/components/Gallery";

export const metadata: Metadata = {
  title: "Gallery · Harmony",
  description: "Harmonograph curves saved by friends, redrawn live from their frequencies.",
};

export default function GalleryPage() {
  return <Gallery />;
}
