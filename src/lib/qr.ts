/**
 * QR 生成 (クライアント側) 仕様書 §7.8
 * reservation_id を文字列として encode して <canvas> に描画する。
 */

"use client";

import QRCode from "qrcode";

export async function renderReservationQr(
  canvas: HTMLCanvasElement,
  reservationId: string
): Promise<void> {
  await QRCode.toCanvas(canvas, reservationId, {
    width: 240,
    margin: 1,
    color: { dark: "#1f2937", light: "#ffffff" }
  });
}
