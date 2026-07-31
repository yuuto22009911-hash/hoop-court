# `admin.reservations.markRefunded` 🟡

[← action 一覧](./README.md)

> 種別: **管理** ／ 実装: `adminMarkRefunded_()` ／ 追加: 2026-08

返金を記録します。`payment_status` を `REFUNDED` にして、**売上集計から外します。**

**キャンセルしただけでは売上から外れません。** 実際にお金を返したときだけ実行します
（理由は [04-business-rules §7-C](../04-business-rules.md#7-c-返金)）。

## 認証

管理トークン。

## payload

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `reservation_id` | string | ✅ | 内部ID・予約番号（`R-YYYY-MM-DD-xxxx`）のどちらでも可 |

## 戻り値

```json
{
  "payment_status": "REFUNDED",
  "prev_payment_status": "PAID",
  "display_number": "R-2026-08-01-167f",
  "amount": 1800,
  "already": false,
  "refunded_at": "2026-08-02T11:00:00+09:00"
}
```

| フィールド | 説明 |
| --- | --- |
| `prev_payment_status` | 実行前の状態。`already` の判断材料 |
| `amount` | `total_amount`。**返金した額ではなく予約金額**です |
| `already` | すでに `REFUNDED` だった場合に `true`（**エラーにしません**） |
| `refunded_at` | 最初に返金を記録した時刻。2回目以降も**上書きしません** |

## エラー

| code | 条件 |
| --- | --- |
| `AUTH` / `FORBIDDEN` | 認証・権限 |
| `NOT_FOUND` | 予約が見つからない |
| `VALIDATION` | **入金が記録されていない**（`payment_status` が `PAID` でも `REFUNDED` でもない） |
| `CONFIG` | `refunded_at` / `refunded_by` 列が無い（`migrateSheets()` の実行漏れ） |

## 書き込まれる値

| 列 | 値 |
| --- | --- |
| `payment_status` | `REFUNDED` |
| `refunded_at` | 実行時刻 |
| `refunded_by` | `admin:<username>` / `line:<userId>`（`canceled_by` と同じ形式） |
| `updated_at` | 実行時刻 |

**`paid_at` と `payment_method` は消しません。** 「入金があり、あとで返した」という
事実の順序を残すためです。

## 挙動の注意

- **冪等です。** 2回押しても最初の `refunded_at` が残ります（`already: true`）
- `status`（`CONFIRMED` / `CANCELED` など）は**変えません**。予約のキャンセルは
  [`admin.reservations.cancel`](./admin.reservations.cancel.md) の仕事です
- キャンセルせずに返金することもできます（料金の取り違えなど）
- **お客様への LINE 通知は送りません**

## 誤って記録したとき

[`admin.reservations.markPaid`](./admin.reservations.markPaid.md) を実行すると `PAID` に戻ります。
そのとき `refunded_at` / `refunded_by` も**自動で消えます**（状態が矛盾しないように）。

## 設計判断

### なぜキャンセル時に自動で `REFUNDED` にしないのか

**キャンセルと返金は別の出来事だからです。** キャンセル料が0円でも、当日キャンセルで
返金しない運用や、返金手続きが後日になる運用がありえます。自動化すると
「入金はあったのに売上に出ない」ズレが黙って生まれます。

現金手渡しの返金はシステムの外で起きるため、**実際に返したという人の確認**を挟みます。

### なぜ `payment_status` を `UNPAID` に戻さないのか

`UNPAID` は「まだもらっていない」で、`REFUNDED` は「もらったが返した」です。
区別できないと、未収金の督促リストに返金済みの予約が混ざります。

## 呼び出し元

| クライアント | 状態 |
| --- | --- |
| 現行 管理画面（`himawari-site`） | **UI 未実装**（2026-08 時点）。`src/lib/gas/client.ts` にも関数が無い |
| 旧 管理画面（`hoop-court` `/admin`・廃止予定） | 未実装。追加しない |
| LIFF 予約画面 | 使いません |
