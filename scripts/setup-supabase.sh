#!/usr/bin/env bash
# Supabase 프로젝트 1회 셋업 — 계정 로그인은 본인 브라우저에서(2id.kimdan). 이 스크립트는 로그인 이후 전부 자동.
#   1) https://supabase.com/dashboard 에서 프로젝트 생성 (리전: ap-northeast-2 서울)  2) supabase login  3) ./scripts/setup-supabase.sh <project-ref>
set -euo pipefail
REF="${1:?usage: setup-supabase.sh <project-ref>}"
command -v supabase >/dev/null || { echo "npm i -g supabase 먼저"; exit 1; }
supabase link --project-ref "$REF"
supabase db push                                   # migrations/0001_schema.sql
supabase functions deploy tick-world push-dispatch send-letter catch-letter redirect-letter rescue-letter approve-reply boost-reply set-location register-push track-events purchase-webhook publish-post
echo "REVENUECAT_WEBHOOK_SECRET 를 설정하세요: supabase secrets set REVENUECAT_WEBHOOK_SECRET=..."
URL="https://${REF}.functions.supabase.co"
SR="$(supabase projects api-keys --project-ref "$REF" -o json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const k=JSON.parse(s).find(x=>x.name==="service_role");console.log(k.api_key)})')"
# 스케줄 등록 (pg_cron + pg_net)
supabase db query "select cron.schedule('tick-world', '* * * * *', \$\$select net.http_post(url:='${URL}/tick-world', headers:='{\"Authorization\":\"Bearer ${SR}\"}'::jsonb, body:='{}'::jsonb)\$\$);" || true
supabase db query "select cron.schedule('push-dispatch', '30 seconds', \$\$select net.http_post(url:='${URL}/push-dispatch', headers:='{\"Authorization\":\"Bearer ${SR}\"}'::jsonb, body:='{}'::jsonb)\$\$);" || true
echo "완료. .env 에 EXPO_PUBLIC_SUPABASE_URL=https://${REF}.supabase.co 와 EXPO_PUBLIC_SUPABASE_ANON_KEY 를 넣으세요."
