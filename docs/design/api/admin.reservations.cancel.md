# `admin.reservations.cancel` 🟡

[← action 一覧](./README.md)

> 種別: **管理** ／ 実装: `adminReservationsCancel_()`

管理者が任意の予約をキャンセルします。

## 認証

管理トークン。

## payload

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `reservation_id` | string | ✅ | **内部ID(UUID)・予約番号(`R-…`) のどちらでも可** |
| `reason` | string | | キャンセル理由。`cancel_reason` に記録 |

## 戻り値

```json
{ "status": "CANCELED", "canceled_at": "2026-08-01T10:12:00+09:00",
  "already": false, "prev_status": "CONFIRMED", "display_number": "R-2026-08-01-167f" }
```

| フィールド | 説明 |
| --- | --- |
| `already` | **すでに `CANCELED` だった**なら `true`（このとき何も書き換えない） |
| `prev_status` | キャンセル前の status。`COMPLETED` / `NO_SHOW` の判別に使う |

## エラー

| code | 条件 |
| --- | --- |
| `AUTH` / `FORBIDDEN` | 認証・権限 |
| `VALIDATION` | `reservation_id` が空 |
| `NOT_FOUND` | 予約が見つからない |
| `CONFIG` | `cancel_reason` / `canceled_by` 列が無い |

## 書き込まれる値

| 列 | 値 |
| --- | --- |
| `status` | `CANCELED` |
| `canceled_at` / `updated_at` | 実行時刻 |
| `cancel_reason` | payload の `reason`（`note` は触らない） |
| `canceled_by` | `admin:<username>` または `line:<userId>` |

## 設計判断（なぜこうしたか）

| 論点 | 決定 | 理由 |
| --- | --- | --- |
| すでに `CANCELED` | **冪等成功**。`already: true` を返す | 二重クリックや通信リトライで運用が止まる方が実害が大きい |
| `COMPLETED` / `NO_SHOW` からのキャンセル | **許可**。`prev_status` を返す | 受付後の返金対応が現場にあるため。UI 側で強い確認を出す |
| LINE 通知 | **送らない** | 会員のセルフキャンセルと挙動を揃える |
| 理由の保存先 | `cancel_reason` / `canceled_by` | `note` を汚さない |
| `canceled_by` の形式 | `admin:` / `line:` を前置き | どちらの認証経路で実行されたか後から追える |

## 挙動の注意

- **`already: true` のとき、既存の `cancel_reason` は上書きされません**
- 予約番号での照合は**大文字小文字と前後空白を無視**します。内部IDは完全一致です
- 予約番号が万一重複した場合、シートの**先頭行**が対象になります
