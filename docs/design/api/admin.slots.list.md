# `admin.slots.list` 🟢

[← action 一覧](./README.md)

> 種別: **管理** ／ 実装: `adminSlotsList_()`

枠ごとの状態を返します。[`availability.range`](./availability.range.md) と違い、
**「予約で埋まっている」と「休業で閉じている」を区別**できます。

## 認証

管理トークン。

## payload

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `court_id` | string | ✅ | |
| `from` | ISO8601 | ✅ | 開始日 |
| `to` | ISO8601 | ✅ | 終了日（**含まない**） |

## 戻り値

```json
{ "slots": [
  { "slot_id": "court-half-2026-08-01T10:00:00+09:00",
    "starts_at": "2026-08-01T10:00:00+09:00",
    "ends_at": "2026-08-01T10:30:00+09:00",
    "state": "BOOKED",
    "free_remaining": 9,
    "reservation_count": 1,
    "reservation_id": "9f2c…",
    "display_number": "R-2026-08-01-167f",
    "group_name": "向日葵クラブ" } ] }
```

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `state` | enum | `OPEN` / `BOOKED` / `CLOSED` / `BLOCKED` |
| `free_remaining` | number | **常に返る。** `9 −（同時間帯の CONFIRMED FREE の人数合計）` |
| `reservation_count` | number | **常に返る。** その枠に重なる CONFIRMED 予約の件数 |
| `reservation_id` / `display_number` / `group_name` | string | **`BOOKED` のときのみ。** 先頭1件 |

## state の優先順位

```
CONFIRMED 予約が重なる？ ──Yes──▶ BOOKED     ← 最優先
        │No
        ▼
Slots の非OPEN 行が重なる？ ─Yes──▶ CLOSED / BLOCKED
        │No
        ▼
                                   OPEN
```

**BOOKED を最優先**にしています。現場が知りたいのは「誰の予約で埋まっているか」だからです。

## エラー

| code | 条件 |
| --- | --- |
| `AUTH` / `FORBIDDEN` | 認証・権限 |
| `VALIDATION` | `court_id` が空 |

## 挙動の注意

- **過去の枠も返します。** 実績を確認するためで、時刻による除外はしません
  （`availability.range` とはここが違います）
- 同じ枠に FREE の予約が複数ある場合、`display_number` / `group_name` は**先頭1件だけ**です。
  他にもあることは `reservation_count` で分かります（週グリッドは狭いため全件は載せない判断）
- `Slots` の非OPEN 行が複数重なる場合は、**シート上の先頭行**を採用します

## 呼び出し元

管理画面 `/admin/calendar` の週グリッド。4色の色分けとツールチップに使っています。
