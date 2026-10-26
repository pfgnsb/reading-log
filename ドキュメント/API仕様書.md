# API仕様書

| 項目 | 内容 |
|---|---|
| 文書名 | API仕様書 |
| 対象システム | 読書記録 |
| 版 | 1.2 |
| 作成日 | 2026年10月23日 |
| 作成者 | nsb |
| 関連資料 | ドキュメント一覧、要件定義書、用語定義書、機能要件定義書、技術スタック、データベース設計 |
| 目的 | HTTP API のパス、本体、状態コードを定める |

バックエンドの言語は JavaScript、フレームワークは Hono です。実行環境は Cloudflare Workers です。データベースは SQLite で、Durable Object のストレージです。ベース URL は `http://127.0.0.1:8787` です。

画面の HTML は `GET /` です。Workers の静的配信が `frontend/index.html` を返します。この資料の API は、パスが `/api/` で始まるものだけです。`/api/health` 以外は `durable-object/reading.js` が受けます。本体は JSON、文字コードは UTF-8 です。ログイン後の呼び出しは Cookie `session` を送ります。Cookie は HttpOnly、SameSite=Lax、Path=/、有効期限は7日です。

JSON でないとき、項目が足りないとき、値が約束に合わないときは、400 で、本体は `{ "error": "invalid" }` です。

| error | 意味 | 状態コード |
|---|---|---|
| invalid | 名前、パスワード、または本の値が約束に合わない | 400 |
| unauthorized | ログインしていない、または名前とパスワードが一致しない | 401 |
| taken | その名前はすでに使われている | 409 |
| not_found | 自分の本に、その id がない | 404 |

## 1. 一覧

| メソッド | パス | 認証 | 機能 |
|---|---|---|---|
| POST | `/api/register` | 不要 | A-1 登録し、その場でログインする |
| POST | `/api/login` | 不要 | A-2 ログインする |
| POST | `/api/logout` | 任意 | A-3 ログアウトする。Cookie が無くても成功にする |
| GET | `/api/me` | 要 | ログイン中の名前を返す |
| GET | `/api/books` | 要 | 自分の本を新しい順に返す |
| POST | `/api/books` | 要 | 本を1件追加する |
| PUT | `/api/books/{id}` | 要 | 自分の本を1件更新する |
| DELETE | `/api/books/{id}` | 要 | 自分の本を1件削除する |
| GET | `/api/health` | 不要 | プロセスが動いているかを返す |

## 2. POST /api/register

```json
{ "name": "nsb", "password": "readinglog" }
```

成功は 201 です。

```json
{ "name": "nsb" }
```

応答には `Set-Cookie: session=...` が付きます。

| 状態 | 条件 |
|---|---|
| 201 | 登録できた |
| 400 | JSON でない、項目が足りない、または名前かパスワードが約束に合わない |
| 409 | 同じ名前がある |

## 3. POST /api/login

リクエストは登録と同じ形です。成功は 200 で、本体は `{ "name": "nsb" }` です。

| 状態 | 条件 |
|---|---|
| 200 | 一致した |
| 400 | JSON でない、項目が足りない、または名前かパスワードが約束に合わない |
| 401 | 名前が無い、またはパスワードが違う |

## 4. POST /api/logout

成功は 204 で、本体はありません。セッションの行と Cookie を消します。

## 5. GET /api/me

```json
{ "name": "nsb" }
```

ログインしていないときは 401 です。

## 6. GET /api/books

```json
[
  {
    "id": 1,
    "title": "星の王子さま",
    "author": "サン＝テグジュペリ",
    "status": "reading",
    "memo": "3章まで"
  }
]
```

本が無いときは `[]` です。ログインしていないときは 401 です。

## 7. POST /api/books

```json
{
  "title": "星の王子さま",
  "author": "サン＝テグジュペリ",
  "status": "reading",
  "memo": "3章まで"
}
```

`memo` は省けます。省いたときは空文字です。`status` は `want`、`reading`、`done` です。成功は 201 で、作った行を返します。

| 状態 | 条件 |
|---|---|
| 201 | 追加できた |
| 400 | JSON でない、項目が足りない、または題名、著者、状態、メモが約束に合わない |
| 401 | ログインしていない |

## 8. PUT /api/books/{id}

本体は追加と同じ形です。成功は 200 で、更新した行を返します。自分の本でない id は 404 です。

## 9. DELETE /api/books/{id}

成功は 204 で、本体はありません。自分の本でない id は 404 です。

## 10. GET /api/health

ログインは不要です。成功は 200 です。

```json
{ "status": "ok" }
```

本の一覧やアカウント情報は返しません。手元の起動確認に使います。
