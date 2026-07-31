# 設計書

向日葵株式会社 バスケットボールコート 予約システムの設計ドキュメント一式です。

> 最終更新: 2026-08-01 ／ 対象バージョン: GAS Version 4

---

## 読む順番

初めて触る場合は上から順に読んでください。**1〜3 を読めば API を叩けます。**

| # | ファイル | 内容 | 読む人 |
| --- | --- | --- | --- |
| 1 | [01-architecture.md](./01-architecture.md) | 全体構成・コンポーネント・デプロイ経路 | 全員 |
| 2 | [03-api-conventions.md](./03-api-conventions.md) | **通信規約・認証・エラーコード**（API を叩く前に必読） | 実装者 |
| 3 | [api/README.md](./api/README.md) | **action 一覧と個別仕様** | 実装者 |
| 4 | [02-data-model.md](./02-data-model.md) | スプレッドシートの列定義とデータの持ち方 | 実装者・運用者 |
| 5 | [04-business-rules.md](./04-business-rules.md) | 料金・営業時間・予約単位・キャンセル規定 | 全員 |
| 6 | [05-operations.md](./05-operations.md) | デプロイ・スキーマ移行・障害対応 | 運用者 |

---

## 3行でわかる全体像

1. **データの正は Google スプレッドシート1つだけ。** 予約 DB を他に持たない
2. **すべての読み書きは GAS の `/exec` に POST 1本**で行う（action 名で分岐）
3. **業務ルール（重複判定・金額・空き）はすべて GAS 側**にあり、フロントは判定しない

```
【お客様】LINE → LIFF 予約アプリ (hoop-court) ─┐
                                               ├→ GAS Web App → スプレッドシート
【運営】  管理画面 (himawari-site /admin) ─────┘        ↑ ここが唯一の正
```

---

## 現況サマリー（2026-08 時点）

**古い前提で作業しないための3点です。** 詳細は各リンク先を見てください。

| # | 変わったこと | 現在の状態 | 詳細 |
| --- | --- | --- | --- |
| 1 | **当日予約を解禁** | 拒否するのは「開始時刻 < 現在時刻」だけ。**当日でも開始前なら予約できる** | [04-business-rules §5](./04-business-rules.md#5-予約できる時間当日判定) |
| 2 | **管理用の4 action を追加** | `admin.reservations.create` / `cancel` / `admin.slots.list` / `set`。GAS Version 4 で本番稼働中 | [api/README.md](./api/README.md) |
| 3 | **PayPay は利用不可** | 加盟店契約が未了。店頭・オンラインとも**使えない**。案内は**現金のみ**に統一済み | [04-business-rules §7](./04-business-rules.md#7-入金と売上) |

> ⚠ 3 について。**「PayPay で支払える」と書いた案内が残っていたら、それは実態と食い違っています。**
> LIFF 側の文言は hoop-court PR #28 で現金のみに統一しました（[04-business-rules §7-B](./04-business-rules.md#7-b-お客様への案内文言pr-28-で統一済み) に実文言）。
> `payment_method` の enum に `PAYPAY` は残っていますが、**選ばせてはいけません**。

---

## この設計書の約束

- **`apps-script/Code.gs` が仕様の正本です。** 本書と食い違う場合はコードが正しく、本書がバグです
- action を追加・変更したら `api/` に対応するファイルを必ず更新してください
- 資格情報（パスワード・トークン・`/exec` URL）は**一切書きません**。Git に残ると回収できません

## 関連ドキュメント

| 場所 | 内容 |
| --- | --- |
| [`docs/operations/`](../operations/README.md) | **運用ガイド**。場面別のシナリオ（S-01〜S-23 / T-01〜T-10）と操作↔システム対応表 |
| `apps-script/README.md` | GAS のセットアップ手順・運用上の注意 |
| `README.md`（リポジトリ直下） | LIFF アプリの開発手順 |
| himawari-site `docs/handover/` | 管理画面側の引き継ぎ資料 |
