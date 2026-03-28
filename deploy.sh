#!/usr/bin/env bash
# =============================================================================
# Ageno 一键部署（在本地 Mac/Linux 执行，通过 SSH 同步代码并在服务器构建/启动）
#
# 使用前请配置：
#   1) SSH 公钥登录（ssh-copy-id），勿将服务器密码写入任何文件或仓库
#   2) 环境变量（可 export 或写在调用前）：
#        DEPLOY_LETSENCRYPT_EMAIL=你的邮箱   # Let's Encrypt 必填
#      可选：
#        DEPLOY_SERVER_IP=43.133.72.98
#        DEPLOY_SSH_USER=root                # 腾讯云 Ubuntu 常见为 ubuntu，请按实际修改
#        DEPLOY_REMOTE_DIR=/opt/ageno
#   3) 服务器上 ${DEPLOY_REMOTE_DIR}/.env.local 需已存在（含生产环境变量），
#      或首次部署后手动 scp 上传，再执行: ssh ... 'cd /opt/ageno && docker compose up -d'
#
# 用法：chmod +x deploy.sh && DEPLOY_LETSENCRYPT_EMAIL=you@example.com ./deploy.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

SERVER_IP="${DEPLOY_SERVER_IP:-43.133.72.98}"
SSH_USER="${DEPLOY_SSH_USER:-root}"
REMOTE_DIR="${DEPLOY_REMOTE_DIR:-/opt/ageno}"
DOMAIN="${DEPLOY_DOMAIN:-ageno.cn}"
LE_EMAIL="${DEPLOY_LETSENCRYPT_EMAIL:-}"

if [[ -z "$LE_EMAIL" ]]; then
  echo "错误：请设置 DEPLOY_LETSENCRYPT_EMAIL（Let's Encrypt 通知邮箱）" >&2
  exit 1
fi

if [[ ! -f "$SCRIPT_DIR/package.json" ]]; then
  echo "错误：请在包含 package.json 的目录运行（当前: $SCRIPT_DIR）" >&2
  exit 1
fi

SSH_TARGET="${SSH_USER}@${SERVER_IP}"
SSH=(ssh -o StrictHostKeyChecking=accept-new "$SSH_TARGET")
RSYNC=(rsync -avz --delete
  -e "ssh -o StrictHostKeyChecking=accept-new"
  --exclude node_modules
  --exclude .next
  --exclude .git
  --exclude .env.local
  --exclude '*.log'
)

echo ">>> 同步代码到 ${SSH_TARGET}:${REMOTE_DIR}/"
"${RSYNC[@]}" ./ "${SSH_TARGET}:${REMOTE_DIR}/"

echo ">>> 远程：安装 Nginx / Certbot（若已安装会跳过）、Docker 编排、证书与站点配置"
"${SSH[@]}" bash -s <<REMOTE_SCRIPT
set -euo pipefail
REMOTE_DIR='${REMOTE_DIR}'
DOMAIN='${DOMAIN}'
LE_EMAIL='${LE_EMAIL}'

if [[ "\${EUID:-0}" -ne 0 ]] && command -v sudo >/dev/null; then
  SUDO=(sudo -E)
else
  SUDO=()
fi

export DEBIAN_FRONTEND=noninteractive
"\${SUDO[@]}" apt-get update -qq
"\${SUDO[@]}" apt-get install -y -qq nginx certbot python3-certbot-nginx rsync

mkdir -p "\$REMOTE_DIR"
cd "\$REMOTE_DIR"

if [[ ! -f .env.local ]]; then
  echo "错误：\$REMOTE_DIR/.env.local 不存在。docker compose 会因 env_file 失败。" >&2
  echo "请先执行: scp .env.local ${SSH_USER}@${SERVER_IP}:\$REMOTE_DIR/" >&2
  exit 1
fi

echo ">>> 构建并启动容器（docker compose）"
docker compose build --no-cache
docker compose up -d

echo ">>> 配置 Nginx 站点 ageno"
"\${SUDO[@]}" install -d /etc/nginx/sites-available /etc/nginx/sites-enabled
"\${SUDO[@]}" cp "\$REMOTE_DIR/nginx.init.conf" /etc/nginx/sites-available/ageno
"\${SUDO[@]}" ln -sf /etc/nginx/sites-available/ageno /etc/nginx/sites-enabled/ageno
if "\${SUDO[@]}" test -f /etc/nginx/sites-enabled/default 2>/dev/null; then
  "\${SUDO[@]}" rm -f /etc/nginx/sites-enabled/default
fi
"\${SUDO[@]}" nginx -t
"\${SUDO[@]}" systemctl reload nginx

CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
if [[ ! -f "\$CERT" ]]; then
  echo ">>> 申请 SSL 证书（Certbot nginx 插件；请确保 ${DOMAIN} 与 www.${DOMAIN} 已解析到本机公网 IP）"
  "\${SUDO[@]}" certbot --nginx -d "${DOMAIN}" -d "www.${DOMAIN}" \\
    --non-interactive --agree-tos -m "\$LE_EMAIL" --redirect
else
  echo ">>> 证书已存在，跳过 certbot 申请"
fi

echo ">>> 启用 HTTPS 完整配置（80 跳转 + 443 反代）"
"\${SUDO[@]}" cp "\$REMOTE_DIR/nginx.conf" /etc/nginx/sites-available/ageno
"\${SUDO[@]}" nginx -t
"\${SUDO[@]}" systemctl reload nginx

"\${SUDO[@]}" systemctl enable nginx 2>/dev/null || true
"\${SUDO[@]}" systemctl enable docker 2>/dev/null || true
echo ">>> 部署完成。请访问 https://${DOMAIN}"
REMOTE_SCRIPT

echo ">>> 全部步骤已在服务器执行完毕。"
