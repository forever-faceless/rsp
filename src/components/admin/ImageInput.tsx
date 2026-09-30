"use client";

import { useEffect, useRef, useState } from "react";
import { FILES_CLEARED } from "@/components/ActionForm";
import { cn } from "@/lib/utils";

const MAX_EDGE = 1800;
const QUALITY = 0.82;
const SKIP_BELOW_BYTES = 300_000;
/** Vercel (and most serverless hosts) reject request bodies above ~4.5 MB. */
const SOFT_TOTAL_LIMIT = 4_000_000;

const DECODABLE = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/heic", "image/heif"]);

type Drawable = ImageBitmap | HTMLImageElement;

async function decode(file: File): Promise<Drawable | null> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Fall back to <img>; Safari can decode HEIC this way.
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  }
}

/**
 * Resizes a photo to at most 1800px on the long edge and re-encodes it as WebP
 * in the browser, so a 4 MB phone photo becomes ~300 KB before it is uploaded.
 * Returns the original file when it is already small or cannot be decoded.
 */
export async function compressImage(file: File): Promise<File> {
  const heic = /\.(heic|heif)$/i.test(file.name) || file.type === "image/heic" || file.type === "image/heif";
  if (!DECODABLE.has(file.type) && !heic) return file;
  if (file.size < SKIP_BELOW_BYTES && !heic) return file;

  const src = await decode(file);
  if (!src) return file;
  const w = "naturalWidth" in src ? src.naturalWidth : src.width;
  const h = "naturalHeight" in src ? src.naturalHeight : src.height;
  if (!w || !h) return file;

  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  if ("close" in src) src.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", QUALITY));
  if (!blob) return file;
  if (blob.size >= file.size && scale === 1 && !heic) return file;
  const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
  return new File([blob], name, { type: "image/webp", lastModified: file.lastModified });
}

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "accept" | "onChange"> & {
  name: string;
  maxFiles?: number;
};

export const fileInputClass =
  "field cursor-pointer file:mr-3 file:cursor-pointer file:rounded-[2px] file:border-0 file:bg-navy-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-paper-0";

/**
 * A file input that compresses chosen photos in place. It keeps working as a
 * normal form field, so server actions receive the already-compressed files.
 */
export function ImageInput({ name, maxFiles = 10, multiple, className, ...rest }: Props) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const clear = () => setStatus("");
    form.addEventListener(FILES_CLEARED, clear);
    return () => form.removeEventListener(FILES_CLEARED, clear);
  }, []);

  const onChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const chosen = Array.from(input.files ?? []);
    if (!chosen.length) {
      setStatus("");
      return;
    }
    const form = input.form;
    const block = (e: Event) => e.preventDefault();
    form?.addEventListener("submit", block);
    setBusy(true);
    setStatus(`Preparing ${chosen.length} photo${chosen.length > 1 ? "s" : ""}`);
    try {
      const limited = chosen.slice(0, multiple ? maxFiles : 1);
      const out: File[] = [];
      for (const f of limited) out.push(await compressImage(f));
      const dt = new DataTransfer();
      for (const f of out) dt.items.add(f);
      input.files = dt.files;
      const total = out.reduce((a, f) => a + f.size, 0);
      const mb = (total / 1024 / 1024).toFixed(1);
      const dropped = chosen.length - limited.length;
      let text = `${out.length} photo${out.length > 1 ? "s" : ""} ready, ${mb} MB`;
      if (dropped > 0) text += `. Only the first ${maxFiles} were kept`;
      if (total > SOFT_TOTAL_LIMIT) text += ". Over 4 MB: upload fewer photos at a time";
      setStatus(text);
    } finally {
      setBusy(false);
      form?.removeEventListener("submit", block);
    }
  };

  return (
    <>
      <input ref={input} type="file" accept="image/*" name={name} multiple={multiple} onChange={onChange} aria-busy={busy} className={cn(fileInputClass, className)} {...rest} />
      {status ? <p className={cn("mt-1.5 text-xs", busy ? "text-gold-700" : "text-ink-500")}>{status}</p> : null}
    </>
  );
}
