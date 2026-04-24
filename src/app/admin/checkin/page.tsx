/**
 * A-04 QR スキャン (来場チェックイン)
 * 仕様書 §3.1 / admin.checkin
 *
 * カメラ API を使う実装:
 *   - HTMLVideoElement に stream を流し込み
 *   - BarcodeDetector が利用可能ならそれを使う
 *   - ない場合は手動入力に fallback
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { adminCheckin } from "@/lib/gas";
import { getIdToken } from "@/lib/auth";

interface BarcodeDetectorResult {
  rawValue: string;
  boundingBox?: DOMRectReadOnly;
}

type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => {
  detect: (source: CanvasImageSource) => Promise<BarcodeDetectorResult[]>;
};

export default function AdminCheckin() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let canceled = false;
    (async () => {
      try {
        if (
          typeof navigator === "undefined" ||
          !navigator.mediaDevices ||
          !navigator.mediaDevices.getUserMedia
        ) {
          setError("カメラ API が利用できません。");
          return;
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false
        });
        if (canceled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
          startScanLoop();
        }
      } catch (err) {
        setError(
          "カメラへのアクセスが拒否されました。QR 番号を手動で入力してください。"
        );
      }
    })();
    return () => {
      canceled = true;
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startScanLoop() {
    const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
      .BarcodeDetector;
    if (!Ctor) {
      setError(
        "このブラウザは BarcodeDetector 未対応です。QR 番号を手動入力してください。"
      );
      return;
    }
    const detector = new Ctor({ formats: ["qr_code"] });
    const tick = async () => {
      if (!videoRef.current) return;
      try {
        const res = await detector.detect(videoRef.current);
        if (res[0] && res[0].rawValue) {
          await handleResult(res[0].rawValue);
        }
      } catch (err) {
        // 無視 (フレーム単位の失敗は頻発するため)
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  async function handleResult(raw: string) {
    if (busy) return;
    if (raw === lastResult) return;
    setLastResult(raw);
    setBusy(true);
    setError(null);
    try {
      const r = await adminCheckin(getIdToken(), raw);
      alert(
        `チェックイン完了\n${r.display_number}\n${r.group_name}\n${r.checked_in_at}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleManual() {
    if (!manual.trim()) return;
    await handleResult(manual.trim());
    setManual("");
  }

  return (
    <div>
      <p className="text-sm text-muted mb-2">
        予約 QR をカメラにかざしてください。
      </p>

      <div
        className="w-full aspect-[4/3] rounded-[8px] mb-3 overflow-hidden"
        style={{ background: "#000" }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          className="w-full h-full object-cover"
          aria-label="QR カメラ"
        />
      </div>
      {!cameraReady && (
        <p className="text-xs text-muted">カメラ準備中...</p>
      )}
      <canvas ref={canvasRef} className="hidden" />

      {error && (
        <p className="text-danger text-sm mb-3" role="alert">
          {error}
        </p>
      )}

      <label className="field">
        手動で予約 ID を入力
        <input
          type="text"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="reservation_id"
        />
      </label>
      <button
        type="button"
        className="btn btn-primary w-full"
        disabled={!manual || busy}
        onClick={handleManual}
      >
        {busy ? "処理中..." : "チェックインする"}
      </button>
    </div>
  );
}
