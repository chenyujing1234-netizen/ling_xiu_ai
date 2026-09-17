#!/usr/bin/env bash
# 把 MySQL 里的数据导出到本机 backup/，并只保留最近 30 份。
#
#   bash scripts/mysql-backup.sh
#
# 数据库在另一台机器上，这份导出就是本机唯一的副本，建议挂到 crontab：
#   0 3 * * * cd /home/chenyj/ling_xiu_ai && bash scripts/mysql-backup.sh >> data/backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."

# 连接配置从 .env.local 取，避免密码写死在脚本里
set -a
# shellcheck disable=SC1091
source <(grep -E '^MYSQL_' .env.local)
set +a

OUT_DIR=backup
mkdir -p "$OUT_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
FILE="$OUT_DIR/ling_xiu_ai-$STAMP.sql.gz"

# --single-transaction：导出期间不锁表，线上照常用
# --no-tablespaces：普通账号没有 PROCESS 权限，不加会被拒
MYSQL_PWD="$MYSQL_PASSWORD" mysqldump \
  -h "$MYSQL_HOST" -P "${MYSQL_PORT:-3306}" -u "$MYSQL_USER" \
  --single-transaction --no-tablespaces --default-character-set=utf8mb4 \
  --routines --events --triggers \
  "$MYSQL_DATABASE" | gzip -9 > "$FILE"

SIZE=$(du -h "$FILE" | cut -f1)

# 导出文件里必须真的有建表语句，否则可能是空转
if ! zgrep -q 'CREATE TABLE' "$FILE"; then
  echo "× 备份内容异常（没有建表语句），已保留 $FILE 供检查"
  exit 1
fi
VERSES=$(zgrep -c "INSERT INTO \`bible_verses\`" "$FILE" || true)

echo "√ $(date '+%F %T') 备份完成 $FILE（$SIZE，经文 INSERT 批次 $VERSES）"

# 只留最近 30 份
ls -1t "$OUT_DIR"/ling_xiu_ai-*.sql.gz | tail -n +31 | while read -r old; do
  rm -f "$old"
  echo "  已清理旧备份 $old"
done
