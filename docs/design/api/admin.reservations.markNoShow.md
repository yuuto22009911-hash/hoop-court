# `admin.reservations.markNoShow` 🟡

[← action 一覧](./README.md)

> 種別: **管理** ／ 実装: `adminMarkNoShow_()`

無断キャンセル（No-Show）として記録します。

## 認証

管理トークン。

## payload

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `reservation_id` | string | ✅ | 内部ID・予約番号のどちらでも可 |

## 戻り値

```json
{ "status": "NO_SHOW" }
```

## エラー

| code | 条件 |
| --- | --- |
| `AUTH` / `FORBIDDEN` | 認証・権限 |
| `NOT_FOUND` | 予約が見つからない |
| `AMBIGUOUS` | 予約番号が複数の予約に一致した（同日に UUID 先頭4桁が衝突）。一覧から選ぶか予約IDで指定する |

## 書き込まれる値

| 列 | 値 |
| --- | --- |
| `status` | `NO_SHOW` |
| `updated_at` | 実行時刻 |

## 挙動の注意

- **status を無条件で上書きします。** `COMPLETED`（受付済み）でも `NO_SHOW` にできてしまいます
- 取り消す action はありませんが、[`admin.reservations.cancel`](./admin.reservations.cancel.md) で
  `CANCELED` にはできます（`prev_status: "NO_SHOW"` が返る）
- `NO_SHOW` になった予約は**重複判定の対象から外れます**（`CONFIRMED` のみを見るため）。
  その枠は再び予約可能になります
