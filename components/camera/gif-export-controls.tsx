"use client";

import { useState } from "react";
import { Film, Loader2 } from "lucide-react";
import { generateBoothGif } from "@/lib/gif-export";

interface GifExportControlsProps {
  capturedPhotos: string[];
  activeCanvasFilter: string;
}

export function GifExportControls({
  capturedPhotos,
  activeCanvasFilter,
}: GifExportControlsProps) {
  const [isEncoding, setIsEncoding] = useState(false);
  const [boomerang, setBoomerang] = useState(true);

  const validPhotos = capturedPhotos.filter(Boolean);
  const canExportGif = validPhotos.length >= 2;

  async function handleExportGif() {
    if (!canExportGif || isEncoding) return;
    setIsEncoding(true);

    try {
      const blob = await generateBoothGif({
        photos: validPhotos,
        canvasFilter: activeCanvasFilter,
        boomerang,
        width: 480,
        height: 360,
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `snapbooth-${boomerang ? "boomerang" : "flipbook"}-${Date.now()}.gif`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("GIF export failed:", err);
    } finally {
      setIsEncoding(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={!canExportGif || isEncoding}
        onClick={() => setBoomerang((prev) => !prev)}
        title="Toggle Boomerang bounce vs straight loop"
        className={`brutal-btn h-10 px-2.5 font-pixel text-[10px] font-bold uppercase disabled:cursor-not-allowed disabled:opacity-40 ${boomerang ? "bg-[#facc15] text-zinc-950" : "bg-white text-zinc-700"
          }`}
      >
        {boomerang ? "BOOMERANG" : "LOOP"}
      </button>

      <button
        type="button"
        onClick={handleExportGif}
        disabled={!canExportGif || isEncoding}
        className="brutal-btn flex h-10 flex-1 items-center justify-center gap-1.5 bg-[#22d3ee] px-3 font-pixel text-xs font-bold uppercase text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isEncoding ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            ENCODING...
          </>
        ) : (
          <>
            <Film className="h-4 w-4" />
            EXPORT GIF ({validPhotos.length})
          </>
        )}
      </button>
    </div>
  );
}
