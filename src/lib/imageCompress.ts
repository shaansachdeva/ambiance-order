"use client";

// Down-scales + re-encodes oversized images on the client so uploads survive
// any reverse-proxy body limit (typical nginx default is 1MB; modern phones
// produce 5-15MB JPEGs/HEICs out of the box).

export interface CompressOptions {
  maxDim?: number;    // Largest dimension (px) the output may have.
  quality?: number;   // JPEG quality, 0..1.
  maxBytes?: number;  // Try harder if first pass is still over this size.
}

export async function compressImage(
  file: File,
  { maxDim = 1600, quality = 0.82, maxBytes = 1_000_000 }: CompressOptions = {}
): Promise<File> {
  if (typeof window === "undefined") return file;
  if (!file.type.startsWith("image/")) return file;

  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("Could not decode image"));
    i.src = dataUrl;
  });

  let targetDim = maxDim;
  let targetQuality = quality;
  let out: Blob | null = null;

  for (let attempt = 0; attempt < 4; attempt++) {
    let { width, height } = img;
    if (Math.max(width, height) > targetDim) {
      const ratio = targetDim / Math.max(width, height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);
    out = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", targetQuality));
    if (!out) return file;
    if (out.size <= maxBytes) break;
    // Still too big — shrink dimension + lower quality and retry.
    targetDim = Math.round(targetDim * 0.8);
    targetQuality = Math.max(0.55, targetQuality - 0.1);
  }

  if (!out) return file;
  if (out.size >= file.size) return file; // already small enough

  const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([out], newName, { type: "image/jpeg" });
}
