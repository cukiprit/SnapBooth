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
  X,
  Zap,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { CAMERA_FILTERS, type CameraFilter } from "@/lib/filters";
import { GRID_LAYOUTS, type GridLayout } from "@/lib/grid-layouts";
import { FRAME_STYLES, type FrameStyle } from "@/lib/frame-styles";

const TIMER_OPTIONS = [0, 3, 5, 10] as const;
const CELL_ASPECT = 4 / 3;
type TimerDuration = (typeof TIMER_OPTIONS)[number];

const BUILTIN_PNG_STICKERS = [
  { id: "star", label: "Star", src: "/stickers/star.png" },
  { id: "heart", label: "Heart", src: "/stickers/heart.png" },
  { id: "red-heart", label: "Red Heart", src: "/stickers/red-heart.png" },
  { id: "web", label: "Web", src: "/stickers/web.png" },
];

interface FrameTheme {
  id: string;
  label: string;
  bg: string;
  text: string;
  swatch?: string; // Optional CSS preview for patterned swatches
  pattern?: "grid" | "dots" | "gingham" | "stripes";
  patternColor?: string;
}

const FRAME_THEMES: FrameTheme[] = [
  // Classic & Arcade Solids
  { id: "classic-white", label: "WHITE", bg: "#ffffff", text: "#09090b" },
  { id: "midnight-black", label: "VOID", bg: "#09090b", text: "#facc15" },
  { id: "arcade-yellow", label: "CYBER", bg: "#fef08a", text: "#09090b" },
  { id: "sakura-pink", label: "PINK", bg: "#fbcfe8", text: "#831843" },

  // Retro & Pastel Solids
  { id: "mint-soda", label: "MINT", bg: "#bbf7d0", text: "#064e3b" },
  { id: "sky-pixel", label: "SKY", bg: "#bae6fd", text: "#0c4a6e" },
  { id: "lavender-pop", label: "LILAC", bg: "#e9d5ff", text: "#4c1d95" },
  { id: "peach-cream", label: "PEACH", bg: "#fed7aa", text: "#7c2d12" },
  { id: "warm-cream", label: "CREAM", bg: "#fef3c7", text: "#451a03" },
  { id: "hot-crimson", label: "RED", bg: "#f43f5e", text: "#ffffff" },

  // Patterned Papers
  {
    id: "grid-note",
    label: "GRID",
    bg: "#ffffff",
    text: "#1e3a8a",
    pattern: "grid",
    patternColor: "#bfdbfe",
    swatch:
      "linear-gradient(#bfdbfe 1px, transparent 1px), linear-gradient(90deg, #bfdbfe 1px, #ffffff 1px)",
  },
  {
    id: "polka-dot",
    label: "DOTS",
    bg: "#fffbeb",
    text: "#09090b",
    pattern: "dots",
    patternColor: "#f43f5e",
    swatch: "radial-gradient(#f43f5e 2px, #fffbeb 2px)",
  },
  {
    id: "pink-gingham",
    label: "PICNIC",
    bg: "#fff1f2",
    text: "#881337",
    pattern: "gingham",
    patternColor: "rgba(244, 63, 94, 0.22)",
    swatch:
      "repeating-linear-gradient(0deg, rgba(244,63,94,0.25) 0 4px, transparent 4px 8px), repeating-linear-gradient(90deg, rgba(244,63,94,0.25) 0 4px, #fff1f2 4px 8px)",
  },
  {
    id: "hazard-stripe",
    label: "HAZARD",
    bg: "#facc15",
    text: "#09090b",
    pattern: "stripes",
    patternColor: "#09090b",
    swatch:
      "repeating-linear-gradient(-45deg, #facc15 0 4px, #09090b 4px 7px)",
  },
];

interface PlacedSticker {
  id: string;
  src: string;
  x: number;
  y: number;
  size: number;
}

function drawCroppedSource(
  ctx: CanvasRenderingContext2D,
  source: HTMLVideoElement | HTMLImageElement,
  srcW: number,
  srcH: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number
) {
  const srcAspect = srcW / srcH;
  const dstAspect = dw / dh;
  let sx = 0;
  let sy = 0;
  let sw = srcW;
  let sh = srcH;

  if (srcAspect > dstAspect) {
    sw = srcH * dstAspect;
    sx = (srcW - sw) / 2;
  } else {
    sh = srcW / dstAspect;
    sy = (srcH - sh) / 2;
  }

  ctx.drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh);
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

  // Timer (0 = OFF, 3s, 5s, 10s) & Capture Mode ("single" vs "burst")
  const [timerSeconds, setTimerSeconds] = useState<TimerDuration>(3);
  const [captureMode, setCaptureMode] = useState<"single" | "burst">("single");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);

  // Fixed-size slot array so individual slots can be deleted and re-shot
  const [slots, setSlots] = useState<(string | null)[]>(() =>
    Array(GRID_LAYOUTS[3].totalShots).fill(null)
  );

  // Frame Style, Paper Color, Optional PNG Overlay & Caption
  const [frameStyle, setFrameStyle] = useState<FrameStyle>(FRAME_STYLES[0]);
  const [frameTheme, setFrameTheme] = useState<FrameTheme>(FRAME_THEMES[0]);
  const [customFrameOverlay, setCustomFrameOverlay] = useState<string | null>(null);
  const [customCaption, setCustomCaption] = useState("SNAPBOOTH.EXE");

  // Stickers
  const [stickers, setStickers] = useState<PlacedSticker[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const [finalOutput, setFinalOutput] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const filledCount = slots.filter(Boolean).length;
  const nextEmptyIndex = slots.findIndex((s) => s === null);
  const isGridFull =
    nextEmptyIndex === -1 && slots.length === selectedLayout.totalShots;

  const cycleTimer = () => {
    setTimerSeconds((prev) => {
      const idx = TIMER_OPTIONS.indexOf(prev);
      return TIMER_OPTIONS[(idx + 1) % TIMER_OPTIONS.length];
    });
  };

  const handleSelectLayout = (layout: GridLayout) => {
    if (isCapturing) return;
    setSelectedLayout(layout);
    setSlots((prev) => {
      const next = Array(layout.totalShots).fill(null);
      for (let i = 0; i < Math.min(prev.length, layout.totalShots); i++) {
        next[i] = prev[i];
      }
      return next;
    });
  };

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
          const vw = video.videoWidth || 1280;
          const vh = video.videoHeight || 720;

          // Match the exact 4:3 framing used by the print collage cells
          const outH = vh;
          const outW = Math.round(vh * CELL_ASPECT);

          if (canvas.width !== outW || canvas.height !== outH) {
            canvas.width = outW;
            canvas.height = outH;
          }

          ctx.save();
          ctx.filter = activeFilter.cssFilter(intensity);

          if (mirrorView && facingMode === "user") {
            ctx.translate(outW, 0);
            ctx.scale(-1, 1);
          }

          // Center-crop the 16:9 webcam stream into the 4:3 canvas
          drawCroppedSource(ctx, video, vw, vh, 0, 0, outW, outH);
          ctx.restore();

          if (activeFilter.effect === "mirror") {
            const halfW = Math.floor(outW / 2);
            const leftHalf = ctx.getImageData(0, 0, halfW, outH);
            ctx.save();
            ctx.translate(outW, 0);
            ctx.scale(-1, 1);
            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = halfW;
            tempCanvas.height = outH;
            tempCanvas.getContext("2d")?.putImageData(leftHalf, 0, 0);
            ctx.drawImage(tempCanvas, 0, 0);
            ctx.restore();
          } else if (activeFilter.effect === "pixelate") {
            const blockSize = Math.max(4, Math.floor((intensity / 100) * 24));
            const smallW = Math.max(1, Math.floor(outW / blockSize));
            const smallH = Math.max(1, Math.floor(outH / blockSize));
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(canvas, 0, 0, outW, outH, 0, 0, smallW, smallH);
            ctx.drawImage(canvas, 0, 0, smallW, smallH, 0, 0, outW, outH);
            ctx.imageSmoothingEnabled = true;
          } else if (activeFilter.effect === "duotone") {
            const imgData = ctx.getImageData(0, 0, outW, outH);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
              const lum =
                0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
              data[i] = lum > 128 ? 255 : lum * 1.5;
              data[i + 1] = lum > 160 ? (lum - 160) * 2.5 : 20;
              data[i + 2] = lum < 128 ? 220 - lum : 40;
            }
            ctx.putImageData(imgData, 0, 0);
          } else if (activeFilter.effect === "crt") {
            // Horizontal scanlines + subtle vignette
            const lineAlpha = (intensity / 100) * 0.35;
            ctx.fillStyle = `rgba(9, 9, 11, ${lineAlpha})`;
            for (let y = 0; y < outH; y += 4) {
              ctx.fillRect(0, y, outW, 2);
            }
          } else if (activeFilter.effect === "vhs") {
            // RGB chromatic channel shift
            const shift = Math.max(2, Math.round((intensity / 100) * 14));
            const imgData = ctx.getImageData(0, 0, outW, outH);
            const src = new Uint8ClampedArray(imgData.data);
            const dst = imgData.data;

            for (let y = 0; y < outH; y++) {
              for (let x = 0; x < outW; x++) {
                const idx = (y * outW + x) * 4;
                const leftX = Math.max(0, x - shift);
                const rightX = Math.min(outW - 1, x + shift);
                dst[idx] = src[(y * outW + leftX) * 4]; // Red shifted left
                dst[idx + 2] = src[(y * outW + rightX) * 4 + 2]; // Blue shifted right
              }
            }
            ctx.putImageData(imgData, 0, 0);
          } else if (activeFilter.effect === "thermal") {
            // Predator-style heat map palette
            const imgData = ctx.getImageData(0, 0, outW, outH);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
              const lum =
                (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) /
                255;
              if (lum < 0.25) {
                data[i] = 20;
                data[i + 1] = 10;
                data[i + 2] = Math.round(lum * 4 * 220);
              } else if (lum < 0.5) {
                const t = (lum - 0.25) * 4;
                data[i] = Math.round(t * 220);
                data[i + 1] = 20;
                data[i + 2] = Math.round((1 - t) * 220);
              } else if (lum < 0.75) {
                const t = (lum - 0.5) * 4;
                data[i] = 250;
                data[i + 1] = Math.round(t * 220);
                data[i + 2] = 10;
              } else {
                const t = (lum - 0.75) * 4;
                data[i] = 255;
                data[i + 1] = 240;
                data[i + 2] = Math.round(t * 255);
              }
            }
            ctx.putImageData(imgData, 0, 0);
          } else if (activeFilter.effect === "halftone") {
            // Comic/Manga dot grid based on pixel brightness
            const step = Math.max(6, Math.round(14 - (intensity / 100) * 6));
            const imgData = ctx.getImageData(0, 0, outW, outH);
            const data = imgData.data;

            ctx.fillStyle = "#fffbeb";
            ctx.fillRect(0, 0, outW, outH);
            ctx.fillStyle = "#09090b";

            for (let y = 0; y < outH; y += step) {
              for (let x = 0; x < outW; x += step) {
                const idx = (y * outW + x) * 4;
                const lum =
                  (0.299 * data[idx] +
                    0.587 * data[idx + 1] +
                    0.114 * data[idx + 2]) /
                  255;
                const radius = ((1 - lum) * step) / 2;
                if (radius > 0.6) {
                  ctx.beginPath();
                  ctx.arc(x + step / 2, y + step / 2, radius, 0, Math.PI * 2);
                  ctx.fill();
                }
              }
            }
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

  // 3. Dynamic Grid Collage + Frame Style + Paper Patterns + Caption + PNG Stickers Compositor
  const buildGridCollage = useCallback(
    async (
      shots: string[],
      layout: GridLayout,
      style: FrameStyle,
      theme: FrameTheme,
      overlaySrc: string | null,
      caption: string,
      placedStickers: PlacedSticker[]
    ) => {
      const { rows, cols, totalShots } = layout;
      if (shots.length < totalShots) return;

      const collageCanvas = document.createElement("canvas");
      const padding = 36;
      const gap = 20;
      const footerHeight = 84;
      const cellW = 640;
      const cellH = 480;

      collageCanvas.width = padding * 2 + cols * cellW + (cols - 1) * gap;
      collageCanvas.height =
        padding * 2 + rows * cellH + (rows - 1) * gap + footerHeight;

      const ctx = collageCanvas.getContext("2d");
      if (!ctx) return;

      // A1. Base Paper Color
      const isFilm = style.id === "film-strip";
      const bg = isFilm ? "#18181b" : theme.bg;
      const fg = isFilm ? "#fafafa" : theme.text;

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, collageCanvas.width, collageCanvas.height);

      // A2. Patterned Paper Textures (Grid, Dots, Gingham, Hazard Stripes)
      if (!isFilm && theme.pattern) {
        const pColor = theme.patternColor ?? "rgba(9, 9, 11, 0.15)";

        if (theme.pattern === "grid") {
          ctx.strokeStyle = pColor;
          ctx.lineWidth = 2;
          const step = 28;
          for (let x = 0; x < collageCanvas.width; x += step) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, collageCanvas.height);
            ctx.stroke();
          }
          for (let y = 0; y < collageCanvas.height; y += step) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(collageCanvas.width, y);
            ctx.stroke();
          }
        } else if (theme.pattern === "dots") {
          ctx.fillStyle = pColor;
          const spacing = 30;
          for (let y = 15; y < collageCanvas.height; y += spacing) {
            for (let x = 15; x < collageCanvas.width; x += spacing) {
              ctx.beginPath();
              ctx.arc(x, y, 4, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        } else if (theme.pattern === "gingham") {
          ctx.fillStyle = pColor;
          const size = 28;
          for (let y = 0; y < collageCanvas.height; y += size * 2) {
            ctx.fillRect(0, y, collageCanvas.width, size);
          }
          for (let x = 0; x < collageCanvas.width; x += size * 2) {
            ctx.fillRect(x, 0, size, collageCanvas.height);
          }
        } else if (theme.pattern === "stripes") {
          ctx.save();
          ctx.strokeStyle = pColor;
          ctx.lineWidth = 14;
          const step = 36;
          for (
            let i = -collageCanvas.height;
            i < collageCanvas.width + collageCanvas.height;
            i += step
          ) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i - collageCanvas.height, collageCanvas.height);
            ctx.stroke();
          }
          ctx.restore();

          // Solid inner backing behind photos & caption so hazard stripes frame the edges cleanly
          ctx.fillStyle = theme.bg;
          ctx.fillRect(
            24,
            24,
            collageCanvas.width - 48,
            collageCanvas.height - 48
          );
        }
      }

      // A3. Decorative Frame Borders
      if (style.id === "checkerboard") {
        const sq = 16;
        ctx.fillStyle = "#09090b";
        for (let y = 0; y < collageCanvas.height; y += sq) {
          for (let x = 0; x < collageCanvas.width; x += sq) {
            if (((x / sq + y / sq) & 1) === 0) {
              ctx.fillRect(x, y, sq, sq);
            }
          }
        }
        ctx.fillStyle = theme.bg;
        ctx.fillRect(
          18,
          18,
          collageCanvas.width - 36,
          collageCanvas.height - 36
        );
      }

      if (style.id === "film-strip") {
        ctx.fillStyle = "#f4f4f5";
        for (let y = 24; y < collageCanvas.height - 24; y += 36) {
          ctx.fillRect(10, y, 12, 20);
          ctx.fillRect(collageCanvas.width - 22, y, 12, 20);
        }
      }

      if (style.id === "arcade-bezel") {
        ctx.strokeStyle = "#09090b";
        ctx.lineWidth = 12;
        ctx.strokeRect(
          6,
          6,
          collageCanvas.width - 12,
          collageCanvas.height - 12
        );
        ctx.lineWidth = 4;
        ctx.strokeRect(
          18,
          18,
          collageCanvas.width - 36,
          collageCanvas.height - 36
        );

        ctx.fillStyle = "#f43f5e";
        const bolts = [
          [12, 12],
          [collageCanvas.width - 12, 12],
          [12, collageCanvas.height - 12],
          [collageCanvas.width - 12, collageCanvas.height - 12],
        ];
        for (const [bx, by] of bolts) {
          ctx.beginPath();
          ctx.arc(bx, by, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.strokeStyle = "#09090b";
        ctx.lineWidth = 10;
        ctx.strokeRect(
          5,
          5,
          collageCanvas.width - 10,
          collageCanvas.height - 10
        );
      }

      // B. Draw Each Grid Photo
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

        drawCroppedSource(ctx, img, img.width, img.height, dx, dy, cellW, cellH);

        ctx.strokeStyle = isFilm ? "#fafafa" : "#09090b";
        ctx.lineWidth = 4;
        ctx.strokeRect(dx, dy, cellW, cellH);
      }

      // C. Optional Custom PNG Frame Overlay
      if (overlaySrc) {
        const overlayImg = new Image();
        overlayImg.crossOrigin = "anonymous";
        overlayImg.src = overlaySrc;
        const ok = await new Promise<boolean>((resolve) => {
          overlayImg.onload = () => resolve(true);
          overlayImg.onerror = () => resolve(false);
        });
        if (ok) {
          ctx.drawImage(
            overlayImg,
            0,
            0,
            collageCanvas.width,
            collageCanvas.height
          );
        }
      }

      // D. Custom Caption + Date Stamp
      ctx.fillStyle = fg;
      ctx.font = "bold 24px monospace";
      ctx.textAlign = "center";
      const label = caption.trim() || "SNAPBOOTH";
      ctx.fillText(
        `${label} [${layout.rows}x${layout.cols}] // ${new Date().toLocaleDateString()}`,
        collageCanvas.width / 2,
        collageCanvas.height - 32
      );

      // E. Draw Placed PNG Stickers
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
    const validShots = slots.filter((s): s is string => Boolean(s));
    if (
      slots.length === selectedLayout.totalShots &&
      validShots.length === selectedLayout.totalShots
    ) {
      buildGridCollage(
        validShots,
        selectedLayout,
        frameStyle,
        frameTheme,
        customFrameOverlay,
        customCaption,
        stickers
      );
    } else {
      setFinalOutput(null);
    }
  }, [
    slots,
    selectedLayout,
    frameStyle,
    frameTheme,
    customFrameOverlay,
    customCaption,
    stickers,
    buildGridCollage,
  ]);

  // 4. Single & Burst Capture Handlers
  const snapSingleFrame = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
    return canvas.toDataURL("image/png");
  };

  const runCountdown = (seconds: number) =>
    new Promise<void>((resolve) => {
      if (seconds <= 0) {
        resolve();
        return;
      }
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
    if (isCapturing || isGridFull) return;
    setIsCapturing(true);

    try {
      const emptyIndices = slots
        .map((val, idx) => (val === null ? idx : -1))
        .filter((idx) => idx !== -1);

      if (emptyIndices.length === 0) return;

      const targets =
        captureMode === "single" ? [emptyIndices[0]] : emptyIndices;

      for (let i = 0; i < targets.length; i++) {
        const targetIdx = targets[i];

        if (timerSeconds > 0) {
          await runCountdown(timerSeconds);
        } else if (i > 0) {
          await runCountdown(1);
        }

        const shot = snapSingleFrame();
        if (shot) {
          setSlots((prev) => {
            const updated = [...prev];
            updated[targetIdx] = shot;
            return updated;
          });
        }
      }
    } finally {
      setIsCapturing(false);
    }
  };

  const handleDeleteSlot = (indexToDelete: number) => {
    if (isCapturing) return;
    setSlots((prev) => {
      const updated = [...prev];
      updated[indexToDelete] = null;
      return updated;
    });
  };

  const handleResetAll = () => {
    if (isCapturing) return;
    setSlots(Array(selectedLayout.totalShots).fill(null));
    setFinalOutput(null);
    setStickers([]);
  };

  // Sticker Handlers
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
    const nx = Math.min(
      0.95,
      Math.max(0.05, (e.clientX - rect.left) / rect.width)
    );
    const ny = Math.min(
      0.95,
      Math.max(0.05, (e.clientY - rect.top) / rect.height)
    );

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

  const remainingSlots = selectedLayout.totalShots - filledCount;

  return (
    <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[230px_1fr_360px] lg:items-start">
      {/* Column 1 (Left): Filter Cartridges + FX Slider */}
      <div className="brutal-box order-2 space-y-3 bg-white p-3 lg:order-1">
        <div className="flex items-center justify-between border-b-[3px] border-zinc-950 pb-2">
          <span className="font-pixel text-xs font-bold uppercase">
            FILTERS ({CAMERA_FILTERS.length})
          </span>
          <span className="bg-zinc-950 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#facc15]">
            {activeFilter.category}
          </span>
        </div>

        {/* Filter Intensity Bar */}
        {activeFilter.id !== "normal" &&
          activeFilter.effect !== "mirror" &&
          activeFilter.effect !== "duotone" &&
          activeFilter.effect !== "thermal" && (
            <div className="space-y-1.5 border-2 border-zinc-950 bg-[#fffbeb] p-2">
              <div className="flex items-center justify-between">
                <span className="font-pixel text-[10px] font-bold uppercase">
                  FX POWER:
                </span>
                <span className="bg-[#facc15] px-1.5 py-0.5 font-pixel text-[10px] font-bold">
                  {intensity}%
                </span>
              </div>
              <Slider
                value={[intensity]}
                min={10}
                max={100}
                step={1}
                onValueChange={(vals) =>
                  setIntensity(Array.isArray(vals) ? vals[0] : vals)
                }
              />
            </div>
          )}

        {/* Scrollable Filter List */}
        <div className="grid max-h-[460px] grid-cols-2 gap-1.5 overflow-y-auto pr-1 lg:grid-cols-1">
          {CAMERA_FILTERS.map((filter) => {
            const isSelected = activeFilter.id === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={`brutal-btn flex items-center justify-between gap-1.5 px-2.5 py-2 text-left ${isSelected
                    ? "bg-[#facc15] text-zinc-950"
                    : "bg-white text-zinc-950 hover:bg-[#fef9c3]"
                  }`}
              >
                <span className="flex items-center gap-1 truncate font-pixel text-[11px] font-bold uppercase">
                  {isSelected && <Sparkles className="h-3 w-3 shrink-0" />}
                  <span className="truncate">{filter.name}</span>
                </span>
                <span className="shrink-0 border border-zinc-950 bg-zinc-950 px-1 py-0.5 font-mono text-[9px] font-bold uppercase text-white">
                  {filter.category}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Column 2 (Center): Controls + CRT Camera Viewfinder + Shutter */}
      <div className="order-1 space-y-3 lg:order-2">
        {/* Grid & Camera Hardware Switches */}
        <div className="brutal-box flex flex-wrap items-center justify-between gap-2 bg-white p-2.5">
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 flex items-center gap-1 font-pixel text-[11px] font-bold uppercase">
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
                  onClick={() => handleSelectLayout(layout)}
                  className={`brutal-btn px-2 py-1 font-pixel text-[11px] font-bold uppercase ${active
                      ? "bg-[#22d3ee] text-zinc-950"
                      : "bg-[#fffbeb] text-zinc-800 hover:bg-zinc-100"
                    }`}
                >
                  {layout.id}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* Timer Cycle Toggle */}
            <button
              type="button"
              disabled={isCapturing}
              onClick={cycleTimer}
              title="Click to cycle timer: OFF / 3s / 5s / 10s"
              className={`brutal-btn flex items-center gap-1 px-2 py-1 font-pixel text-[11px] font-bold uppercase ${timerSeconds > 0
                  ? "bg-[#a3e635] text-zinc-950"
                  : "bg-white text-zinc-600"
                }`}
            >
              <Timer className="h-3.5 w-3.5" />
              {timerSeconds === 0 ? "OFF" : `${timerSeconds}S`}
            </button>

            {/* Capture Mode Toggle */}
            <button
              type="button"
              disabled={isCapturing}
              onClick={() =>
                setCaptureMode((prev) =>
                  prev === "single" ? "burst" : "single"
                )
              }
              title="Toggle Single Shot vs Auto-Burst"
              className={`brutal-btn flex items-center gap-1 px-2 py-1 font-pixel text-[11px] font-bold uppercase ${captureMode === "burst"
                  ? "bg-[#facc15] text-zinc-950"
                  : "bg-white text-zinc-800"
                }`}
            >
              <Zap className="h-3.5 w-3.5" />
              {captureMode === "burst" ? "BURST" : "SINGLE"}
            </button>

            {/* Mirror Toggle */}
            <button
              type="button"
              onClick={() => setMirrorView((m) => !m)}
              className={`brutal-btn flex items-center gap-1 px-2 py-1 font-pixel text-[11px] font-bold uppercase ${mirrorView
                  ? "bg-[#a3e635] text-zinc-950"
                  : "bg-white text-zinc-600"
                }`}
            >
              <FlipHorizontal className="h-3.5 w-3.5" />
              FLIP
            </button>

            {/* Switch Front / Rear Camera */}
            <button
              type="button"
              onClick={() =>
                setFacingMode((prev) =>
                  prev === "user" ? "environment" : "user"
                )
              }
              title="Switch camera"
              className="brutal-btn bg-white p-1.5 text-zinc-950"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* CRT Monitor Viewport */}
        <div className="brutal-box relative overflow-hidden bg-zinc-950">
          <div className="flex items-center justify-between border-b-[3px] border-zinc-950 bg-zinc-900 px-3 py-1.5 text-white">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 border border-black bg-[#f43f5e]" />
              <span className="h-2.5 w-2.5 border border-black bg-[#facc15]" />
              <span className="h-2.5 w-2.5 border border-black bg-[#a3e635]" />
              <span className="ml-2 font-pixel text-[11px] uppercase tracking-wider text-zinc-300">
                CAM_FEED // {activeFilter.name}
              </span>
            </div>
            <span className="font-pixel text-[11px] text-[#facc15]">
              {captureMode.toUpperCase()} • SLOT {filledCount}/
              {selectedLayout.totalShots}
            </span>
          </div>

          <div className="relative flex items-center justify-center bg-zinc-950">
            <video ref={videoRef} playsInline muted className="hidden" />
            <canvas
              ref={canvasRef}
              className="aspect-[4/3] max-h-[380px] w-full object-contain"
            />

            <div className="crt-scanlines pointer-events-none absolute inset-0" />
            <div className="pointer-events-none absolute top-3 left-3 h-5 w-5 border-t-[3px] border-l-[3px] border-[#facc15]" />
            <div className="pointer-events-none absolute top-3 right-3 h-5 w-5 border-t-[3px] border-r-[3px] border-[#facc15]" />
            <div className="pointer-events-none absolute bottom-3 left-3 h-5 w-5 border-b-[3px] border-l-[3px] border-[#facc15]" />
            <div className="pointer-events-none absolute bottom-3 right-3 h-5 w-5 border-b-[3px] border-r-[3px] border-[#facc15]" />

            {flash && (
              <div className="pointer-events-none absolute inset-0 bg-white" />
            )}

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

        {/* Shutter Button */}
        <button
          type="button"
          disabled={isCapturing || isGridFull || Boolean(streamError)}
          onClick={handleCapture}
          className="brutal-btn flex h-14 w-full items-center justify-center gap-3 bg-[#f43f5e] font-pixel text-sm font-bold uppercase tracking-wider text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Camera className="h-5 w-5" />
          {isCapturing
            ? `SHOOTING SLOT #${nextEmptyIndex + 1}...`
            : isGridFull
              ? "GRID FULL! DELETE A SHOT OR SAVE"
              : captureMode === "burst"
                ? `BURST SHOOT (${remainingSlots} ${remainingSlots === 1 ? "SLOT" : "SLOTS"} LEFT)`
                : `CAPTURE SLOT #${nextEmptyIndex + 1} (${filledCount}/${selectedLayout.totalShots})`}
        </button>
      </div>

      {/* Column 3 (Right): Live Print Preview AT TOP + Customization Below */}
      <aside className="brutal-box order-3 space-y-3 bg-white p-3.5">
        <div className="flex items-center justify-between border-b-[3px] border-zinc-950 pb-2">
          <h2 className="font-pixel text-xs font-bold uppercase">PRINT SLOT</h2>
          {filledCount > 0 && (
            <button
              type="button"
              onClick={handleResetAll}
              className="brutal-btn flex items-center gap-1 bg-zinc-100 px-2 py-1 font-pixel text-[10px] font-bold uppercase"
            >
              <Trash2 className="h-3 w-3" />
              RESET ALL
            </button>
          )}
        </div>

        {/* Final Printed Collage Preview (Placed at top so it's immediately visible!) */}
        <div className="flex min-h-[210px] items-center justify-center border-[3px] border-dashed border-zinc-950 bg-[#fffbeb] p-2.5">
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
                className="max-h-[300px] border-[3px] border-zinc-950 shadow-[4px_4px_0px_#09090b]"
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
                    setStickers((prev) =>
                      prev.filter((item) => item.id !== s.id)
                    )
                  }
                  title="Drag to move • Double-click to remove"
                  style={{
                    left: `${s.x * 100}%`,
                    top: `${s.y * 100}%`,
                    width: "48px",
                    height: "48px",
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border border-dashed border-transparent hover:border-zinc-950/50 active:cursor-grabbing"
                />
              ))}
            </div>
          ) : (
            <div className="w-full space-y-2 text-center">
              <p className="font-pixel text-[11px] text-zinc-500">
                SHOOT SLOT #{nextEmptyIndex + 1} OF {selectedLayout.totalShots}
              </p>
              <div
                className="mx-auto grid max-w-[240px] gap-1.5"
                style={{
                  gridTemplateColumns: `repeat(${selectedLayout.cols}, minmax(0, 1fr))`,
                }}
              >
                {slots.map((shot, idx) => (
                  <div
                    key={idx}
                    className="relative flex aspect-[4/3] items-center justify-center overflow-hidden border-2 border-zinc-950 bg-white font-pixel text-[10px] font-bold text-zinc-400"
                  >
                    {shot ? (
                      <>
                        <img
                          src={shot}
                          alt={`Slot ${idx + 1}`}
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleDeleteSlot(idx)}
                          title={`Delete shot #${idx + 1}`}
                          className="absolute top-0.5 right-0.5 flex h-5 w-5 items-center justify-center border border-zinc-950 bg-[#f43f5e] text-white"
                        >
                          <X className="h-3 w-3 stroke-[3]" />
                        </button>
                      </>
                    ) : (
                      `#${idx + 1}`
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Save PNG Button Right Below Preview */}
        <button
          type="button"
          disabled={!finalOutput}
          onClick={downloadImage}
          className="brutal-btn flex h-11 w-full items-center justify-center gap-2 bg-[#a3e635] font-pixel text-xs font-bold uppercase text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download className="h-4 w-4" />
          SAVE PNG ({selectedLayout.id})
        </button>

        {/* Individual Slot Manager when Grid is Full */}
        {finalOutput && (
          <div className="space-y-1">
            <p className="font-pixel text-[10px] font-bold uppercase text-zinc-700">
              RETAKE A SLOT (CLICK ✕):
            </p>
            <div
              className="grid gap-1.5"
              style={{
                gridTemplateColumns: `repeat(${selectedLayout.cols}, minmax(0, 1fr))`,
              }}
            >
              {slots.map((shot, idx) => (
                <div
                  key={idx}
                  className="relative flex aspect-[4/3] items-center justify-center overflow-hidden border-2 border-zinc-950 bg-[#fffbeb]"
                >
                  {shot && (
                    <>
                      <img
                        src={shot}
                        alt={`Slot ${idx + 1}`}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteSlot(idx)}
                        title={`Delete shot #${idx + 1}`}
                        className="absolute top-0.5 right-0.5 flex h-5 w-5 items-center justify-center border border-zinc-950 bg-[#f43f5e] text-white"
                      >
                        <X className="h-3 w-3 stroke-[3]" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Frame Style Picker */}
        <div className="space-y-1.5">
          <p className="font-pixel text-[11px] font-bold uppercase">
            FRAME STYLE:
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {FRAME_STYLES.map((st) => {
              const active = frameStyle.id === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setFrameStyle(st)}
                  className={`brutal-btn px-2 py-1.5 text-left font-pixel text-[11px] font-bold ${active ? "bg-[#facc15] text-zinc-950" : "bg-white"
                    }`}
                >
                  {st.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            <label className="brutal-btn flex flex-1 cursor-pointer items-center justify-center bg-[#fffbeb] py-1 font-pixel text-[10px] font-bold uppercase hover:bg-[#fef08a]">
              {customFrameOverlay ? "CHANGE PNG FRAME" : "+ PNG FRAME OVERLAY"}
              <input
                type="file"
                accept="image/png,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    if (typeof reader.result === "string") {
                      setCustomFrameOverlay(reader.result);
                    }
                  };
                  reader.readAsDataURL(file);
                  e.target.value = "";
                }}
                className="hidden"
              />
            </label>
            {customFrameOverlay && (
              <button
                type="button"
                onClick={() => setCustomFrameOverlay(null)}
                className="brutal-btn bg-[#f43f5e] px-2 py-1 font-pixel text-[10px] font-bold text-white"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Paper Theme Picker */}
        <div className="space-y-1.5">
          <p className="font-pixel text-[11px] font-bold uppercase">
            PAPER THEME:
          </p>
          <div className="grid max-h-36 grid-cols-2 gap-1.5 overflow-y-auto pr-1">
            {FRAME_THEMES.map((theme) => {
              const selected = frameTheme.id === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => setFrameTheme(theme)}
                  className={`brutal-btn flex items-center gap-1.5 px-2 py-1.5 font-pixel text-[11px] font-bold ${selected ? "bg-[#22d3ee]" : "bg-white"
                    }`}
                >
                  <span
                    className="h-3.5 w-3.5 shrink-0 border-2 border-zinc-950"
                    style={{
                      backgroundColor: theme.bg,
                      backgroundImage: theme.swatch,
                      backgroundSize: "8px 8px",
                    }}
                  />
                  <span className="truncate">{theme.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Frame Caption Input */}
        <div className="space-y-1">
          <label className="block font-pixel text-[11px] font-bold uppercase">
            FRAME TEXT:
          </label>
          <input
            type="text"
            maxLength={28}
            value={customCaption}
            onChange={(e) => setCustomCaption(e.target.value)}
            placeholder="TYPE YOUR CAPTION..."
            className="w-full border-[2.5px] border-zinc-950 bg-[#fffbeb] px-2.5 py-1.5 font-mono text-xs font-bold uppercase focus:bg-[#fef08a] focus:outline-none"
          />
        </div>

        {/* PNG Sticker Stamp Bar */}
        {finalOutput && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-pixel text-[10px] font-bold uppercase">
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
                  className="brutal-btn flex h-10 items-center justify-center bg-white p-1 hover:bg-[#fef08a]"
                  title={item.label}
                >
                  <img
                    src={item.src}
                    alt={item.label}
                    className="h-7 w-7 object-contain"
                  />
                </button>
              ))}
            </div>

            <label className="brutal-btn flex w-full cursor-pointer items-center justify-center gap-2 bg-[#22d3ee] py-1.5 font-pixel text-[11px] font-bold uppercase text-zinc-950">
              + UPLOAD CUSTOM PNG
              <input
                type="file"
                accept="image/png,image/webp,image/gif"
                onChange={handleUploadCustomPng}
                className="hidden"
              />
            </label>

            {stickers.length > 0 && (
              <div className="flex items-center gap-2 pt-0.5">
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
                        idx === prev.length - 1
                          ? { ...st, size: nextSize }
                          : st
                      )
                    );
                  }}
                  className="w-full accent-zinc-950"
                />
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
