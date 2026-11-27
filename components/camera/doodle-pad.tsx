"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Pencil, Grid, Undo2, Trash2 } from "lucide-react";

export interface DoodleStroke {
  points: { x: number; y: number }[]; // Normalized 0..1 coordinates
  color: string;
  size: number; // Relative to canvas width (e.g., 0.012)
  pixelated: boolean;
}

interface DoodleOverlayProps {
  active: boolean;
  strokes: DoodleStroke[];
  onAddStroke: (stroke: DoodleStroke) => void;
  color: string;
  brushSize: number;
  pixelated: boolean;
}

const PEN_COLORS = [
  "#09090b", // Ink Black
  "#ffffff", // Pure White
  "#f43f5e", // Arcade Pink/Red
  "#facc15", // Neon Yellow
  "#22d3ee", // Cyan
  "#a3e635", // Lime
];

export function renderStrokesToCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  strokes: DoodleStroke[]
) {
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;
    ctx.save();
    ctx.fillStyle = stroke.color;
    ctx.strokeStyle = stroke.color;

    const pxSize = Math.max(3, Math.round(stroke.size * width));

    if (stroke.pixelated) {
      for (const pt of stroke.points) {
        const gx = Math.floor((pt.x * width) / pxSize) * pxSize;
        const gy = Math.floor((pt.y * height) / pxSize) * pxSize;
        ctx.fillRect(gx, gy, pxSize, pxSize);
      }
    } else {
      ctx.lineWidth = pxSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      stroke.points.forEach((pt, idx) => {
        const x = pt.x * width;
        const y = pt.y * height;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      if (stroke.points.length === 1) {
        const x = stroke.points[0].x * width;
        const y = stroke.points[0].y * height;
        ctx.arc(x, y, pxSize / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

export function DoodleOverlay({
  active,
  strokes,
  onAddStroke,
  color,
  brushSize,
  pixelated,
}: DoodleOverlayProps) {
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const currentStrokeRef = useRef<DoodleStroke | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const redraw = useCallback(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const allStrokes = currentStrokeRef.current
      ? [...strokes, currentStrokeRef.current]
      : strokes;
    renderStrokesToCanvas(ctx, canvas.width, canvas.height, allStrokes);
  }, [strokes]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  function getNormalizedPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!active) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDrawing(true);

    currentStrokeRef.current = {
      points: [getNormalizedPoint(e)],
      color,
      size: brushSize,
      pixelated,
    };
    redraw();
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!active || !isDrawing || !currentStrokeRef.current) return;
    e.stopPropagation();
    currentStrokeRef.current.points.push(getNormalizedPoint(e));
    redraw();
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing || !currentStrokeRef.current) return;
    e.stopPropagation();
    setIsDrawing(false);
    onAddStroke(currentStrokeRef.current);
    currentStrokeRef.current = null;
  }

  return (
    <canvas
      ref={overlayRef}
      width={600}
      height={800}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`absolute inset-0 h-full w-full touch-none ${active ? "z-20 cursor-crosshair" : "pointer-events-none z-10"
        }`}
    />
  );
}

interface DoodleToolbarProps {
  active: boolean;
  onToggleActive: () => void;
  color: string;
  onChangeColor: (color: string) => void;
  pixelated: boolean;
  onTogglePixelated: () => void;
  brushSize: number;
  onChangeBrushSize: (size: number) => void;
  canUndo: boolean;
  onUndo: () => void;
  onClear: () => void;
}

export function DoodleToolbar({
  active,
  onToggleActive,
  color,
  onChangeColor,
  pixelated,
  onTogglePixelated,
  brushSize,
  onChangeBrushSize,
  canUndo,
  onUndo,
  onClear,
}: DoodleToolbarProps) {
  return (
    <div className="space-y-2 border-2 border-zinc-950 bg-[#fffbeb] p-2.5">
      <div className="flex items-center justify-between gap-1.5">
        <button
          type="button"
          onClick={onToggleActive}
          className={`brutal-btn flex h-8 flex-1 items-center justify-center gap-1.5 px-2 font-pixel text-[10px] font-bold uppercase ${active ? "bg-[#f472b6] text-zinc-950" : "bg-white text-zinc-900"
            }`}
        >
          <Pencil className="h-3 w-3" />
          {active ? "DRAWING: ON" : "DOODLE PEN"}
        </button>

        <button
          type="button"
          onClick={onTogglePixelated}
          title="Switch between Pixel Grid Pen and Smooth Pen"
          className={`brutal-btn flex h-8 items-center gap-1 px-2 font-pixel text-[10px] font-bold uppercase ${pixelated ? "bg-[#facc15] text-zinc-950" : "bg-white text-zinc-700"
            }`}
        >
          <Grid className="h-3 w-3" />
          {pixelated ? "PIXEL" : "INK"}
        </button>

        <button
          type="button"
          disabled={!canUndo}
          onClick={onUndo}
          title="Undo last stroke"
          className="brutal-btn flex h-8 w-8 items-center justify-center bg-white disabled:opacity-40"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          disabled={!canUndo}
          onClick={onClear}
          title="Clear all doodles"
          className="brutal-btn flex h-8 w-8 items-center justify-center bg-[#f43f5e] text-white disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {active && (
        <div className="flex items-center justify-between gap-2 pt-1">
          {/* Color Swatches */}
          <div className="flex items-center gap-1">
            {PEN_COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => onChangeColor(swatch)}
                style={{ backgroundColor: swatch }}
                className={`h-6 w-6 border-2 border-zinc-950 ${color === swatch ? "scale-110 ring-2 ring-zinc-950" : ""
                  }`}
              />
            ))}
          </div>

          {/* Brush Thickness */}
          <div className="flex items-center gap-1">
            {[
              { label: "S", val: 0.008 },
              { label: "M", val: 0.015 },
              { label: "L", val: 0.025 },
            ].map((b) => (
              <button
                key={b.label}
                type="button"
                onClick={() => onChangeBrushSize(b.val)}
                className={`brutal-btn h-6 w-6 font-pixel text-[9px] font-bold ${brushSize === b.val ? "bg-[#22d3ee]" : "bg-white"
                  }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
