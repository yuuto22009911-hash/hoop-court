# `admin.login` 🟡

[← action 一覧](./README.md)

> 種別: **公開**（認証の入口） ／ 実装: `adminLogin_()`

ID とパスワードで管理セッションを発行します。**LINE を使わずに管理画面へ入る**ための経路です。

## 認証

不要（これ自体が認証）。

## payload

| フィールド | 型 | 必須 |
| --- | --- | --- |
| `username` | string | ✅ |
| `password` | string | ✅ |

## 戻り値

```json
{ "token": "…64桁のhex…", "username": "himawari-admin", "expires_in": 21600 }
```

以降の `admin.*` では、この `token` を **`idToken` フィールドに入れて**送ります。

## エラー

| code | 条件 |
| --- | --- |
| `VALIDATION` | `username` または `password` が空 |
| `AUTH` | ID またはパスワードが違う |

## 挙動の注意

- パスワードは `AdminAuth` シートに**ソルト＋反復SHA-256ハッシュ**で保存されています。平文はありません
- **ユーザーが存在しない場合もハッシュ計算を実行**します。
  応答時間の差から「そのIDは存在する」と判別されるのを防ぐためです
- 発行したトークンは `CacheService` に **6時間**保持され、アクセスのたびに延長されます
- **サーバー側にセッション一覧はありません。** パスワードを変えても既存トークンは
  最大6時間有効なままです（強制ログアウトの手段が無い）

## 設定方法

`setAdminLogin()` をエディタから実行します → [05-operations.md](../05-operations.md) §3。
