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

export function PhotoBooth() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

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

  // 3. Dynamic Grid Collage Compositor
  const buildGridCollage = useCallback(
    async (
      shots: string[],
      layout: GridLayout,
      theme: (typeof FRAME_THEMES)[number]
    ) => {
      const { rows, cols, totalShots } = layout;
      if (shots.length < totalShots) return;

      const collageCanvas = document.createElement("canvas");
      const padding = 32;
      const gap = 20;
      const footerHeight = 76;
      const cellW = 640;
      const cellH = 480;

      collageCanvas.width = padding * 2 + cols * cellW + (cols - 1) * gap;
      collageCanvas.height =
        padding * 2 + rows * cellH + (rows - 1) * gap + footerHeight;

      const ctx = collageCanvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, collageCanvas.width, collageCanvas.height);

      // Brutalist outer border on the exported print
      ctx.strokeStyle = "#09090b";
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, collageCanvas.width - 10, collageCanvas.height - 10);

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

        // Crisp black border around every grid photo
        ctx.strokeStyle = "#09090b";
        ctx.lineWidth = 4;
        ctx.strokeRect(dx, dy, cellW, cellH);
      }

      ctx.fillStyle = theme.text;
      ctx.font = "bold 22px monospace";
      ctx.textAlign = "center";
      ctx.fillText(
        `SNAPBOOTH [${layout.rows}x${layout.cols}] // ${new Date().toLocaleDateString()}`,
        collageCanvas.width / 2,
        collageCanvas.height - 30
      );

      setFinalOutput(collageCanvas.toDataURL("image/png"));
    },
    []
  );

  useEffect(() => {
    if (capturedShots.length >= selectedLayout.totalShots) {
      buildGridCollage(capturedShots, selectedLayout, frameTheme);
    } else {
      setFinalOutput(null);
    }
  }, [capturedShots, selectedLayout, frameTheme, buildGridCollage]);

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
          {/* Top Window Title Bar */}
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

            {/* Subtle Scanlines + Viewfinder Corner Crosshairs */}
            <div className="crt-scanlines pointer-events-none absolute inset-0" />
            <div className="pointer-events-none absolute top-3 left-3 h-5 w-5 border-t-[3px] border-l-[3px] border-[#facc15]" />
            <div className="pointer-events-none absolute top-3 right-3 h-5 w-5 border-t-[3px] border-r-[3px] border-[#facc15]" />
            <div className="pointer-events-none absolute bottom-3 left-3 h-5 w-5 border-b-[3px] border-l-[3px] border-[#facc15]" />
            <div className="pointer-events-none absolute bottom-3 right-3 h-5 w-5 border-b-[3px] border-r-[3px] border-[#facc15]" />

            {/* Flash Overlay */}
            {flash && <div className="pointer-events-none absolute inset-0 bg-white" />}

            {/* Pixel Countdown Overlay */}
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

          {/* Slot Matrix / Final Printed Strip */}
          <div className="flex min-h-[340px] items-center justify-center border-[3px] border-dashed border-zinc-950 bg-[#fffbeb] p-3">
            {finalOutput ? (
              <img
                src={finalOutput}
                alt="Captured grid collage"
                className="max-h-[450px] border-[3px] border-zinc-950 shadow-[4px_4px_0px_#09090b]"
              />
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
