/**
 * Resizes/pads any collage dataURL into Instax Mini's native 600x800 (3:4) print canvas
 * so nothing gets unexpectedly cropped by the printer.
 */
export async function formatForInstaxMini(dataUrl: string): Promise<Blob> {
  const img = new Image();
  img.src = dataUrl;
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  // Instax Mini Link native pixel dimensions: 600w x 800h (portrait) or 800w x 600h (landscape)
  const isLandscape = img.width > img.height;
  const targetW = isLandscape ? 800 : 600;
  const targetH = isLandscape ? 600 : 800;

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetW, targetH);

  // Fit entire collage inside the Instax frame without cropping
  const scale = Math.min(targetW / img.width, targetH / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const dx = (targetW - drawW) / 2;
  const dy = (targetH - drawH) / 2;

  ctx.drawImage(img, dx, dy, drawW, drawH);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Failed to encode JPEG"))),
      "image/jpeg",
      0.92
    );
  });
}

/**
 * Opens native iOS / Android Share Sheet with the Instax-formatted image
 * so the user can tap "mini Link" directly.
 */
export async function shareToInstaxApp(dataUrl: string): Promise<boolean> {
  const blob = await formatForInstaxMini(dataUrl);
  const file = new File([blob], `snapbooth-instax-${Date.now()}.jpg`, {
    type: "image/jpeg",
  });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: "Print to Instax Mini Link",
    });
    return true;
  }
  return false;
}

/**
 * Checks if the current browser supports direct Web Bluetooth pairing
 * (Chrome/Edge/Brave on Desktop & Android over HTTPS/localhost).
 */
export function supportsDirectInstaxBluetooth(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}
