# `admin.reservations.list` 🟢

[← action 一覧](./README.md)

> 種別: **管理** ／ 実装: `adminList_()`

予約を検索・絞り込みして返します。管理画面の予約一覧が使います。

## 認証

管理トークン。

## payload

すべて任意です。指定しなければ全件返ります。

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `status` | string | `CONFIRMED` / `COMPLETED` / `CANCELED` / `NO_SHOW`。**`ALL` または未指定で絞り込まない** |
| `court_id` | string | コートで絞る |
| `from` | ISO8601 | `starts_at >= from` |
| `to` | ISO8601 | `starts_at < to`（**排他**） |
| `q` | string | **団体名 または 予約番号**の部分一致（大文字小文字を無視） |

## 戻り値

```json
{ "reservations": [ { "id": "…", "display_number": "…", … } ] }
```

**開始日時の降順**（新しい順）で並びます。各要素は全26列を整形した `Reservation` です。

## エラー

| code | 条件 |
| --- | --- |
| `AUTH` / `FORBIDDEN` | 認証・権限 |

## 挙動の注意

- **件数の上限がありません。** 予約が増えると全件を読んで返すため、応答が重くなります
- ページングもありません。将来的には `from` / `to` での絞り込みを前提にしてください
- `q` は**部分一致**です。予約番号の一部（`167f` など）でも引けます
