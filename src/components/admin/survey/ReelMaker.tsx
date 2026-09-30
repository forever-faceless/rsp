"use client";

import { ArrowLeft, Clapperboard, Download, Loader2, Play, Share2, Upload } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { attachUploadedVideo, type MediaOwner } from "@/lib/actions/media";
import type { LatLng } from "@/lib/db/enums";
import { drawReel, pickVideoType, prepareReel, type ReelScene, type ReelSpec } from "@/lib/reel";
import { SATELLITE_TILES, STREET_TILES } from "@/lib/tiles";
import { cn } from "@/lib/utils";
import { Notice } from "../ui";
import { uploadVideo } from "../upload-video";

export type ReelMakerProps = {
  surveyId: number;
  refText: string;
  title: string;
  location: string;
  facts: { label: string; value: string }[];
  price: string;
  phone: string;
  company: string;
  tagline: string;
  corners: LatLng[];
  sideLabels: string[];
  measures: { a: LatLng; b: LatLng; label: string; endLabel?: string }[];
  /** The listing the finished video can be attached to, when the survey belongs to one. */
  owner: MediaOwner | null;
  ownerHref: string | null;
};

const formats = {
  reel: { label: "Reel, Story, Shorts", note: "9:16 upright", width: 1080, height: 1920 },
  square: { label: "Square post", note: "1:1", width: 1080, height: 1080 },
} as const;
type FormatKey = keyof typeof formats;

function cssFont(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value ? `${value}, ${fallback}` : fallback;
}

/**
 * Builds a short video of a surveyed plot for Instagram, WhatsApp status or YouTube Shorts.
 * The film is drawn on a canvas and recorded in the browser, so it costs nothing to make.
 */
export function ReelMaker(props: ReelMakerProps) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const scene = useRef<ReelScene | null>(null);
  const frame = useRef<number | null>(null);

  const [format, setFormat] = useState<FormatKey>("reel");
  const [base, setBase] = useState<"satellite" | "map">("satellite");
  const [duration, setDuration] = useState(12);
  const [title, setTitle] = useState(props.title);
  const [price, setPrice] = useState(props.price);
  const [show, setShow] = useState({ price: Boolean(props.price), phone: Boolean(props.phone), sides: true, measures: props.measures.length > 0 });

  const [phase, setPhase] = useState<"idle" | "loading" | "ready" | "playing" | "recording">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [video, setVideo] = useState<{ url: string; blob: Blob; name: string; extension: string } | null>(null);
  const [upload, setUpload] = useState<number | null>(null);
  const [attached, setAttached] = useState(false);

  const size = formats[format];

  const stop = useCallback(() => {
    if (frame.current != null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);

  const buildSpec = useCallback(
    (): ReelSpec => ({
      width: size.width,
      height: size.height,
      duration,
      corners: props.corners,
      sideLabels: props.sideLabels,
      measures: props.measures,
      refText: props.refText,
      title: title.trim() || props.refText,
      location: props.location,
      facts: props.facts,
      price: price.trim(),
      phone: props.phone,
      company: props.company,
      tagline: props.tagline,
      show,
      tiles: base === "satellite" ? SATELLITE_TILES : STREET_TILES,
      fonts: {
        display: cssFont("--font-display-latin", "Arial, sans-serif"),
        sans: cssFont("--font-sans-latin", "Arial, sans-serif"),
        mono: cssFont("--font-mono-latin", "monospace"),
      },
      logoUrl: "/brand/logo-wide.png",
      logoFullUrl: "/brand/logo-full.png",
    }),
    [size, duration, props, title, price, show, base],
  );

  /** Loads the imagery for the current settings and shows the closing frame. */
  const prepare = useCallback(async (): Promise<ReelScene | null> => {
    stop();
    setError("");
    setNote("");
    setPhase("loading");
    setProgress(0);
    try {
      const spec = buildSpec();
      const next = await prepareReel(spec, (done, total) => setProgress(Math.round((done / total) * 100)));
      scene.current = next;
      const ctx = canvas.current?.getContext("2d");
      if (ctx) drawReel(ctx, next, spec.duration - 0.5);
      if (next.missing > 0) setNote(`${next.missing} map tiles could not be loaded, so parts of the picture may look soft. Check the connection and try again.`);
      setPhase("ready");
      return next;
    } catch {
      setError("The map imagery could not be loaded. Check the connection and try again.");
      setPhase("idle");
      return null;
    }
  }, [buildSpec, stop]);

  // Changing a setting invalidates what was prepared and recorded.
  useEffect(() => {
    scene.current = null;
    stop();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase("idle");
    setVideo((v) => {
      if (v) URL.revokeObjectURL(v.url);
      return null;
    });
    setAttached(false);
  }, [format, base, duration, title, price, show, stop]);

  useEffect(() => stop, [stop]);

  const play = async (record: boolean) => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const ready = scene.current ?? (await prepare());
    if (!ready) return;
    const total = ready.spec.duration;

    let recorder: MediaRecorder | null = null;
    const chunks: Blob[] = [];
    let type = pickVideoType();
    if (record) {
      if (!type || typeof el.captureStream !== "function") {
        setError("This browser cannot record video. Use Chrome or Edge on a computer or an Android phone.");
        return;
      }
      try {
        // Drawing a frame first makes sure the canvas is not blocked before recording starts.
        drawReel(ctx, ready, 0);
        el.toDataURL("image/jpeg", 0.1);
      } catch {
        setError("The map provider does not allow its imagery to be recorded from this address. Switch the base map, or set a different imagery provider in the site configuration.");
        return;
      }
      recorder = new MediaRecorder(el.captureStream(30), { mimeType: type.mime, videoBitsPerSecond: 9_000_000 });
      recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    }

    setError("");
    setPhase(record ? "recording" : "playing");
    setProgress(0);
    stop();

    await new Promise<void>((resolve) => {
      const started = performance.now();
      recorder?.start(250);
      const tick = (now: number) => {
        const t = Math.min(total, (now - started) / 1000);
        drawReel(ctx, ready, t);
        setProgress(Math.round((t / total) * 100));
        if (t < total) frame.current = requestAnimationFrame(tick);
        else resolve();
      };
      frame.current = requestAnimationFrame(tick);
    });

    if (recorder && type) {
      const finished = new Promise<void>((resolve) => (recorder!.onstop = () => resolve()));
      // One more frame's worth of time so the last image is written before stopping.
      await new Promise((r) => setTimeout(r, 120));
      recorder.stop();
      await finished;
      type = type ?? pickVideoType();
      const blob = new Blob(chunks, { type: type!.mime.split(";")[0] });
      const name = `${props.refText.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${format}.${type!.extension}`;
      setVideo((v) => {
        if (v) URL.revokeObjectURL(v.url);
        return { url: URL.createObjectURL(blob), blob, name, extension: type!.extension };
      });
      if (type!.extension === "webm") setNote("This browser records WebM. WhatsApp and YouTube accept it; Instagram prefers MP4, which a current version of Chrome or Edge produces.");
    }
    // Leave the finished picture on screen rather than the closing fade.
    drawReel(ctx, ready, total - 0.5);
    setPhase("ready");
  };

  const share = async () => {
    if (!video) return;
    const file = new File([video.blob], video.name, { type: video.blob.type });
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: `${props.refText} ${title}`.trim() });
      else setNote("Sharing files is not available in this browser. Download the video and post it from your gallery.");
    } catch {
      // Closing the share sheet is not an error.
    }
  };

  const attach = async () => {
    if (!video || !props.owner) return;
    setError("");
    setUpload(0);
    try {
      const url = await uploadVideo(video.blob, setUpload);
      const result = await attachUploadedVideo(props.owner, url, `${props.refText} from above`);
      if (!result.ok) throw new Error(result.error);
      setAttached(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The upload failed.");
    } finally {
      setUpload(null);
    }
  };

  const busy = phase === "loading" || phase === "playing" || phase === "recording";
  const toggle = (key: keyof typeof show) => setShow((s) => ({ ...s, [key]: !s[key] }));

  return (
    <div className="min-h-dvh bg-paper-100 p-4 sm:p-6 lg:p-9">
      <Link href={`/admin/surveys/${props.surveyId}`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-600 hover:text-navy-900">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to the survey
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span className="ref ref-lg">{props.refText}</span>
        <h1 className="text-[1.6rem] leading-tight sm:text-[1.9rem]">Video reel</h1>
      </div>
      <p className="mt-2 max-w-2xl text-[14px] text-ink-600">A short film of the plot from above, ready for Instagram, WhatsApp status and YouTube Shorts. It is made on this device; nothing is uploaded unless you choose to attach it to the listing.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="card bg-grid flex flex-col items-center justify-center p-4 sm:p-6">
          <div className="relative w-full" style={{ maxWidth: format === "reel" ? 360 : 520 }}>
            <canvas ref={canvas} width={size.width} height={size.height} className="h-auto w-full bg-navy-900 shadow-lift" style={{ aspectRatio: `${size.width} / ${size.height}` }} aria-label="Preview of the video" />
            {phase === "idle" ? (
              <button type="button" onClick={() => void prepare()} className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-navy-900/80 text-paper-50">
                <Clapperboard className="h-9 w-9 text-gold-300" aria-hidden="true" />
                <span className="text-[14px] font-semibold">Load the preview</span>
              </button>
            ) : null}
            {phase === "loading" ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-navy-900/85 text-paper-50" role="status">
                <Loader2 className="h-7 w-7 animate-spin text-gold-300" aria-hidden="true" />
                <span className="num text-[13px]">Loading the imagery, {progress}%</span>
              </div>
            ) : null}
          </div>
          {phase === "playing" || phase === "recording" ? (
            <div className="mt-4 w-full max-w-[520px]" role="status">
              <div className="h-1.5 w-full overflow-hidden bg-navy-900/10">
                <div className="h-full bg-gold-500" style={{ width: `${progress}%` }} />
              </div>
              <p className="num mt-1.5 text-center text-xs text-ink-600">{phase === "recording" ? `Recording, ${progress}%. Keep this tab open and in front.` : `Playing, ${progress}%`}</p>
            </div>
          ) : null}
        </div>

        <div className="space-y-5">
          <section className="card space-y-4 p-4 sm:p-5">
            <h2 className="label-mono">Format</h2>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(formats) as FormatKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  disabled={busy}
                  onClick={() => setFormat(key)}
                  aria-pressed={format === key}
                  className={cn("rounded-[3px] border px-3 py-2.5 text-left transition-colors", format === key ? "border-navy-900 bg-navy-900 text-paper-50" : "border-navy-900/18 bg-paper-0 text-ink-700 hover:border-navy-800")}
                >
                  <span className="block text-[13.5px] font-semibold">{formats[key].label}</span>
                  <span className={cn("num block text-[11.5px]", format === key ? "text-gold-200" : "text-ink-500")}>{formats[key].note}</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-[12.5px] font-semibold text-ink-700">
                Length
                <select value={duration} disabled={busy} onChange={(e) => setDuration(Number(e.target.value))} className="field mt-1 text-[14px]">
                  <option value={10}>10 seconds</option>
                  <option value={12}>12 seconds</option>
                  <option value={15}>15 seconds</option>
                  <option value={20}>20 seconds</option>
                </select>
              </label>
              <label className="text-[12.5px] font-semibold text-ink-700">
                Picture
                <select value={base} disabled={busy} onChange={(e) => setBase(e.target.value as "satellite" | "map")} className="field mt-1 text-[14px]">
                  <option value="satellite">Satellite image</option>
                  <option value="map">Street map</option>
                </select>
              </label>
            </div>
          </section>

          <section className="card space-y-3 p-4 sm:p-5">
            <h2 className="label-mono">What it says</h2>
            <label className="block text-[12.5px] font-semibold text-ink-700">
              Title
              <input value={title} disabled={busy} onChange={(e) => setTitle(e.target.value)} maxLength={70} className="field mt-1" />
            </label>
            <label className="block text-[12.5px] font-semibold text-ink-700">
              Price
              <input value={price} disabled={busy} onChange={(e) => setPrice(e.target.value)} maxLength={24} placeholder="₹52 L" className="field num mt-1" />
            </label>
            <div className="grid grid-cols-2 gap-2 pt-1">
              {(
                [
                  ["sides", "Side lengths"],
                  ["measures", "Extra distances"],
                  ["price", "Price"],
                  ["phone", "Phone number"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex min-h-10 items-center gap-2.5 rounded-[3px] border border-navy-900/15 px-3 text-[13.5px] font-medium text-ink-800">
                  <input type="checkbox" checked={show[key]} disabled={busy} onChange={() => toggle(key)} className="check !mt-0" />
                  {label}
                </label>
              ))}
            </div>
          </section>

          {error ? <Notice tone="error">{error}</Notice> : null}
          {note ? <Notice tone="info">{note}</Notice> : null}

          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={busy} onClick={() => void play(false)} className="btn-outline">
              <Play className="h-4 w-4" aria-hidden="true" /> Preview
            </button>
            <button type="button" disabled={busy} onClick={() => void play(true)} className="btn-primary">
              {phase === "recording" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Clapperboard className="h-4 w-4" aria-hidden="true" />}
              Make the video
            </button>
          </div>

          {video ? (
            <section className="card space-y-3 border-gold-500/60 p-4 sm:p-5">
              <h2 className="label-mono !text-gold-700">Your video is ready</h2>
              <video src={video.url} controls playsInline className="w-full bg-navy-950" style={{ aspectRatio: `${size.width} / ${size.height}`, maxHeight: 320 }} />
              <p className="num text-xs text-ink-500">
                {video.name} · {(video.blob.size / 1024 / 1024).toFixed(1)} MB
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <a href={video.url} download={video.name} className="btn-gold">
                  <Download className="h-4 w-4" aria-hidden="true" /> Download
                </a>
                <button type="button" onClick={() => void share()} className="btn-outline">
                  <Share2 className="h-4 w-4" aria-hidden="true" /> Share
                </button>
              </div>
              {props.owner ? (
                attached ? (
                  <Notice tone="success">
                    Added to the listing.{" "}
                    {props.ownerHref ? (
                      <Link href={props.ownerHref} className="underline">
                        Open the listing
                      </Link>
                    ) : null}
                  </Notice>
                ) : (
                  <button type="button" disabled={upload != null} onClick={() => void attach()} className="btn-ghost w-full !justify-start">
                    {upload != null ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
                    {upload != null ? `Uploading, ${upload}%` : "Also show it on the listing's page"}
                  </button>
                )
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
