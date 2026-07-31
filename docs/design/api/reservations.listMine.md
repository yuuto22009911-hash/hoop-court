# `reservations.listMine` 🟢

[← action 一覧](./README.md)

> 種別: **会員** ／ 実装: `reservationsListMine_()`

ログイン中の会員の予約を、**開始日時の降順**で返します。

## 認証

LINE IDトークン（必須）。

## payload

なし。

## 戻り値

```json
{ "reservations": [ { "id": "…", "display_number": "R-…", "status": "CONFIRMED", … } ] }
```

各要素は `Reservation` オブジェクト（全26列を整形したもの）です。
フィールドの一覧は [02-data-model.md](../02-data-model.md) §3。

## エラー

| code | 条件 |
| --- | --- |
| `AUTH` | IDトークン不正 |

## 挙動の注意

- **未登録の場合はエラーにせず空配列**を返します
- `Users.id` との**完全一致**で絞り込みます。
  そのため `user_id = "WALK_IN"` のカウンター受付予約は**混入しません**
- status での絞り込みはしません。キャンセル済みも含めて返ります
