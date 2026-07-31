# `admin.reservations.markPaid` 🔴

[← action 一覧](./README.md)

> 種別: **管理** ／ 実装: `adminMarkPaid_()`

入金を記録します。**売上集計に計上されます。**

## 認証

管理トークン。

## payload

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `reservation_id` | string | ✅ | 内部ID・予約番号のどちらでも可 |
| `method` | enum | | `CASH` / `PAYPAY` / `BANK_TRANSFER` |
| `received_by` | string | | 受領者 |
| `amount` | number | | 受領額 |
| `note` | string | | メモ |

## 戻り値

```json
{ "paid_at": "2026-08-01T10:30:00+09:00" }
```

## エラー

| code | 条件 |
| --- | --- |
| `AUTH` / `FORBIDDEN` | 認証・権限 |
| `NOT_FOUND` | 予約が見つからない |

## 書き込まれる値

| 列 | 値 |
| --- | --- |
| `payment_status` | `PAID` |
| `paid_at` / `updated_at` | 実行時刻 |

## ⚠ 既知の不整合（未修正）

> **`method` / `received_by` / `amount` / `note` は受け取っても保存されません。**
> クライアント（LIFF・管理画面とも）は `method` を送っていますが、GAS 側は
> `reservation_id` しか見ていません。
>
> `payment_method` 列は 2026-08 に追加済みなので、`method` を保存するのは1行の変更です。
> ただし**現状は「どの方法で受け取ったか」が記録に残りません**。
> `admin.reservations.create` 経由で作った予約だけは `payment_method` が入ります。

## 挙動の注意

- 冪等です。2回実行すると `paid_at` が新しい時刻で上書きされます
- **取り消す action がありません。** 誤って記録した場合はスプレッドシートを直接修正します
- 金額の検証をしません。`total_amount` と実際の受領額の突き合わせは行われません
