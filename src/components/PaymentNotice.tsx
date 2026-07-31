/**
 * PayPay 未対応のお知らせポップアップ
 *
 * PayPay 加盟店契約が未了のため、現時点ではオンライン事前決済も店頭 PayPay も利用できない。
 * サイト上の案内だけだと見落とされるため、支払いの話が出る画面で一度だけポップアップで伝える。
 *
 * - 同じセッション中は一度しか出さない（sessionStorage）。予約フローを妨げないための措置。
 * - 加盟店契約と PayPay 決済の実装が完了したら、このコンポーネントごと削除する。
 */

"use client";

import { useEffect, useState } from "react";

const SEEN_KEY = "hc_paypay_notice_seen";

export default function PaymentNotice() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SEEN_KEY) === "1") return;
    } catch {
      // プライベートブラウズ等で sessionStorage が使えない場合は毎回表示する
    }
    setOpen(true);
  }, []);

  function close() {
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // 保存できなくても閉じる動作は妨げない
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={close}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="paypay-notice-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="paypay-notice-title" className="font-semibold mb-2">
          PayPay でのお支払いについて
        </h2>
        <p className="text-sm mb-2">
          現在、PayPay でのお支払いはご利用いただけません（準備中です）。
        </p>
        <p className="text-sm mb-4">
          お支払いは<strong>ご利用当日、現地にて現金</strong>でお願いいたします。
        </p>
        <button type="button" className="btn btn-primary w-full" onClick={close} autoFocus>
          確認しました
        </button>
      </div>
    </div>
  );
}
