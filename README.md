# 読書記録

登録した人が、自分の本だけを残すアプリです。題名、著者、状態、メモを記録します。

## 技術

| 層 | 言語 | フレームワークまたは製品 | 実行環境 |
|---|---|---|---|
| フロントエンド | HTML、CSS、JavaScript | なし | ブラウザ |
| バックエンド | Python | FastAPI | Uvicorn。`127.0.0.1:8000` |
| データベース | SQL | SQLite | ファイル `reading.db` |

## 開き方

Python 3.12 を使います。

```powershell
cd $HOME\OneDrive\Desktop\読書
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

ブラウザで http://127.0.0.1:8000 を開きます。止めるときは `Ctrl+C` です。

## 資料

| 資料 | 内容 |
|---|---|
| [要件定義書](ドキュメント/要件定義書.md) | 何を作るか |
| [技術スタック](ドキュメント/技術スタック.md) | 言語、フレームワーク、データベース |
| [データベース設計](ドキュメント/データベース設計.md) | SQLite の表 |
| [API仕様書](ドキュメント/API仕様書.md) | パス、本体、状態コード |
| [操作手順書](ドキュメント/操作手順書.md) | 起動と画面の手順 |
