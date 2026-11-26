"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Camera,
  Download,
  FlipHorizontal,
  RefreshCw,
  Sparkles,
  Timer,
  Trash2,
  LayoutGrid,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { CAMERA_FILTERS, type CameraFilter } from "@/lib/filters";
import { GRID_LAYOUTS, type GridLayout } from "@/lib/grid-layouts";

const FRAME_THEMES = [
  { id: "classic-white", label: "WHITE", bg: "#ffffff", text: "#09090b" },
  { id: "midnight-black", label: "VOID", bg: "#09090b", text: "#facc15" },
  { id: "sakura-pink", label: "PINK", bg: "#fbcfe8", text: "#831843" },
  { id: "arcade-yellow", label: "CYBER", bg: "#fef08a", text: "#09090b" },
];

const BUILTIN_PNG_STICKERS = [
  { id: "star", label: "Star", src: "/stickers/star.png" },
  { id: "heart", label: "Heart", src: "/stickers/heart.png" },
  { id: "red-heart", label: "Red Heart", src: "/stickers/red-heart.png" },
  { id: "web", label: "Web", src: "/stickers/web.png" },
];

interface PlacedSticker {
  id: string;
  src: string;   // "/stickers/star.png" OR uploaded "data:image/png;base64,..."
  x: number;     // 0 to 1 (normalized center X)
  y: number;     // 0 to 1 (normalized center Y)
  size: number;  // base pixel width on the exported collage
}

export function PhotoBooth() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);

  const [streamError, setStreamError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [mirrorView, setMirrorView] = useState(true);

  const [activeFilter, setActiveFilter] = useState<CameraFilter>(CAMERA_FILTERS[0]);
  const [intensity, setIntensity] = useState<number>(80);

  const [selectedLayout, setSelectedLayout] = useState<GridLayout>(GRID_LAYOUTS[3]);
  const [useTimer, setUseTimer] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);

  const [capturedShots, setCapturedShots] = useState<string[]>([]);
  const [frameTheme, setFrameTheme] = useState(FRAME_THEMES[0]);
  const [customCaption, setCustomCaption] = useState("SNAPBOOTH.EXE");
  const [stickers, setStickers] = useState<PlacedSticker[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const [finalOutput, setFinalOutput] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // 1. Start / Switch Webcam Stream
  useEffect(() => {
    let isCancelled = false;
    let currentStream: MediaStream | null = null;

    async function startCamera() {
      setStreamError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (isCancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        currentStream = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (err) {
        if (isCancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;

        const message =
          err instanceof DOMException
            ? `${err.name}: ${err.message}`
            : "Camera access denied or unavailable.";
        setStreamError(message);
      }
    }

    startCamera();

    return () => {
      isCancelled = true;
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode]);

  // 2. Real-Time Filter & Effect Render Loop
  useEffect(() => {
    function renderFrame() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState >= 2) {
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          const w = video.videoWidth || 640;
          const h = video.videoHeight || 480;
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
          }

          ctx.save();
          ctx.filter = activeFilter.cssFilter(intensity);

          if (mirrorView && facingMode === "user") {
            ctx.translate(w, 0);
            ctx.scale(-1, 1);
          }

          ctx.drawImage(video, 0, 0, w, h);
          ctx.restore();

          if (activeFilter.effect === "mirror") {
            const halfW = Math.floor(w / 2);
            const leftHalf = ctx.getImageData(0, 0, halfW, h);
            ctx.save();
            ctx.translate(w, 0);
            ctx.scale(-1, 1);
            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = halfW;
            tempCanvas.height = h;
            tempCanvas.getContext("2d")?.putImageData(leftHalf, 0, 0);
            ctx.drawImage(tempCanvas, 0, 0);
            ctx.restore();
          } else if (activeFilter.effect === "pixelate") {
            const blockSize = Math.max(4, Math.floor((intensity / 100) * 24));
            const smallW = Math.max(1, Math.floor(w / blockSize));
            const smallH = Math.max(1, Math.floor(h / blockSize));
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(canvas, 0, 0, w, h, 0, 0, smallW, smallH);
            ctx.drawImage(canvas, 0, 0, smallW, smallH, 0, 0, w, h);
            ctx.imageSmoothingEnabled = true;
          } else if (activeFilter.effect === "duotone") {
            const imgData = ctx.getImageData(0, 0, w, h);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
              const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
              data[i] = lum > 128 ? 255 : lum * 1.5;
              data[i + 1] = lum > 160 ? (lum - 160) * 2.5 : 20;
              data[i + 2] = lum < 128 ? 220 - lum : 40;
            }
            ctx.putImageData(imgData, 0, 0);
          }
        }
      }
      animFrameRef.current = requestAnimationFrame(renderFrame);
    }

    animFrameRef.current = requestAnimationFrame(renderFrame);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [activeFilter, intensity, mirrorView, facingMode]);

  // 3. Dynamic Grid Collage + Caption + PNG Stickers Compositor
  const buildGridCollage = useCallback(
    async (
      shots: string[],
      layout: GridLayout,
      theme: (typeof FRAME_THEMES)[number],
      caption: string,
      placedStickers: PlacedSticker[]
    ) => {
      const { rows, cols, totalShots } = layout;
      if (shots.length < totalShots) return;

      const collageCanvas = document.createElement("canvas");
      const padding = 32;
      const gap = 20;
      const footerHeight = 84;
      const cellW = 640;
      const cellH = 480;

      collageCanvas.width = padding * 2 + cols * cellW + (cols - 1) * gap;
      collageCanvas.height =
        padding * 2 + rows * cellH + (rows - 1) * gap + footerHeight;

      const ctx = collageCanvas.getContext("2d");
      if (!ctx) return;

      // Frame Background & Brutalist Outer Border
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, collageCanvas.width, collageCanvas.height);

      ctx.strokeStyle = "#09090b";
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, collageCanvas.width - 10, collageCanvas.height - 10);

      // Draw Each Grid Photo
      for (let idx = 0; idx < totalShots; idx++) {
        const img = new Image();
        img.src = shots[idx];
        await new Promise((resolve) => {
          img.onload = resolve;
        });

        const r = Math.floor(idx / cols);
        const c = idx % cols;
        const dx = padding + c * (cellW + gap);
        const dy = padding + r * (cellH + gap);

        const srcAspect = img.width / img.height;
        const dstAspect = cellW / cellH;
        let sx = 0;
        let sy = 0;
        let sw = img.width;
        let sh = img.height;

        if (srcAspect > dstAspect) {
          sw = img.height * dstAspect;
          sx = (img.width - sw) / 2;
        } else {
          sh = img.width / dstAspect;
          sy = (img.height - sh) / 2;
        }

        ctx.drawImage(img, sx, sy, sw, sh, dx, dy, cellW, cellH);

        ctx.strokeStyle = "#09090b";
        ctx.lineWidth = 4;
        ctx.strokeRect(dx, dy, cellW, cellH);
      }

      // Custom Caption + Date Stamp
      ctx.fillStyle = theme.text;
      ctx.font = "bold 24px monospace";
      ctx.textAlign = "center";
      const label = caption.trim() || "SNAPBOOTH";
      ctx.fillText(
        `${label} [${layout.rows}x${layout.cols}] // ${new Date().toLocaleDateString()}`,
        collageCanvas.width / 2,
        collageCanvas.height - 32
      );

      // Draw Placed PNG Stickers
      for (const s of placedStickers) {
        const stickerImg = new Image();
        stickerImg.crossOrigin = "anonymous";
        stickerImg.src = s.src;

        const loaded = await new Promise<boolean>((resolve) => {
          stickerImg.onload = () => resolve(true);
          stickerImg.onerror = () => resolve(false);
        });

        if (!loaded || stickerImg.width === 0) continue;

        const aspect = stickerImg.height / stickerImg.width;
        const drawW = s.size;
        const drawH = s.size * aspect;
        const cx = s.x * collageCanvas.width;
        const cy = s.y * collageCanvas.height;

        ctx.drawImage(
          stickerImg,
          cx - drawW / 2,
          cy - drawH / 2,
          drawW,
          drawH
        );
      }

      setFinalOutput(collageCanvas.toDataURL("image/png"));
    },
    []
  );

  useEffect(() => {
    if (capturedShots.length >= selectedLayout.totalShots) {
      buildGridCollage(
        capturedShots,
        selectedLayout,
        frameTheme,
        customCaption,
        stickers
      );
    } else {
      setFinalOutput(null);
    }
  }, [
    capturedShots,
    selectedLayout,
    frameTheme,
    customCaption,
    stickers,
    buildGridCollage,
  ]);

  // 4. Capture & Sticker Interaction Handlers
  const snapSingleFrame = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
    return canvas.toDataURL("image/png");
  };

  const runCountdown = (seconds: number) =>
    new Promise<void>((resolve) => {
      let current = seconds;
      setCountdown(current);
      const interval = setInterval(() => {
        current -= 1;
        if (current <= 0) {
          clearInterval(interval);
          setCountdown(null);
          resolve();
        } else {
          setCountdown(current);
        }
      }, 1000);
    });

  const handleCapture = async () => {
    if (isCapturing) return;
    setIsCapturing(true);
    setFinalOutput(null);
    setCapturedShots([]);

    const needed = selectedLayout.totalShots;

    try {
      const collected: string[] = [];
      for (let i = 0; i < needed; i++) {
        if (useTimer) {
          await runCountdown(3);
        } else if (i > 0) {
          await runCountdown(1);
        }

        const shot = snapSingleFrame();
        if (shot) {
          collected.push(shot);
          setCapturedShots([...collected]);
        }
      }
    } finally {
      setIsCapturing(false);
    }
  };

  const addPngSticker = (src: string) => {
    setStickers((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        src,
        x: 0.45 + Math.random() * 0.1,
        y: 0.45 + Math.random() * 0.1,
        size: 160,
      },
    ]);
  };

  const handleUploadCustomPng = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        addPngSticker(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingId || !previewContainerRef.current) return;
    const rect = previewContainerRef.current.getBoundingClientRect();
    const nx = Math.min(0.95, Math.max(0.05, (e.clientX - rect.left) / rect.width));
    const ny = Math.min(0.95, Math.max(0.05, (e.clientY - rect.top) / rect.height));

    setStickers((prev) =>
      prev.map((s) => (s.id === draggingId ? { ...s, x: nx, y: ny } : s))
    );
  };

  const downloadImage = () => {
    if (!finalOutput) return;
    const link = document.createElement("a");
    link.download = `snapbooth-${selectedLayout.id}-${Date.now()}.png`;
    link.href = finalOutput;
    link.click();
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 lg:grid-cols-[1fr_360px]">
      {/* Left: Control Deck + CRT Camera Viewfinder */}
      <div className="space-y-5">
        {/* Grid & Camera Hardware Switches */}
        <div className="brutal-box flex flex-wrap items-center justify-between gap-3 bg-white p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 flex items-center gap-1 font-pixel text-xs font-bold uppercase">
              <LayoutGrid className="h-3.5 w-3.5" />
              GRID:
            </span>
            {GRID_LAYOUTS.map((layout) => {
              const active = selectedLayout.id === layout.id;
              return (
                <button
                  key={layout.id}
                  type="button"
                  disabled={isCapturing}
                  onClick={() => setSelectedLayout(layout)}
                  className={`brutal-btn px-2.5 py-1 font-pixel text-xs font-bold uppercase ${active
                      ? "bg-[#22d3ee] text-zinc-950"
                      : "bg-[#fffbeb] text-zinc-800 hover:bg-zinc-100"
                    }`}
                >
                  {layout.id}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setUseTimer((t) => !t)}
              className={`brutal-btn flex items-center gap-1.5 px-2.5 py-1 font-pixel text-xs font-bold uppercase ${useTimer ? "bg-[#a3e635] text-zinc-950" : "bg-white text-zinc-600"
                }`}
            >
              <Timer className="h-3.5 w-3.5" />
              3S
            </button>

            <button
              type="button"
              onClick={() => setMirrorView((m) => !m)}
              className={`brutal-btn flex items-center gap-1.5 px-2.5 py-1 font-pixel text-xs font-bold uppercase ${mirrorView ? "bg-[#a3e635] text-zinc-950" : "bg-white text-zinc-600"
                }`}
            >
              <FlipHorizontal className="h-3.5 w-3.5" />
              FLIP
            </button>

            <button
              type="button"
              onClick={() =>
                setFacingMode((prev) => (prev === "user" ? "environment" : "user"))
              }
              title="Switch camera"
              className="brutal-btn bg-white p-1.5 text-zinc-950"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* CRT Monitor Viewport */}
        <div className="brutal-box relative overflow-hidden bg-zinc-950">
          <div className="flex items-center justify-between border-b-[3px] border-zinc-950 bg-zinc-900 px-3 py-1.5 text-white">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 border border-black bg-[#f43f5e]" />
              <span className="h-3 w-3 border border-black bg-[#facc15]" />
              <span className="h-3 w-3 border border-black bg-[#a3e635]" />
              <span className="ml-2 font-pixel text-[11px] uppercase tracking-wider text-zinc-300">
                CAM_FEED // {activeFilter.name}
              </span>
            </div>
            <span className="font-pixel text-[11px] text-[#facc15]">
              {selectedLayout.rows}×{selectedLayout.cols} MODE
            </span>
          </div>

          <div className="relative">
            <video ref={videoRef} playsInline muted className="hidden" />
            <canvas ref={canvasRef} className="aspect-video w-full object-cover" />

            <div className="crt-scanlines pointer-events-none absolute inset-0" />
            <div className="pointer-events-none absolute top-3 left-3 h-5 w-5 border-t-[3px] border-l-[3px] border-[#facc15]" />
            <div className="pointer-events-none absolute top-3 right-3 h-5 w-5 border-t-[3px] border-r-[3px] border-[#facc15]" />
            <div className="pointer-events-none absolute bottom-3 left-3 h-5 w-5 border-b-[3px] border-l-[3px] border-[#facc15]" />
            <div className="pointer-events-none absolute bottom-3 right-3 h-5 w-5 border-b-[3px] border-r-[3px] border-[#facc15]" />

            {flash && <div className="pointer-events-none absolute inset-0 bg-white" />}

            {countdown !== null && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                <div className="brutal-box bg-[#facc15] px-8 py-4 font-pixel text-6xl font-bold text-zinc-950">
                  {countdown}
                </div>
              </div>
            )}

            {streamError && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/95 p-6 text-center font-mono text-sm text-[#f43f5e]">
                [ERROR] {streamError}
              </div>
            )}
          </div>
        </div>

        {/* Filter Intensity Bar */}
        {activeFilter.id !== "normal" &&
          activeFilter.effect !== "mirror" &&
          activeFilter.effect !== "duotone" && (
            <div className="brutal-box flex items-center gap-4 bg-white px-4 py-3">
              <span className="font-pixel text-xs font-bold uppercase whitespace-nowrap">
                FX POWER:
              </span>
              <Slider
                value={[intensity]}
                min={10}
                max={100}
                step={1}
                onValueChange={(vals) =>
                  setIntensity(Array.isArray(vals) ? vals[0] : vals)
                }
              />
              <span className="brutal-btn bg-[#facc15] px-2 py-0.5 font-pixel text-xs font-bold">
                {intensity}%
              </span>
            </div>
          )}

        {/* Arcade Cartridge Filter Grid */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {CAMERA_FILTERS.map((filter) => {
            const isSelected = activeFilter.id === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={`brutal-btn flex flex-col items-start gap-1 p-3 text-left ${isSelected
                    ? "bg-[#facc15] text-zinc-950"
                    : "bg-white text-zinc-950 hover:bg-[#fef9c3]"
                  }`}
              >
                <span className="flex items-center gap-1 font-pixel text-xs font-bold uppercase">
                  {isSelected && <Sparkles className="h-3.5 w-3.5" />}
                  {filter.name}
                </span>
                <span className="border border-zinc-950 bg-zinc-950 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
                  {filter.category}
                </span>
              </button>
            );
          })}
        </div>

        {/* Giant Arcade Shutter Button */}
        <button
          type="button"
          disabled={isCapturing || Boolean(streamError)}
          onClick={handleCapture}
          className="brutal-btn flex h-16 w-full items-center justify-center gap-3 bg-[#f43f5e] font-pixel text-base font-bold uppercase tracking-wider text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Camera className="h-6 w-6" />
          {isCapturing
            ? `SHOOTING [${capturedShots.length}/${selectedLayout.totalShots}]...`
            : `SNAP ${selectedLayout.rows}×${selectedLayout.cols} (${selectedLayout.totalShots} ${selectedLayout.totalShots === 1 ? "SHOT" : "SHOTS"
            })`}
        </button>
      </div>

      {/* Right: Photo Print Slot & Export Panel */}
      <aside className="brutal-box flex flex-col justify-between bg-white p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b-[3px] border-zinc-950 pb-2.5">
            <h2 className="font-pixel text-sm font-bold uppercase">PRINT SLOT</h2>
            {capturedShots.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setFinalOutput(null);
                  setCapturedShots([]);
                  setStickers([]);
                }}
                className="brutal-btn flex items-center gap-1 bg-zinc-100 px-2 py-1 font-pixel text-[11px] font-bold uppercase"
              >
                <Trash2 className="h-3 w-3" />
                RESET
              </button>
            )}
          </div>

          {/* Frame Paper Color Picker */}
          <div className="space-y-2">
            <p className="font-pixel text-xs font-bold uppercase">PAPER THEME:</p>
            <div className="grid grid-cols-2 gap-2">
              {FRAME_THEMES.map((theme) => {
                const selected = frameTheme.id === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setFrameTheme(theme)}
                    className={`brutal-btn flex items-center gap-2 px-2.5 py-2 font-pixel text-xs font-bold ${selected ? "bg-[#22d3ee]" : "bg-white"
                      }`}
                  >
                    <span
                      className="h-4 w-4 border-2 border-zinc-950"
                      style={{ backgroundColor: theme.bg }}
                    />
                    {theme.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Frame Caption Input */}
          <div className="space-y-1.5">
            <label className="block font-pixel text-xs font-bold uppercase">
              FRAME TEXT:
            </label>
            <input
              type="text"
              maxLength={28}
              value={customCaption}
              onChange={(e) => setCustomCaption(e.target.value)}
              placeholder="TYPE YOUR CAPTION..."
              className="w-full border-[2.5px] border-zinc-950 bg-[#fffbeb] px-3 py-1.5 font-mono text-xs font-bold uppercase focus:bg-[#fef08a] focus:outline-none"
            />
          </div>

          {/* PNG Sticker Stamp Bar (Visible once photos are captured) */}
          {finalOutput && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-pixel text-xs font-bold uppercase">
                  PNG STICKERS (DRAG / DBL-CLICK DEL):
                </span>
                {stickers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setStickers([])}
                    className="font-pixel text-[10px] font-bold text-[#f43f5e] underline"
                  >
                    CLEAR
                  </button>
                )}
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {BUILTIN_PNG_STICKERS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addPngSticker(item.src)}
                    className="brutal-btn flex h-12 items-center justify-center bg-white p-1.5 hover:bg-[#fef08a]"
                    title={item.label}
                  >
                    <img
                      src={item.src}
                      alt={item.label}
                      className="h-8 w-8 object-contain"
                    />
                  </button>
                ))}
              </div>

              <label className="brutal-btn flex w-full cursor-pointer items-center justify-center gap-2 bg-[#22d3ee] py-2 font-pixel text-xs font-bold uppercase text-zinc-950">
                + UPLOAD CUSTOM PNG
                <input
                  type="file"
                  accept="image/png,image/webp,image/gif"
                  onChange={handleUploadCustomPng}
                  className="hidden"
                />
              </label>

              {stickers.length > 0 && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="font-pixel text-[10px] font-bold uppercase">
                    SIZE:
                  </span>
                  <input
                    type="range"
                    min={60}
                    max={360}
                    value={stickers[stickers.length - 1].size}
                    onChange={(e) => {
                      const nextSize = Number(e.target.value);
                      setStickers((prev) =>
                        prev.map((st, idx) =>
                          idx === prev.length - 1 ? { ...st, size: nextSize } : st
                        )
                      );
                    }}
                    className="w-full accent-zinc-950"
                  />
                </div>
              )}
            </div>
          )}

          {/* Slot Matrix / Final Printed Strip */}
          <div className="flex min-h-[340px] items-center justify-center border-[3px] border-dashed border-zinc-950 bg-[#fffbeb] p-3">
            {finalOutput ? (
              <div
                ref={previewContainerRef}
                onPointerMove={handlePointerMove}
                onPointerUp={() => setDraggingId(null)}
                onPointerLeave={() => setDraggingId(null)}
                className="relative inline-block touch-none select-none"
              >
                <img
                  src={finalOutput}
                  alt="Captured grid collage"
                  draggable={false}
                  className="max-h-[450px] border-[3px] border-zinc-950 shadow-[4px_4px_0px_#09090b]"
                />
                {stickers.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setDraggingId(s.id);
                    }}
                    onDoubleClick={() =>
                      setStickers((prev) => prev.filter((item) => item.id !== s.id))
                    }
                    title="Drag to move • Double-click to remove"
                    style={{
                      left: `${s.x * 100}%`,
                      top: `${s.y * 100}%`,
                      width: "56px",
                      height: "56px",
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border border-dashed border-transparent hover:border-zinc-950/50 active:cursor-grabbing"
                  />
                ))}
              </div>
            ) : (
              <div
                className="grid w-full gap-2"
                style={{
                  gridTemplateColumns: `repeat(${selectedLayout.cols}, minmax(0, 1fr))`,
                }}
              >
                {Array.from({ length: selectedLayout.totalShots }).map((_, idx) => {
                  const shot = capturedShots[idx];
                  return (
                    <div
                      key={idx}
                      className="flex aspect-video items-center justify-center overflow-hidden border-2 border-zinc-950 bg-white font-pixel text-xs font-bold text-zinc-500"
                    >
                      {shot ? (
                        <img
                          src={shot}
                          alt={`Shot ${idx + 1}`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        `[${idx + 1}]`
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          disabled={!finalOutput}
          onClick={downloadImage}
          className="brutal-btn mt-4 flex h-12 w-full items-center justify-center gap-2 bg-[#a3e635] font-pixel text-xs font-bold uppercase text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download className="h-4 w-4" />
          SAVE PNG ({selectedLayout.id})
        </button>
      </aside>
    </div>
  );
}
