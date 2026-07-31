# `reservations.cancel` 🟡

[← action 一覧](./README.md)

> 種別: **会員** ／ 実装: `reservationsCancel_()`

お客様が**自分の**予約をキャンセルします。

## 認証

LINE IDトークン（必須）。

## payload

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `reservation_id` | string | ✅ | **内部ID(UUID)のみ。予約番号は使えません** |

## 戻り値

```json
{ "charge_rate": 0, "charge_amount": 0 }
```

| フィールド | 説明 |
| --- | --- |
| `charge_rate` | キャンセル料の料率。**現状は常に 0** |
| `charge_amount` | 請求額。`total_amount × charge_rate` の切り捨て。現状は常に 0 |

## エラー

| code | 条件 |
| --- | --- |
| `AUTH` | IDトークン不正 |
| `NOT_FOUND` | 予約が見つからない |
| `FORBIDDEN` | **他人の予約**、または未登録ユーザー |

## 書き込まれる値

| 列 | 値 |
| --- | --- |
| `status` | `CANCELED` |
| `canceled_at` / `updated_at` | 実行時刻 |

`cancel_reason` / `canceled_by` は**書き込みません**（会員のセルフキャンセルのため）。

## 挙動の注意

- **LINE 通知は送りません**
- **予約番号（`R-…`）では引けません。** 内部ID の完全一致のみです。
  管理者向けの [`admin.reservations.cancel`](./admin.reservations.cancel.md) は両方で引けます
- status を問わず実行できます（`CANCELED` を再度キャンセルしても成功扱い）
- **ロックを取りません。** 二重実行しても結果は同じなので実害はありません

## 既知の差異

管理者版と違い `already` / `prev_status` を返しません。戻り値の形も異なります
（こちらはキャンセル料の提示が目的のため）。
