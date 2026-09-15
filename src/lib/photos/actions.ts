"use server";

import { requireOrg } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";

const TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Upload a job photo (already resized client-side) and return its public URL. */
export async function uploadJobPhoto(fd: FormData): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { user } = await requireOrg();
  const file = fd.get("photo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "No file" };
  if (!TYPES.includes(file.type)) return { ok: false, error: "Use JPG, PNG or WebP" };
  if (file.size > 5 * 1024 * 1024) return { ok: false, error: "Max 5 MB" };

  const supabase = await createSupabaseServer();
  const ext = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from("job-photos").upload(path, file, { contentType: file.type });
  if (error) return { ok: false, error: `Upload failed: ${error.message}` };

  return { ok: true, url: supabase.storage.from("job-photos").getPublicUrl(path).data.publicUrl };
}
