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
| `method` | enum | | `CASH` / `PAYPAY` / `BANK_TRANSFER`。**`payment_method` 列に保存されます**。`PAYPAY` は[現在使えません](../04-business-rules.md#7-a-paypay-が使えない理由といま何が制限されているか) |
| `received_by` | string | | 受領者。**保存されません** |
| `amount` | number | | 受領額。**保存されません** |
| `note` | string | | メモ。**保存されません** |

## 戻り値

```json
{ "paid_at": "2026-08-01T10:30:00+09:00", "payment_method": "CASH" }
```

`payment_method` は**実際に保存した値**です。`method` が未指定、または enum 以外の値だった場合は
空文字を返します（入金の記録自体は成功しています）。

## エラー

| code | 条件 |
| --- | --- |
| `AUTH` / `FORBIDDEN` | 認証・権限 |
| `NOT_FOUND` | 予約が見つからない |
| `CONFIG` | `method` を保存しようとしたが `payment_method` 列が無い（`migrateSheets()` の実行漏れ） |

## 書き込まれる値

| 列 | 値 |
| --- | --- |
| `payment_status` | `PAID` |
| `paid_at` / `updated_at` | 実行時刻 |
| `payment_method` | `method` が enum に一致したときのみ。一致しなければ**書き換えません**（既存値を残す） |

## `method` の扱い

**未知の値でもエラーにはせず、記録だけを見送ります。**

旧 `/admin`（hoop-court 側・廃止予定）は `window.prompt` の自由入力を送っており、
`現金` のような値が来ることがあります。ここで `VALIDATION` を返すと、
**今まで通っていた入金記録が失敗するようになる**ため、値は捨てて `PAID` の記録だけ行います。
保存できたかどうかは戻り値の `payment_method` で判別してください。

`admin.reservations.create` の `payment_method` は逆に**厳格に検証します**（不正なら `VALIDATION`）。
あちらは新しい action で、送っているのが自前のフォームだけだからです。

## 挙動の注意

- 冪等です。2回実行すると `paid_at` が新しい時刻で上書きされます
- **取り消す action がありません。** 誤って記録した場合はスプレッドシートを直接修正します
- 金額の検証をしません。`total_amount` と実際の受領額の突き合わせは行われません
