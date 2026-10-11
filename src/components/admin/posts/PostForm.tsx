"use client";

import { CalendarClock, Loader2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ActionState } from "@/lib/forms";
import { fileInputClass } from "../ImageInput";
import { Notice } from "../ui";
import { uploadVideo } from "../upload-video";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  /** The listings a post can be about. */
  options: { value: string; label: string }[];
  /** The time the date box opens on, and the earliest it allows, as Indian time. */
  defaultWhen: string;
  minWhen: string;
};

const VIDEO = new Set(["video/mp4", "video/quicktime"]);
const ACCEPT = "video/mp4,video/quicktime,image/jpeg,image/png,image/webp,image/heic,image/heif";
const MAX_CAPTION = 2200;

/** How long a video runs, in seconds, when the browser can tell. */
function videoLength(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = window.setTimeout(() => done(null), 4000);
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      window.clearTimeout(timer);
      done(Number.isFinite(video.duration) ? video.duration : null);
    };
    video.onerror = () => {
      window.clearTimeout(timer);
      done(null);
    };
    video.src = url;
  });
}

/**
 * Makes a photo ready for Instagram in the browser: a JPEG no wider than 1440 pixels, which is
 * all Instagram shows and small enough to send. Says so when its shape is one Instagram refuses.
 */
async function toJpeg(file: File): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // The server reads formats this browser cannot.
    return file;
  }
  const shape = bitmap.width / bitmap.height;
  if (shape < 0.79 || shape > 1.92) {
    bitmap.close();
    throw new Error(`Instagram takes photos between 4:5 (upright) and 1.91:1 (wide). This one is too ${shape < 0.79 ? "tall" : "wide"}. Crop it and try again.`);
  }
  const scale = Math.min(1, 1440 / bitmap.width, 1800 / bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  return blob ? new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
}

/** Lines up a reel or a photo for Instagram: the file, the caption, the property it is about, and when. */
export function PostForm({ action, options, defaultWhen, minWhen }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  // A video that has already been uploaded, kept so a second try does not send it again.
  const uploaded = useRef<{ file: File; url: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [caption, setCaption] = useState("");
  const [ref, setRef] = useState("");
  const [when, setWhen] = useState(defaultWhen);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState<"" | "later" | "now">("");
  const [state, setState] = useState<ActionState>(undefined);

  const isVideo = file ? VIDEO.has(file.type) || /\.(mp4|mov)$/i.test(file.name) : false;

  // The chosen file is shown straight from this device; its temporary address is given back when done with.
  const previewUrl = useRef("");
  const choose = (picked: File | null) => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = picked ? URL.createObjectURL(picked) : "";
    setPreview(previewUrl.current);
    setFile(picked);
  };
  useEffect(
    () => () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    },
    [],
  );

  const send = async (now: boolean) => {
    setState(undefined);
    if (!file) {
      setState({ error: "Choose a video or a photo first." });
      return;
    }
    setBusy(now ? "now" : "later");
    try {
      const data = new FormData();
      data.set("caption", caption);
      data.set("ref", ref);
      data.set("when", when);
      if (now) data.set("now", "1");
      if (isVideo) {
        const seconds = await videoLength(file);
        if (seconds != null && seconds < 3) throw new Error("Instagram needs a reel to be at least 3 seconds long.");
        if (seconds != null && seconds > 15 * 60) throw new Error("Instagram takes reels up to 15 minutes long.");
        if (uploaded.current?.file !== file) {
          setProgress(0);
          uploaded.current = { file, url: await uploadVideo(file, setProgress) };
          setProgress(null);
        }
        data.set("videoUrl", uploaded.current.url);
      } else {
        data.set("photo", await toJpeg(file));
      }
      const result = await action(undefined, data);
      setState(result);
      if (result?.success) {
        uploaded.current = null;
        choose(null);
        setCaption("");
        setRef("");
        setWhen(defaultWhen);
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      }
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : "That did not work. Please try again." });
    } finally {
      setBusy("");
      setProgress(null);
    }
  };

  const tag = ref ? `[${ref}]` : "";
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_15rem]" data-post-form>
      <div className="space-y-4">
        <div>
          <label htmlFor="post-file" className="label">
            Video or photo
          </label>
          <input
            ref={fileRef}
            id="post-file"
            type="file"
            accept={ACCEPT}
            disabled={busy !== ""}
            onChange={(ev) => {
              setState(undefined);
              choose(ev.target.files?.[0] ?? null);
            }}
            className={fileInputClass}
          />
          <p className="help">A video goes out as a reel: MP4 or MOV, upright, up to 300 MB. A photo goes out as a post.</p>
        </div>

        <div>
          <label htmlFor="post-ref" className="label">
            Which property it is about
          </label>
          <select id="post-ref" value={ref} onChange={(ev) => setRef(ev.target.value)} disabled={busy !== ""} className="field">
            <option value="">Not about one property</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="help">Anyone who comments on it, or shares it to you in a message, is then sent this property&apos;s details.</p>
        </div>

        <div>
          <label htmlFor="post-caption" className="label">
            Caption
          </label>
          <textarea id="post-caption" value={caption} onChange={(ev) => setCaption(ev.target.value)} rows={5} maxLength={MAX_CAPTION} disabled={busy !== ""} className="field text-[15px] leading-relaxed" />
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            {tag && !caption.toUpperCase().includes(ref.toUpperCase()) ? (
              <button type="button" onClick={() => setCaption(`${tag} ${caption}`.trimEnd())} className="text-[12.5px] font-semibold text-navy-800 underline decoration-gold-500 decoration-2 underline-offset-4">
                Start the caption with {tag}
              </button>
            ) : (
              <span />
            )}
            <span className="num text-[12px] text-ink-400">
              {caption.length.toLocaleString("en-IN")} / {MAX_CAPTION.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        <div className="max-w-xs">
          <label htmlFor="post-when" className="label">
            When it goes out
          </label>
          <input id="post-when" type="datetime-local" value={when} min={minWhen} onChange={(ev) => setWhen(ev.target.value)} disabled={busy !== ""} className="field" />
          <p className="help">Indian time.</p>
        </div>

        {progress != null ? (
          <div aria-live="polite">
            <div className="h-1.5 w-full overflow-hidden bg-navy-900/10">
              <div className="h-full bg-gold-500 transition-[width] duration-200" style={{ width: `${progress}%` }} />
            </div>
            <p className="num mt-1.5 text-xs text-ink-600">Uploading the video, {progress}%</p>
          </div>
        ) : null}
        {state?.error ? <Notice tone="error">{state.error}</Notice> : null}
        {state?.success ? <Notice tone="success">{state.success}</Notice> : null}

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => send(false)} disabled={busy !== ""} className="btn-primary">
            {busy === "later" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CalendarClock className="h-4 w-4" aria-hidden="true" />}
            Schedule
          </button>
          <button type="button" onClick={() => send(true)} disabled={busy !== ""} className="btn-outline">
            {busy === "now" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
            Post now
          </button>
        </div>
      </div>

      <div>
        <p className="label">Preview</p>
        <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-[3px] border border-navy-900/12 bg-paper-100 text-center text-[13px] text-ink-500">
          {preview && isVideo ? (
            <video src={preview} controls muted playsInline className="h-full w-full bg-navy-950 object-contain" />
          ) : preview ? (
            // A file still on this device has no address the image optimiser could fetch.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="px-4">The video or photo you choose shows here.</span>
          )}
        </div>
      </div>
    </div>
  );
}
