#!/bin/bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "root で実行してください"
  exit 1
fi

dnf install -y git nginx tar xz

nodearch=x64
if [ "$(uname -m)" = "aarch64" ]; then
  nodearch=arm64
fi

need_node=1
if command -v node >/dev/null 2>&1; then
  major=$(node -p "process.versions.node.split('.')[0]")
  if [ "$major" -ge 22 ]; then
    need_node=0
  fi
fi

if [ "$need_node" -eq 1 ]; then
  tmp=$(mktemp -d)
  curl -fsSL -o "$tmp/SHASUMS256.txt" https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt
  file=$(awk -v arch="$nodearch" '$2 ~ ("linux-" arch ".tar.xz$") { print $2; exit }' "$tmp/SHASUMS256.txt")
  curl -fsSL -o "$tmp/$file" "https://nodejs.org/dist/latest-v22.x/$file"
  (cd "$tmp" && awk -v f="$file" '$2 == f { print }' SHASUMS256.txt | sha256sum -c -)
  tar -xJf "$tmp/$file" -C /usr/local --strip-components=1
  rm -rf "$tmp"
fi

node -v
npm -v

install -d -o ec2-user -g ec2-user /opt/reading-log
if [ ! -d /opt/reading-log/.git ]; then
  sudo -u ec2-user git clone https://github.com/pfgnsb/reading-log.git /opt/reading-log
else
  sudo -u ec2-user git -C /opt/reading-log pull --ff-only
fi

sudo -u ec2-user npm --prefix /opt/reading-log install

cat > /etc/systemd/system/reading-log.service <<'EOF'
[Unit]
Description=Reading log
After=network-online.target
Wants=network-online.target

[Service]
User=ec2-user
WorkingDirectory=/opt/reading-log
Environment=PATH=/usr/local/bin:/usr/bin
Environment=CI=true
Environment=WRANGLER_SEND_METRICS=false
ExecStart=/opt/reading-log/node_modules/.bin/wrangler dev --ip 127.0.0.1 --port 8787 --inspector-ip 127.0.0.1 --show-interactive-dev-session=false --persist-to /opt/reading-log/.wrangler/state
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/nginx/nginx.conf <<'EOF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log;
pid /run/nginx.pid;

events {
  worker_connections 1024;
}

http {
  include /etc/nginx/mime.types;
  default_type application/octet-stream;
  sendfile on;

  server {
    listen 80 default_server;
    server_name _;

    location / {
      proxy_pass http://127.0.0.1:8787;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }
  }
}
EOF

if command -v getenforce >/dev/null 2>&1 && [ "$(getenforce)" = "Enforcing" ]; then
  setsebool -P httpd_can_network_connect 1
fi

systemctl daemon-reload
systemctl enable --now reading-log
nginx -t
systemctl enable --now nginx
systemctl reload nginx

ok=0
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  if curl -fsS http://127.0.0.1:8787/api/health; then
    echo
    ok=1
    break
  fi
  sleep 3
done

if [ "$ok" -ne 1 ]; then
  systemctl status reading-log --no-pager || true
  journalctl -u reading-log -n 80 --no-pager || true
  exit 1
fi

curl -fsS http://127.0.0.1/api/health
echo
