"use client";

import { useRef, useState } from "react";
import { Camera, Eye, EyeOff, ImagePlus, Loader2, X } from "lucide-react";
import { uploadJobPhoto } from "@/lib/photos/actions";
import { cn } from "@/lib/utils";

export type PhotoValue = { url: string; caption: string | null; showOnDocument: boolean };

/** Downscale to ≤1600px and re-encode as JPEG so phone photos (4–12 MB) upload in a second. */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.85));
}

export function PhotoUploader({ value, onChange }: { value: PhotoValue[]; onChange: (v: PhotoValue[]) => void }) {
  const [uploading, setUploading] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setErr(null);
    const list = Array.from(files).slice(0, 20 - value.length);
    setUploading((n) => n + list.length);
    const added: PhotoValue[] = [];
    await Promise.all(
      list.map(async (f) => {
        try {
          const blob = await shrink(f);
          const fd = new FormData();
          fd.append("photo", new File([blob], "photo.jpg", { type: "image/jpeg" }));
          const r = await uploadJobPhoto(fd);
          if (r.ok) added.push({ url: r.url, caption: null, showOnDocument: true });
          else setErr(r.error);
        } catch {
          setErr("Couldn't process that image");
        } finally {
          setUploading((n) => n - 1);
        }
      }),
    );
    if (added.length) onChange([...value, ...added]);
  }

  const update = (i: number, patch: Partial<PhotoValue>) => onChange(value.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const remove = (i: number) => onChange(value.filter((_, j) => j !== i));

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {/* capture=environment opens the rear camera directly on phones */}
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
        <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
        <button type="button" onClick={() => cameraRef.current?.click()} className="flex-1 sm:flex-none inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium hover:bg-background">
          <Camera className="h-4 w-4" /> Take photo
        </button>
        <button type="button" onClick={() => galleryRef.current?.click()} className="flex-1 sm:flex-none inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium hover:bg-background">
          <ImagePlus className="h-4 w-4" /> From gallery
        </button>
      </div>
      {err && <p className="text-xs text-danger">{err}</p>}

      {(value.length > 0 || uploading > 0) && (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {value.map((p, i) => (
            <li key={p.url} className="rounded-lg border border-border overflow-hidden bg-surface">
              <div className="relative aspect-[4/3] bg-black/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.caption ?? ""} className={cn("h-full w-full object-cover", !p.showOnDocument && "opacity-50")} />
                <button type="button" onClick={() => remove(i)} aria-label="Remove photo" className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-black/60 text-white grid place-items-center"><X className="h-4 w-4" /></button>
                <button type="button" onClick={() => update(i, { showOnDocument: !p.showOnDocument })} title={p.showOnDocument ? "Shown on the estimate" : "Hidden from the estimate"} className="absolute bottom-1.5 left-1.5 h-7 px-2 rounded-full bg-black/60 text-white inline-flex items-center gap-1 text-[11px]">
                  {p.showOnDocument ? <><Eye className="h-3.5 w-3.5" /> On doc</> : <><EyeOff className="h-3.5 w-3.5" /> Internal</>}
                </button>
              </div>
              <input value={p.caption ?? ""} onChange={(e) => update(i, { caption: e.target.value })} placeholder="Caption (optional)" className="w-full px-2 h-9 text-xs bg-transparent focus:outline-none" />
            </li>
          ))}
          {Array.from({ length: uploading }).map((_, i) => (
            <li key={`u${i}`} className="rounded-lg border border-dashed border-border aspect-[4/3] grid place-items-center text-muted"><Loader2 className="h-5 w-5 animate-spin" /></li>
          ))}
        </ul>
      )}
    </div>
  );
}
