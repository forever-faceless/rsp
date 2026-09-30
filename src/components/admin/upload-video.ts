"use client";

/** Sends the file straight to disk on our own server, reporting progress as it goes. */
function uploadToDisk(file: Blob, type: string, onProgress: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/videos");
    xhr.setRequestHeader("Content-Type", type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText) as { url?: string; error?: string };
        if (xhr.status >= 200 && xhr.status < 300 && data.url) resolve(data.url);
        else reject(new Error(data.error ?? "The upload failed."));
      } catch {
        reject(new Error("The upload failed."));
      }
    };
    xhr.onerror = () => reject(new Error("The connection dropped during the upload."));
    xhr.send(file);
  });
}

async function uploadToBlob(file: Blob, type: string, extension: string, onProgress: (pct: number) => void): Promise<string> {
  const { upload } = await import("@vercel/blob/client");
  const blob = await upload(`rsp-ventures/videos/video${extension}`, file, {
    access: "public",
    handleUploadUrl: "/api/admin/blob",
    contentType: type,
    multipart: file.size > 20 * 1024 * 1024,
    onUploadProgress: (p) => onProgress(Math.round(p.percentage)),
  });
  return blob.url;
}

const extensions: Record<string, string> = { "video/mp4": ".mp4", "video/quicktime": ".mov", "video/webm": ".webm" };

/**
 * Uploads a video to wherever this deployment keeps its files and returns its address.
 * On our own server it goes to disk; on a serverless host it goes directly to the blob store.
 */
export async function uploadVideo(file: Blob, onProgress: (pct: number) => void): Promise<string> {
  const type = (file.type || "video/mp4").split(";")[0];
  if (!extensions[type]) throw new Error("Use an MP4, MOV or WebM video.");
  const info = (await fetch("/api/admin/videos", { cache: "no-store" }).then((r) => r.json())) as { mode?: string; maxBytes?: number; error?: string };
  if (!info.mode) throw new Error(info.error ?? "Please sign in again.");
  if (info.maxBytes && file.size > info.maxBytes) {
    throw new Error(`This video is ${Math.round(file.size / 1024 / 1024)} MB. The limit is ${Math.round(info.maxBytes / 1024 / 1024)} MB.`);
  }
  return info.mode === "blob" ? uploadToBlob(file, type, extensions[type], onProgress) : uploadToDisk(file, type, onProgress);
}
