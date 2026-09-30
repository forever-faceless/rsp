"use client";

import { Film, Link2, Loader2, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useRef, useState, useTransition } from "react";
import type { VideoItem } from "@/lib/db/enums";
import type { ActionState } from "@/lib/forms";
import { youtubeEmbedUrl } from "@/lib/utils";
import { fileInputClass } from "./ImageInput";
import { FormStatus, Input, Notice, SubmitButton } from "./ui";
import { uploadVideo } from "./upload-video";
import { ActionForm } from "@/components/ActionForm";

type Props = {
  videos: VideoItem[];
  linkAction: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  attachAction: (url: string, title: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  removeAction: (url: string) => Promise<void>;
};

const ACCEPT = "video/mp4,video/quicktime,video/webm";

/**
 * Videos of a listing: walkthroughs filmed on site, reels made in the survey studio, or
 * links to something already posted on YouTube or Instagram.
 */
export function VideoManager({ videos, linkAction, attachAction, removeAction }: Props) {
  const router = useRouter();
  const [linkState, linkFormAction, linking] = useActionState<ActionState, FormData>(linkAction, undefined);
  const [pending, start] = useTransition();
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);

  const send = async () => {
    const file = fileRef.current?.files?.[0];
    setError("");
    setDone("");
    if (!file) {
      setError("Choose a video first.");
      return;
    }
    setProgress(0);
    try {
      const url = await uploadVideo(file, setProgress);
      const result = await attachAction(url, titleRef.current?.value ?? "");
      if (!result.ok) throw new Error(result.error);
      if (fileRef.current) fileRef.current.value = "";
      if (titleRef.current) titleRef.current.value = "";
      setDone("Video uploaded.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The upload failed.");
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-[4px] border border-navy-900/12 bg-paper-50 p-4">
          <p className="flex items-center gap-2 text-[14px] font-semibold text-navy-900">
            <Film className="h-4 w-4 text-gold-600" aria-hidden="true" /> Upload a video file
          </p>
          <input ref={fileRef} type="file" accept={ACCEPT} className={fileInputClass} aria-label="Video file" />
          <input ref={titleRef} type="text" placeholder="Title (optional)" maxLength={120} className="field" aria-label="Video title" />
          <p className="help !mt-0">MP4, MOV or WebM, up to 300 MB. Record in 1080p rather than 4K to keep the upload quick.</p>
          {progress != null ? (
            <div aria-live="polite">
              <div className="h-1.5 w-full overflow-hidden bg-navy-900/10">
                <div className="h-full bg-gold-500 transition-[width] duration-200" style={{ width: `${progress}%` }} />
              </div>
              <p className="num mt-1.5 text-xs text-ink-600">Uploading, {progress}%</p>
            </div>
          ) : null}
          {error ? <Notice tone="error">{error}</Notice> : null}
          {done ? <Notice tone="success">{done}</Notice> : null}
          <button type="button" onClick={send} disabled={progress != null} className="btn-primary btn-sm">
            {progress != null ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
            Upload video
          </button>
        </div>

        <ActionForm key={linkState?.success ? "sent" : "form"} action={linkFormAction} pending={linking} className="space-y-3 rounded-[4px] border border-navy-900/12 bg-paper-50 p-4">
          <p className="flex items-center gap-2 text-[14px] font-semibold text-navy-900">
            <Link2 className="h-4 w-4 text-gold-600" aria-hidden="true" /> Or link to a posted video
          </p>
          <Input label="Link" name="url" type="url" inputMode="url" placeholder="https://youtube.com/shorts/..." required />
          <Input label="Title (optional)" name="title" maxLength={120} />
          <p className="help !mt-0">YouTube links play on the page. Instagram and Facebook links open in a new tab.</p>
          <FormStatus state={linkState} />
          <SubmitButton variant="outline" className="btn-sm">
            Add link
          </SubmitButton>
        </ActionForm>
      </div>

      {videos.length ? (
        <ul className="divide-y divide-navy-900/8 rounded-[4px] border border-navy-900/12 bg-paper-0">
          {videos.map((v) => (
            <li key={v.url} className="flex flex-wrap items-center gap-3 px-4 py-3">
              {v.kind === "file" ? <video src={v.url} preload="metadata" muted playsInline className="h-14 w-24 bg-navy-950 object-cover" /> : <span className="flex h-14 w-24 items-center justify-center bg-navy-900 text-gold-300"><Link2 className="h-5 w-5" aria-hidden="true" /></span>}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-navy-900">{v.title || (v.kind === "file" ? "Uploaded video" : "Linked video")}</p>
                <a href={v.url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-ink-500 hover:underline">
                  {v.kind === "link" && youtubeEmbedUrl(v.url) ? "Plays on the page: " : ""}
                  {v.url}
                </a>
              </div>
              <button type="button" disabled={pending} onClick={() => start(() => removeAction(v.url))} className="btn-danger btn-sm">
                <X className="h-4 w-4" aria-hidden="true" /> Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13.5px] text-ink-500">No videos yet.</p>
      )}
    </div>
  );
}
