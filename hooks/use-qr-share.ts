import { useState, useRef, useCallback, useEffect } from "react";
import type Peer from "peerjs";

export interface SharePayload {
  filename: string;
  mimeType: string;
  buffer: ArrayBuffer;
  caption: string;
}

export function useQrShare() {
  const peerRef = useRef<Peer | null>(null);
  const payloadRef = useRef<SharePayload | null>(null);

  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "idle" | "preparing" | "ready" | "sent" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const closeShare = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    payloadRef.current = null;
    setShareUrl(null);
    setStatus("idle");
    setErrorMsg(null);
  }, []);

  useEffect(() => {
    return () => {
      if (peerRef.current) peerRef.current.destroy();
    };
  }, []);

  const startQrShare = useCallback(
    async (blob: Blob, filename: string, caption: string) => {
      closeShare();
      setStatus("preparing");

      try {
        const buffer = await blob.arrayBuffer();
        payloadRef.current = {
          filename,
          mimeType: blob.type || "image/png",
          buffer,
          caption,
        };

        const { default: PeerConstructor } = await import("peerjs");
        const peer = new PeerConstructor();
        peerRef.current = peer;

        peer.on("open", (id) => {
          const url = `${window.location.origin}/share?peer=${encodeURIComponent(id)}`;
          setShareUrl(url);
          setStatus("ready");
        });

        peer.on("connection", (conn) => {
          conn.on("open", () => {
            if (payloadRef.current) {
              conn.send(payloadRef.current);
              setStatus("sent");
            }
          });
        });

        peer.on("error", (err) => {
          console.error("PeerJS error:", err);
          setErrorMsg(err.message || "Peer connection failed.");
          setStatus("error");
        });
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : "Could not initialize QR share."
        );
        setStatus("error");
      }
    },
    [closeShare]
  );

  return {
    shareUrl,
    status,
    errorMsg,
    startQrShare,
    closeShare,
  };
}
