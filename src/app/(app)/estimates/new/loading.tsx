import { BrandLoader } from "@/components/brand/loader";

export default function EditorLoading() {
  return <div className="min-h-[60vh] grid place-items-center"><BrandLoader label="Setting up the editor…" /></div>;
}
