# AWSデプロイガイド

| 項目 | 内容 |
|---|---|
| 文書名 | AWSデプロイガイド |
| 対象システム | 読書記録 |
| 版 | 1.1 |
| 作成日 | 2026年10月26日 |
| 作成者 | nsb |
| 関連資料 | ドキュメント一覧、要件定義書、用語定義書、技術スタック、データベース設計、API仕様書、操作手順書 |
| 目的 | EC2 の定義を残す。この版の Hono と SQLite は、その EC2 には置かない。起動もしない |

言葉の意味は「用語定義書」に従います。採用する技術の正は「技術スタック」です。手元の `127.0.0.1:8787` で開く手順は「操作手順書」です。

インスタンスは、まだ作っていません。`terraform apply` は、起動してよいと言われるまで実行しません。データベースの製品は SQLite のままです。RDS は作りません。SQLite の実行環境は Durable Object のストレージです。

## 1. 何を置くか

言語、フレームワーク、データベース、実行環境は分けます。Cloudflare Workers と Durable Objects は実行環境です。EC2 は、起動したときの土台の定義です。この版の Hono と SQLite は、その EC2 では動きません。

| 層 | 言語 | フレームワークまたは製品 | 実行環境 |
|---|---|---|---|
| フロントエンド | HTML、CSS、JavaScript | なし | ブラウザ。`frontend/index.html` |
| バックエンド | JavaScript | Hono | Cloudflare Workers。手元は `127.0.0.1:8787` |
| データベース | SQL | SQLite | Durable Object のストレージ。`durable-object/reading.js` |
| 土台 | | Terraform | リージョンは `ap-northeast-1`。既定の VPC。定義は `infra/`。インスタンスは未起動 |

```text
この PC のブラウザ
  └─ http://127.0.0.1:8787/     Wrangler
        ├─ frontend/index.html
        └─ backend/worker.js
              └─ durable-object/reading.js の SQLite
```

ログインは、Cookie `session` のままです。画面と API は同じ `127.0.0.1:8787` です。

## 2. 接続を許す範囲

Terraform のセキュリティグループが正です。値の置き場所は `infra/terraform.tfvars` の `allowed_cidr` で、この PC の公開アドレスを `/32` で書きます。このファイルは Git に入れません。`0.0.0.0/0` は使えません。

| ポート | 許可する相手 | 用途 |
|---|---|---|
| 22 | この PC だけ | SSH。ユーザーは `ec2-user` |
| 80 | この PC だけ | この PC からの入口。いまの Hono は、このポートでは動かない |

外へ出る向きは、パッケージの取得と SSM のために開いてあります。外から入る穴は、上の2つだけです。8000 番は、以前の Uvicorn 用だったので、この定義からは外しました。

回線のアドレスが変わったら、`allowed_cidr` を直してから `terraform apply` します。直すまで、ブラウザも SSH も届きません。いまは apply しません。

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

起動してよいと言われるまで、ここから先は実行しません。

`infra` で次を実行します。

```powershell
terraform init
terraform plan
terraform apply
```

できるものは EC2、そのセキュリティグループ、SSH の公開鍵、SSM 用の IAM です。RDS はできません。

終わったら、公開アドレスを見ます。

```powershell
terraform output public_ip
```

公開アドレスは、インスタンスを止めて起動し直すと変わります。

## 5. アプリの置き場所

この版の Hono と SQLite は、EC2 には置きません。手元では Wrangler が `http://127.0.0.1:8787` で動かします。起動確認は `GET /api/health` で、期待する本文は `{"status":"ok"}` です。ログインしていないときの `GET /api/books` は 401 です。パスは「API仕様書」です。

## 6. いまの状態

2026年10月26日の時点で、`infra/` に定義だけがあります。`terraform apply` は実行していません。EC2 は無く、公開アドレスもありません。減り続けるクレジットもありません。Hono と Durable Object の SQLite は、手元の Wrangler の中で動きます。
