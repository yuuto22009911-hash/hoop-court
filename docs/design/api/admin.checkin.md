# `admin.checkin` 🔴

[← action 一覧](./README.md)

> 種別: **管理** ／ 実装: `adminCheckin_()`

来場したお客様を受付（チェックイン）します。**取り消せません。**

## 認証

管理トークン。

## payload

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `reservation_id` | string | ✅ | **QR の内部ID、または予約番号(`R-…`)** |

## 戻り値

```json
{ "checked_in_at": "2026-08-01T09:58:00+09:00",
  "display_number": "R-2026-08-01-167f", "group_name": "向日葵クラブ" }
```

受付画面で「誰を受け付けたか」を読み上げ確認できるよう、予約番号と団体名を返します。

## エラー

| code | 条件 |
| --- | --- |
| `AUTH` / `FORBIDDEN` | 認証・権限 |
| `NOT_FOUND` | 予約が見つからない |
| `ALREADY_CHECKED_IN` | すでに `COMPLETED`、または `checked_in_at` が入っている |

## 書き込まれる値

| 列 | 値 |
| --- | --- |
| `status` | `COMPLETED` |
| `checked_in_at` / `updated_at` | 実行時刻 |

## ⚠ 取り消せません

> 逆操作の action がありません。誤って受け付けた場合は、
> **スプレッドシートの `status` と `checked_in_at` を直接修正**するしかありません。

## 挙動の注意

- **予約番号でも受付できます。** iPhone は QR の自動読み取りに非対応のため、
  受付画面から番号を入力する導線が主です
- **status を確認しません。** `CANCELED` の予約でも受付できてしまいます
  （`COMPLETED` と `checked_in_at` だけをチェックしているため）
- 日時の妥当性も見ません。翌週の予約でも受付できます
