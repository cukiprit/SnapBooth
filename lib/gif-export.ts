import { encode } from "modern-gif";

export interface GifExportOptions {
  /** Captured slot image data URLs in order */
  photos: string[];
  /** Canvas filter string matching the selected photo booth filter (e.g., "contrast(1.1) saturate(1.2)") */
  canvasFilter?: string;
  /** Frame delay in milliseconds (default: 380ms for flipbook, 180ms for boomerang) */
  delayMs?: number;
  /** Loop back and forth (1-2-3-4-3-2) instead of straight loop */
  boomerang?: boolean;
  /** Output width in pixels (keep <= 480px so encoding stays fast on mobile) */
  width?: number;
  /** Output height in pixels */
  height?: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function generateBoothGif({
  photos,
  canvasFilter = "none",
  delayMs,
  boomerang = false,
  width = 480,
  height = 360,
}: GifExportOptions): Promise<Blob> {
  if (photos.length === 0) {
    throw new Error("No photos available to encode.");
  }

  const sequence =
    boomerang && photos.length > 2
      ? [...photos, ...photos.slice(1, -1).reverse()]
      : photos;

  const frameDelay = delayMs ?? (boomerang ? 180 : 380);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Could not initialize 2D canvas context.");
  }

  const frames: { data: BufferSource; delay: number }[] = [];

  for (const src of sequence) {
    const img = await loadImage(src);

    ctx.save();
    ctx.clearRect(0, 0, width, height);
    ctx.filter = canvasFilter;

    // Cover-crop the image cleanly into the target GIF aspect ratio
    const scale = Math.max(width / img.width, height / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const offsetX = (width - drawW) / 2;
    const offsetY = (height - drawH) / 2;

    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
    ctx.restore();

    const imageData = ctx.getImageData(0, 0, width, height);
    frames.push({ data: imageData.data.buffer, delay: frameDelay });
  }

  return await encode({
    width,
    height,
    frames,
    format: "blob",
  });
}
