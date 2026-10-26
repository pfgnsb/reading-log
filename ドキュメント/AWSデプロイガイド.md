# AWSデプロイガイド

| 項目 | 内容 |
|---|---|
| 文書名 | AWSデプロイガイド |
| 対象システム | 読書記録 |
| 版 | 1.4 |
| 作成日 | 2026年10月26日 |
| 作成者 | nsb |
| 関連資料 | ドキュメント一覧、要件定義書、用語定義書、技術スタック、データベース設計、API仕様書、操作手順書 |
| 目的 | EC2 に、いまの Hono と SQLite を載せる手順と結果を残す |

言葉の意味は「用語定義書」に従います。採用する技術の正は「技術スタック」です。手元の `127.0.0.1:8787` で開く手順は「操作手順書」です。

2026年10月26日に `terraform apply` を実行し、EC2 を1台起動しました。本のデータベース製品は SQLite のままです。SQLite の実行環境は Durable Object のストレージです。確認用の RDS は PostgreSQL で、5432 は EC2 からだけ入れます。公開アドレスは Git に書きません。`infra` で `terraform output public_ip` を実行して見ます。

## 1. 何を置くか

言語、フレームワーク、データベース、実行環境は分けます。バックエンドの言語は JavaScript、フレームワークは Hono です。データベースの製品は SQLite です。EC2 の中では、Wrangler が Workers と Durable Object を動かします。nginx は 80 番の入口です。

| 層 | 言語 | フレームワークまたは製品 | 実行環境 |
|---|---|---|---|
| フロントエンド | HTML、CSS、JavaScript | なし | ブラウザ。`frontend/index.html` |
| バックエンド | JavaScript | Hono | EC2 の中の Wrangler。`127.0.0.1:8787` |
| 入口 | | nginx | EC2 の 80 番。この PC だけ |
| データベース | SQL | SQLite | Durable Object のストレージ。`durable-object/reading.js` |
| 土台 | | Terraform | リージョンは `ap-northeast-1`。既定の VPC。定義は `infra/`。2026年10月26日に起動した |

```text
この PC のブラウザ
  └─ http://EC2の公開アドレス/     nginx（80）
        └─ Wrangler（127.0.0.1:8787）
              ├─ frontend/index.html
              └─ durable-object/reading.js の SQLite
```

ログインは、Cookie `session` のままです。画面と API は、同じ公開アドレスの 80 番です。

## 2. 接続を許す範囲

Terraform のセキュリティグループが正です。値の置き場所は `infra/terraform.tfvars` の `allowed_cidr` で、この PC の公開アドレスを `/32` で書きます。このファイルは Git に入れません。`0.0.0.0/0` は使えません。

| ポート | 許可する相手 | 用途 |
|---|---|---|
| 22 | この PC だけ | SSH。ユーザーは `ec2-user` |
| 80 | この PC だけ | nginx。画面と API の入口 |

外へ出る向きは、パッケージの取得と SSM のために開いてあります。外から入る穴は、上の2つだけです。8000 番は、以前の Uvicorn 用だったので、この定義からは外しました。

回線のアドレスが変わったら、`allowed_cidr` を直してから `terraform apply` します。直すまで、SSH も 80 番も届きません。

## 3. 事前に要るもの

| もの | 置き場所 | Git |
|---|---|---|
| AWS CLI の認証 | この PC。リージョンは `ap-northeast-1` | 入れない |
| Terraform | `infra/` | 定義は入れる。状態ファイルは入れない |
| SSH の秘密鍵 | `infra/keys/reading-log` | 入れない |
| この PC のアドレス | `infra/terraform.tfvars` の `allowed_cidr` | 入れない |

鍵が無いときは、リポジトリのフォルダで次を実行します。このコマンドは AWS を起動しません。

```powershell
New-Item -ItemType Directory -Force infra\keys | Out-Null
ssh-keygen -t ed25519 -f infra\keys\reading-log -N ""
```

`infra/terraform.tfvars` の例は `infra/terraform.tfvars.example` です。アドレスの実値はここに書きません。

```text
allowed_cidr = "このPCの公開アドレス/32"
```

## 4. 起動するとき

2026年10月26日に、ここを実行して EC2 を起動しました。作り直すときは、同じコマンドを使います。

`infra` で次を実行します。

```powershell
terraform init
terraform plan
terraform apply
```

できるものは EC2、そのセキュリティグループ、SSH の公開鍵、SSM 用の IAM、それに EC2 からだけ入れる RDS です。

終わったら、公開アドレスを見ます。

```powershell
terraform output public_ip
```

公開アドレスは、インスタンスを止めて起動し直すと変わります。

## 5. アプリを載せる

2026年10月26日に、`infra/ec2/setup.sh` を EC2 の中で実行し、アプリを載せました。スクリプトは Node.js 22、git、nginx を入れ、公開リポジトリを `/opt/reading-log` に取り、Wrangler を systemd で動かします。nginx は 80 番を `127.0.0.1:8787` へ渡します。

作り直すときは、EC2 の中で root として `infra/ec2/setup.sh` を実行します。RDS のパスワードは `infra/terraform.tfvars` にあり、Git には入れません。

この PC のブラウザでは、`http://` のあとに公開アドレスを付けて開きます。公開アドレスは `terraform output public_ip` です。

起動確認は `GET /api/health` です。期待する本文は `{"status":"ok"}` です。ログインしていないときの `GET /api/books` は 401 です。パスは「API仕様書」です。

手元だけで見るときは、これまでどおり `npx wrangler dev` と `http://127.0.0.1:8787` です。手順は「操作手順書」です。

## 6. いまの状態

2026年10月26日に、東京リージョンの既定 VPC へ EC2 を1台起動し、同じ日にアプリを載せました。型は t4g.small、名前は `reading-log` です。入ってくる接続は、この PC の 22 番と 80 番だけです。状態ファイルは `infra/terraform.tfstate` で、Git には入っていません。Hono は EC2 の中の Wrangler で動き、本の SQLite は Durable Object のストレージです。確認用の RDS は `publicly_accessible = false` で、5432 は EC2 のセキュリティグループからだけです。ホスト名は `terraform output db_endpoint` です。
