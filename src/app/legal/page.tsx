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
          <Row label="販売事業者" value="向日葵株式会社" />
          <Row label="代表者" value="川村 有希" />
          <Row label="所在地" value="〒574-0041 大阪府大東市浜町2-4" />
          <Row label="電話番号" value="090-7889-2729" />
          <Row label="メールアドレス" value="himawari20251113@gmail.com" />
          <Row label="販売価格" value="各予約画面に表示（消費税込み）" />
          <Row label="商品代金以外の必要料金" value="なし" />
          <Row label="支払方来場時の現地支払い（PayPay・当日カウンターは現金も可）" />
          <Row label="支払時期" value="ご利用当日、受付時" />
          <Row
            label="商品の引渡時期"
            value="予約した時間帯にご指定のコートをご利用いただけます。"
          />
          <Row
            label="返品・キャンセル"
            value="当面いつでも無料（2026年6月 暫定方針）"
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
