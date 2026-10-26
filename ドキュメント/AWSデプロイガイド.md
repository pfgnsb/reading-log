# AWSデプロイガイド

| 項目 | 内容 |
|---|---|
| 文書名 | AWSデプロイガイド |
| 対象システム | 読書記録 |
| 版 | 1.0 |
| 作成日 | 2026年10月26日 |
| 作成者 | nsb |
| 関連資料 | ドキュメント一覧、要件定義書、用語定義書、技術スタック、データベース設計、API仕様書、操作手順書 |
| 目的 | EC2 1台に FastAPI と SQLite を載せる手順を示す。この版では起動しない |

言葉の意味は「用語定義書」に従います。採用する技術の正は「技術スタック」です。手元の `127.0.0.1:8000` で開く手順は、この資料の対象外です。その開き方は「操作手順書」です。

この資料のデプロイは、東京リージョンの EC2 に、いま動いている形を載せることです。ログインは残します。データベースの製品は SQLite のままです。RDS は作りません。

インスタンスは、まだ作っていません。`terraform apply` は、起動してよいと言われるまで実行しません。

## 1. 何を置くか

言語、フレームワーク、データベース、実行環境は分けます。EC2 と nginx は、プログラムを動かす場所と入口です。

| 層 | 言語 | フレームワークまたは製品 | 実行環境 |
|---|---|---|---|
| フロントエンド | HTML、CSS、JavaScript | なし | ブラウザ。FastAPI が同じプロセスで HTML を返す |
| バックエンド | Python 3.12 | FastAPI | Uvicorn。EC2 の中では `127.0.0.1:8000` |
| 入口 | | nginx | EC2 の 80 番。`/` を Uvicorn へ渡す |
| データベース | SQL | SQLite | EC2 のファイル `/opt/reading-log/reading.db` |
| 土台 | | Terraform | リージョンは `ap-northeast-1`。既定の VPC。定義は `infra/` |

```text
この PC のブラウザ
  └─ http://EC2の公開アドレス/     nginx（80）
        └─ FastAPI（Uvicorn 127.0.0.1:8000）
              ├─ 画面 templates/ と static/
              └─ SQLite ファイル reading.db
```

ログインは、Cookie `session` のままです。nginx は同じホストの 80 番で画面と API を渡すので、ブラウザは別のポートを呼びません。

## 2. 接続を許す範囲

Terraform のセキュリティグループが正です。値の置き場所は `infra/terraform.tfvars` の `allowed_cidr` で、この PC の公開アドレスを `/32` で書きます。このファイルは Git に入れません。`0.0.0.0/0` は使えません。

| ポート | 許可する相手 | 用途 |
|---|---|---|
| 22 | この PC だけ | SSH。ユーザーは `ec2-user` |
| 80 | この PC だけ | nginx。ブラウザの入口 |
| 8000 | この PC だけ | Uvicorn を直接確認するとき |

外へ出る向きは、パッケージの取得と SSM のために開いてあります。外から入る穴は、上の3つだけです。

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

## 5. アプリを載せる

この章も、インスタンスができたあとの手順です。いまは実行しません。

SSH の秘密鍵は `infra/keys/reading-log` です。

```powershell
ssh -i infra\keys\reading-log ec2-user@公開アドレス
```

EC2 の中で、次を実行します。

```bash
sudo dnf install -y python3.12 git nginx
sudo mkdir -p /opt/reading-log
sudo chown ec2-user:ec2-user /opt/reading-log
git clone https://github.com/pfgnsb/reading-log.git /opt/reading-log
cd /opt/reading-log
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

`/etc/systemd/system/reading-log.service` を次の内容にします。

```text
[Unit]
Description=Reading log
After=network-online.target
Wants=network-online.target

[Service]
User=ec2-user
WorkingDirectory=/opt/reading-log
Environment=READING_DB=/opt/reading-log/reading.db
ExecStart=/opt/reading-log/.venv/bin/uvicorn app:app --host 127.0.0.1 --port 8000
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now reading-log
```

nginx は、80 番を Uvicorn へ渡します。`/etc/nginx/conf.d/reading-log.conf` を次の内容にします。

```text
server {
  listen 80;
  server_name _;

  location / {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

```bash
sudo systemctl enable --now nginx
sudo nginx -t && sudo systemctl reload nginx
```

確認は、EC2 の中と、この PC の両方です。

```bash
curl -s http://127.0.0.1:8000/api/health
```

```powershell
curl.exe -s http://公開アドレス/api/health
```

期待する本文は `{"status":"ok"}` です。ログインしていないときの `GET /api/books` は 401 です。登録、ログイン、自分の本だけが見えることは、手元と同じです。パスは「API仕様書」です。

## 6. いまの状態

2026年10月26日の時点で、`infra/` に定義だけがあります。`terraform apply` は実行していません。EC2 は無く、公開アドレスもありません。減り続けるクレジットもありません。

起動するときは、第3章の鍵と `terraform.tfvars` を用意してから、第4章を実行します。
