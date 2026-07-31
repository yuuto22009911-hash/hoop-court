# CLAUDE.md

向日葵株式会社 バスケ体育館（ハーフコート1面）の LIFF 予約アプリ。
**`apps-script/Code.gs`（GAS バックエンド）の正本もこのリポジトリにあります。**

## 着手前に読む

**このプロジェクトは複数の Claude Code セッションが並行して触ります。**
作業を始める前に [`docs/design/README.md`](docs/design/README.md) を読んで認識を合わせてください。
プロジェクト横断の取り決めは `himawari-site` の `docs/architecture.md` にあります。

### 現況（2026-08 時点・古い前提で作らない）

- **当日予約は解禁済み。** 拒否するのは「開始時刻 < 現在時刻」だけ（`P0005`）
- **管理用の4 action が本番稼働中**: `admin.reservations.create` / `cancel` / `admin.slots.list` / `set`
- **返金は `admin.reservations.markRefunded`**（未反映・UI 未実装）。キャンセルしただけでは売上から外れない
- **PayPay は使えません**（加盟店契約が未了）。案内は**現金のみ**に統一済み。
  文言は [`docs/design/04-business-rules.md`](docs/design/04-business-rules.md) §7-B。**「PayPay で支払える」と書かない**

### 破ると予約データが壊れる3点

1. **予約データの保存先を新設しない**
   正は **GAS + Google スプレッドシートのみ**。このリポジトリにも Cloudflare D1/KV にも
   予約を保存しない。二重管理になった瞬間に二重予約が起きる。
2. **既存 action を削除・改名・仕様変更しない**
   LIFF 予約アプリと `himawari-site` の管理画面が同じ action を呼ぶ。
   レスポンスのフィールドも削除・改名しない（追加は可）。
   現行22 action の仕様は [`docs/design/api/`](docs/design/api/README.md) に1 action = 1ファイルで揃えてある。
3. **GAS は「稼働中のウェブアプリを編集 → 新バージョン」で更新する**
   「新しいデプロイ」を作ると `/exec` URL が変わり、**LIFF と管理画面が両方止まる**。
   手順は [`docs/design/05-operations.md`](docs/design/05-operations.md) §1。

> ⚠ `main` にマージしても **GAS は自動反映されません**。エディタへの貼り付けが必要です。

### 作業したら更新するもの

1ファイルだけ直すと、他のセッションが古い前提で動きます。

| 変えたもの | 更新するファイル |
| --- | --- |
| 稼働状況・次の作業 | **`himawari-site` の `docs/status.md`** ← 必ず |
| GAS の action | [`docs/design/api/<action>.md`](docs/design/api/README.md) |
| 業務ルール（料金・営業時間・単位） | [`docs/design/04-business-rules.md`](docs/design/04-business-rules.md) + `src/lib/pricing.ts` + `himawari-site` の `pricing.ts` |
| 運用手順 | [`docs/operations/`](docs/operations/README.md) |

## よく使うコマンド

```bash
npm install
npm run dev        # http://localhost:3000（DEMO_MODE=1 なら LINE/GAS 不要）
npm run lint       # next lint
npm run typecheck  # tsc --noEmit
npm run build      # 本番ビルド（CI と同じ）
```

> 品質ゲートは lint / typecheck / build の3つがすべて成功すること。テストは未導入。

## 技術スタック

Next.js 14 (App Router) / TypeScript 5 / Tailwind CSS 3 / `@line/liff` 2.24+ /
Cloudflare Pages + `@cloudflare/next-on-pages`（Edge Runtime）。

バックエンドは Google Apps Script + Google スプレッドシート（`apps-script/Code.gs`）。

## アーキテクチャの要点

- **業務ルールはすべて GAS 側**にある。重複判定・空き計算・金額算出をフロントに実装しない。
  `src/lib/pricing.ts` は表示用のミラーで、確定金額は GAS が返す `total_amount` を使う
- **通信は `/exec` への POST 1本**。`Content-Type: text/plain;charset=UTF-8` を守る
  （`application/json` は CORS プリフライトで失敗する）
- **`DEMO_MODE=1`** で LINE も GAS も無しに UI を通せる（`src/lib/gas.ts` の DEMO 分岐）
- `/admin` は **`himawari-site` に統一済みで、こちらは廃止予定**。ただし現存し同じ GAS を見る

## ドキュメント

| 場所 | 内容 |
| --- | --- |
| [`docs/design/`](docs/design/README.md) | 設計書。構成・データモデル・**API を action ごと**・業務ルール・運用手順 |
| [`docs/operations/`](docs/operations/README.md) | 運用ガイド。場面別シナリオ34件と操作↔システム対応表 |
| [`apps-script/README.md`](apps-script/README.md) | GAS のセットアップと再デプロイの鉄則 |
