# `admin.slots.bulkUpdate` 🟡（非推奨）

[← action 一覧](./README.md)

> 種別: **管理** ／ 実装: `adminSlotsBulk_()`
> **新規の実装では [`admin.slots.set`](./admin.slots.set.md) を使ってください。**

指定期間の枠設定を `Slots` シートに**追加**します。

## 認証

管理トークン。

## payload

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `court_id` | string | ✅ | |
| `from` | ISO8601 | ✅ | |
| `to` | ISO8601 | ✅ | |
| `status` | enum | ✅ | `OPEN` / `CLOSED` / `BLOCKED` |

## 戻り値

```json
{ "updated": 1 }
```

常に `1` です（追加した行数）。

## エラー

| code | 条件 |
| --- | --- |
| `AUTH` / `FORBIDDEN` | 認証・権限 |
| `VALIDATION` | `status` が `OPEN` / `CLOSED` / `BLOCKED` 以外 |

## ⚠ なぜ非推奨か

- **行を追加するだけで、削除経路がありません。** `status: "OPEN"` を指定しても
  「OPEN の行が1本増える」だけで、既存の `CLOSED` 行は残ります。
  `availability.range` は**非OPEN 行が1つでも重なれば予約不可**にするため、**枠を開け直せません**
- 重複した行がどんどん溜まります

## 互換性のため残しています

既存の管理画面（一括設定フォーム）がまだ使っているため、**削除も改名もしていません**。
置き換えが完了したら削除を検討してください。
