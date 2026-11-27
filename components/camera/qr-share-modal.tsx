"use client";

import { QRCodeSVG } from "qrcode.react";
import { X, CheckCircle2, Loader2, Smartphone } from "lucide-react";

interface QrShareModalProps {
  shareUrl: string | null;
  status: "idle" | "preparing" | "ready" | "sent" | "error";
  errorMsg: string | null;
  fileLabel: string;
  onClose: () => void;
}

export function QrShareModal({
  shareUrl,
  status,
  errorMsg,
  fileLabel,
  onClose,
}: QrShareModalProps) {
  if (status === "idle") return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xs border-4 border-zinc-950 bg-white p-5 text-zinc-950 shadow-[8px_8px_0px_#09090b]">
        <div className="mb-3 flex items-center justify-between border-b-2 border-zinc-950 pb-2">
          <span className="flex items-center gap-1.5 font-pixel text-xs font-black uppercase">
            <Smartphone className="h-4 w-4" /> SCAN TO SAVE
          </span>
          <button
            type="button"
            onClick={onClose}
            className="brutal-btn flex h-7 w-7 items-center justify-center bg-[#f43f5e] text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {status === "preparing" && (
          <div className="flex flex-col items-center justify-center space-y-2 py-10">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="font-pixel text-xs font-bold uppercase">
              GENERATING QR LINK...
            </p>
          </div>
        )}

        {(status === "ready" || status === "sent") && shareUrl && (
          <div className="flex flex-col items-center space-y-3 text-center">
            <div className="border-4 border-zinc-950 bg-white p-3">
              <QRCodeSVG
                value={shareUrl}
                size={190}
                level="M"
                bgColor="#ffffff"
                fgColor="#09090b"
              />
            </div>

            <span className="border border-zinc-950 bg-[#facc15] px-2 py-0.5 font-mono text-[11px] font-bold uppercase">
              FILE: {fileLabel}
            </span>

            {status === "sent" ? (
              <div className="flex items-center gap-1.5 border-2 border-zinc-950 bg-[#a3e635] px-3 py-1.5 font-pixel text-[10px] font-bold uppercase">
                <CheckCircle2 className="h-4 w-4" />
                SENT TO PHONE! (ANOTHER GUEST CAN STILL SCAN)
              </div>
            ) : (
              <p className="font-mono text-xs text-zinc-600">
                Point your phone camera at the QR code to receive your photo
                instantly. Keep this window open while scanning.
              </p>
            )}
          </div>
        )}

        {status === "error" && (
          <div className="space-y-2 py-6 text-center">
            <p className="font-pixel text-xs font-bold text-[#f43f5e]">
              CONNECTION ERROR
            </p>
            <p className="font-mono text-xs text-zinc-600">{errorMsg}</p>
          </div>
        )}
      </div>
    </div>
  );
}
