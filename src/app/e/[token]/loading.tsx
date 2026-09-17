import { BrandLoader } from "@/components/brand/loader";

export default function PublicLoading() {
  return <main className="min-h-screen bg-neutral-100 grid place-items-center"><BrandLoader label="Loading your document…" /></main>;
}
