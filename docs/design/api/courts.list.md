# `courts.list` 🟢

[← action 一覧](./README.md)

> 種別: **公開** ／ 実装: `listCourts_()`

コートの一覧を返します。予約画面の初期化で最初に呼ぶ action です。

## 認証

不要。

## payload

なし（`{}` を送る）。

## 戻り値

```json
{
  "courts": [
    {
      "id": "court-half",
      "facility_id": "himawari",
      "name": "バスケコート（ハーフ1面）",
      "court_type": "HALF",
      "sides_max": 1,
      "capacity": 9,
      "is_active": true,
      "created_at": "2026-06-01T00:00:00+09:00"
    }
  ]
}
```

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `id` | string | 以降の action で `court_id` として使う |
| `court_type` | enum | `FULL` / `HALF` / `THREE_X_THREE` |
| `capacity` | number | フリー利用の上限人数（既定 9） |
| `is_active` | boolean | 常に `true`（無効なコートは返さない） |

## エラー

| code | 条件 |
| --- | --- |
| `CONFIG` | `Courts` シートが無い |

## 挙動の注意

- **`is_active` が `false` の行は返しません。** 一覧から消したいコートはこの列を `false` にします
- 現状は1件のみ返ります。クライアントは `courts[0]` を既定として扱っています
