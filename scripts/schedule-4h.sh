#!/usr/bin/env bash
# WWS 4시간 로컬 스케줄러 (cron, mac/Linux)
#   bash scripts/schedule-4h.sh          # 등록
#   bash scripts/schedule-4h.sh remove   # 해제
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
MARK="#WWS-4H"
ENTRY="0 */4 * * * cd \"$REPO\" && node scripts/run-4h.mjs >> reports/cron.log 2>&1 $MARK"
if [ "${1:-}" = "remove" ]; then
  crontab -l 2>/dev/null | grep -v "$MARK" | crontab - || true
  echo "🗑️ WWS 4H cron 해제됨"
  exit 0
fi
mkdir -p "$REPO/reports"
( crontab -l 2>/dev/null | grep -v "$MARK"; echo "$ENTRY" ) | crontab -
echo "✅ WWS 4H cron 등록됨 (4시간 간격)"
crontab -l | grep "$MARK" || true
echo "수동 실행: node scripts/run-4h.mjs"
