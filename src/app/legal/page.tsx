/**
 * 特定商取引法表記
 * 仕様書 §9.4 / §3.4 S-04 から遷移想定。
 *
 * 本テンプレはひな型。実際の事業者情報に書き換えてから公開すること。
 */

export default function LegalPage() {
  return (
    <>
      <header className="app-header">特定商取引法表記</header>
      <main className="app-main">
        <dl className="text-sm">
          <Row label="販売事業者" value="株式会社 〇〇〇〇" />
          <Row label="代表者" value="〇〇 〇〇" />
          <Row label="所在地" value="〇〇県〇〇市〇〇町 0-0-0" />
          <Row label="電話番号" value="00-0000-0000（受付時間 10:00-18:00 平日）" />
          <Row label="メールアドレス" value="info@example.com" />
          <Row label="販売価格" value="各予約画面に表示（消費税込み）" />
          <Row label="商品代金以外の必要料金" value="なし" />
          <Row label="支払方法" value="来場時の現地支払い（現金 / PayPay / 口座振込）" />
          <Row label="支払時期" value="ご利用当日、受付時" />
          <Row
            label="商品の引渡時期"
            value="予約した時間帯にご指定のコートをご利用いただけます。"
          />
          <Row
            label="返品・キャンセル"
            value="利用開始 72 時間以上前: 料金発生なし / 72 時間未満: 料金 50% / 72 時間未満かつ無連絡: 料金 100%（仕様書 §8.3）"
          />
        </dl>
        <p className="text-xs text-muted mt-6">
          このページは特定商取引法に基づく表示です。公開前に、必ず実際の事業者情報へ置き換えてください。
        </p>
      </main>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2 border-b border-[#e5e7eb]">
      <dt className="text-muted text-xs">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
