# `reservations.create` 🟡

[← action 一覧](./README.md)

> 種別: **会員** ／ 実装: `reservationsCreate_()` → `createReservationCore_()`

お客様が自分で予約を作成します。

## 認証

LINE IDトークン（必須）。**かつ会員登録済みであること。**

## payload

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `court_id` | string | ✅ | |
| `mode` | enum | | `CHARTER`（既定） / `FREE` |
| `starts_at` | ISO8601 | ✅ | 開始日時 |
| `ends_at` | ISO8601 | ✅ | 終了日時（排他） |
| `purpose` | string | | 用途 |
| `group_name` | string | | 団体名（フロントでは必須にしている） |
| `rep_name` | string | | 代表者名 |
| `headcount` | number | `FREE` で必須 | 1〜9 |
| `note` | string | | 備考 |

**金額は送りません。** GAS が算出します。

## 戻り値

```json
{ "reservation_id": "9f2c…", "display_number": "R-2026-08-01-9f2c", "amount": 1800 }
```

## エラー

| code | 条件 |
| --- | --- |
| `AUTH` | IDトークン不正 |
| `UNREGISTERED` | プロフィール未登録 |
| `VALIDATION` | 日時が未指定・形式不正 |
| `P0002` | 終了 ≦ 開始 |
| `P0004` | 営業時間外 |
| `P0005` | **開始時刻が現在より過去** |
| `P0010` | コートが見つからない |
| `P0001` | 時間帯が重複 |
| `P0006` / `P0007` / `P0008` | フリーの単位・人数・残人数 |
| `P0009` / `P0011` | 貸切の単位 |

判定の詳細は [04-business-rules.md](../04-business-rules.md)。

## 書き込まれる値

| 列 | 値 |
| --- | --- |
| `user_id` | 会員の `Users.id` |
| `source` | **空**（LIFF 経由の印） |
| `status` | `CONFIRMED` |
| `payment_status` | `UNPAID` |
| `total_amount` | GAS が算出した確定金額 |

## 挙動の注意

- **`LockService`（20秒）の中で**重複判定 → 金額算出 → 行追記を行います
- 成功後、**ロックを解放してから** LINE 通知を送ります。
  通知に失敗しても予約は成立します（友だち未追加・トークン未設定は想定内）
- **冪等ではありません。** 再送すると二重予約になります

## 実装メモ

検証・金額・排他は `createReservationCore_()` に集約しており、
[`admin.reservations.create`](./admin.reservations.create.md) と**同じコードを通ります**。
差分は `user_id` / `source` / `allowPast` / 通知の有無 / `phone`・`payment_method` の記録だけです。
