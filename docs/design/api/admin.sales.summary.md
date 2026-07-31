# `admin.sales.summary` 🟢

[← action 一覧](./README.md)

> 種別: **管理** ／ 実装: `adminSales_()`

売上を集計します。**`payment_status = PAID` の予約のみ**が対象です。

## 認証

管理トークン。

## payload

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `from` | ISO8601 | | `starts_at >= from` |
| `to` | ISO8601 | | `starts_at < to`（**排他**） |

両方とも任意です。省略すると全期間が対象になります。

## 戻り値

```json
{
  "total": 12400,
  "by_court": [ { "court_id": "court-half", "court_name": "バスケコート（ハーフ1面）",
                  "total": 12400, "count": 8 } ],
  "by_day":   [ { "date": "2026-08-01", "total": 3600, "count": 2 } ]
}
```

| フィールド | 説明 |
| --- | --- |
| `total` | 期間内の合計金額 |
| `by_court` | コート別の合計と件数 |
| `by_day` | 日別の合計と件数。**日付の昇順** |

## エラー

| code | 条件 |
| --- | --- |
| `AUTH` / `FORBIDDEN` | 認証・権限 |

## 集計の定義（重要）

| 項目 | 内容 |
| --- | --- |
| 対象 | `payment_status = PAID` の予約 |
| 金額 | `total_amount`（**実際の受領額ではない**） |
| 日付の基準 | **`starts_at`**（利用日）。`paid_at`（入金日）ではない |
| status | **見ていない。** `CANCELED` でも `PAID` なら計上される |

> ⚠ **キャンセル済みでも `payment_status` が `PAID` のままなら売上に残ります。**
> 返金した場合は、スプレッドシートで `payment_status` を戻す運用が必要です
> （`REFUNDED` を扱う仕組みはまだありません）。

## 挙動の注意

- 全予約を読んでから絞り込むため、件数が増えると重くなります
- 税の内訳はありません。金額はすべて税込です
