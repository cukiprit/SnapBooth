"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import type { SharePayload } from "@/hooks/use-qr-share";

function ShareReceiverContent() {
  const searchParams = useSearchParams();
  const hostPeerId = searchParams.get("peer");

  const [state, setState] = useState<
    "connecting" | "receiving" | "ready" | "error"
  >("connecting");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState("snapbooth.png");
  const [caption, setCaption] = useState("SNAPBOOTH.EXE");
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (!hostPeerId) {
      setState("error");
      setErrorText("Missing booth session ID in QR link.");
      return;
    }

    let destroyed = false;
    let objectUrl: string | null = null;

    async function connectToBooth() {
      try {
        const { default: PeerConstructor } = await import("peerjs");
        const peer = new PeerConstructor();

        peer.on("open", () => {
          if (destroyed) return;
          setState("receiving");
          const conn = peer.connect(hostPeerId!, { reliable: true });

          conn.on("data", (raw) => {
            const payload = raw as SharePayload;
            const blob = new Blob([payload.buffer], {
              type: payload.mimeType,
            });
            objectUrl = URL.createObjectURL(blob);

            setImageUrl(objectUrl);
            setFilename(payload.filename || "snapbooth.png");
            setCaption(payload.caption || "SNAPBOOTH.EXE");
            setState("ready");
          });

          conn.on("error", (err) => {
            if (!destroyed) {
              setErrorText(err.message || "Transfer failed.");
              setState("error");
            }
          });
        });

        peer.on("error", (err) => {
          if (!destroyed) {
            setErrorText(
              err.message ||
              "Could not reach photo booth. Make sure the booth tab is still open."
            );
            setState("error");
          }
        });
      } catch (err) {
        if (!destroyed) {
          setErrorText(
            err instanceof Error ? err.message : "Failed to start receiver."
          );
          setState("error");
        }
      }
    }

    connectToBooth();

    return () => {
      destroyed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [hostPeerId]);

  function handleSave() {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#f4f4f0] p-4 text-zinc-950">
      <div className="w-full max-w-sm border-4 border-zinc-950 bg-white p-5 shadow-[6px_6px_0px_#09090b]">
        <div className="mb-4 flex items-center justify-between border-b-2 border-zinc-950 pb-2">
          <h1 className="font-pixel text-xs font-black uppercase">
            SNAPBOOTH.EXE // TRANSFER
          </h1>
          <span className="border border-zinc-950 bg-[#a3e635] px-2 py-0.5 font-mono text-[10px] font-bold">
            P2P DIRECT
          </span>
        </div>

        {(state === "connecting" || state === "receiving") && (
          <div className="flex flex-col items-center space-y-3 py-12 text-center">
            <Loader2 className="h-9 w-9 animate-spin" />
            <p className="font-pixel text-xs font-bold uppercase">
              {state === "connecting"
                ? "CONNECTING TO BOOTH..."
                : "RECEIVING YOUR PHOTO..."}
            </p>
          </div>
        )}

        {state === "ready" && imageUrl && (
          <div className="space-y-4">
            <div className="overflow-hidden border-2 border-zinc-950 bg-zinc-100">
              <img
                src={imageUrl}
                alt={caption}
                className="mx-auto max-h-[60dvh] w-auto object-contain"
              />
            </div>

            <button
              type="button"
              onClick={handleSave}
              className="flex h-12 w-full items-center justify-center gap-2 border-2 border-zinc-950 bg-[#a3e635] font-pixel text-xs font-black uppercase shadow-[4px_4px_0px_#09090b] active:translate-x-0.5 active:translate-y-0.5"
            >
              <Download className="h-4 w-4" />
              DOWNLOAD ({filename.endsWith(".gif") ? "GIF" : "PNG"})
            </button>

            <p className="flex items-center justify-center gap-1 text-center font-mono text-[11px] text-zinc-600">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Tip: On iPhone, you can also press &amp; hold the image to Save
              to Photos.
            </p>
          </div>
        )}

        {state === "error" && (
          <div className="flex flex-col items-center space-y-2 py-10 text-center">
            <AlertCircle className="h-8 w-8 text-[#f43f5e]" />
            <p className="font-pixel text-xs font-bold text-[#f43f5e]">
              TRANSFER FAILED
            </p>
            <p className="font-mono text-xs text-zinc-600">{errorText}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center font-mono text-xs">
          Loading transfer...
        </div>
      }
    >
      <ShareReceiverContent />
    </Suspense>
  );
}
