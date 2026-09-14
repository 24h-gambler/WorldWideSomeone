#!/usr/bin/env node
/**
 * Apple 로그인용 client secret(JWT) 생성 — Supabase Auth → Providers → Apple 의 "Secret Key" 칸에 넣는 값.
 * 애플은 이 값을 최대 6개월짜리로만 허용하므로 만료 전에 다시 만들어 교체해야 한다.
 *
 * 사용법:
 *   node scripts/apple-client-secret.mjs \
 *     --team-id ABCDE12345 --key-id XYZ9876543 \
 *     --services-id com.worldwidesomeone.web --p8 ~/Downloads/AuthKey_XYZ9876543.p8
 *
 * 값 찾는 곳(docs/BROWSER-SETUP.md 1절):
 *   team-id     developer.apple.com → Membership details → Team ID
 *   key-id      Certificates, IDs & Profiles → Keys → 만든 키의 Key ID
 *   services-id Identifiers → Services IDs 에서 만든 식별자
 *   p8          키 생성 시 한 번만 내려받는 파일(재다운로드 불가)
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, cur, i, arr) => (cur.startsWith('--') ? [...acc, [cur.slice(2), arr[i + 1]]] : acc), []));
const { 'team-id': teamId, 'key-id': keyId, 'services-id': servicesId, p8 } = args;
if (!teamId || !keyId || !servicesId || !p8) {
  console.error('필수 인자 누락. 사용법은 이 파일 상단 주석 참고.');
  process.exit(1);
}
const key = fs.readFileSync(p8.replace(/^~/, process.env.HOME ?? '~'), 'utf8');
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const exp = now + 60 * 60 * 24 * 180; // 180일 (애플 상한 6개월)
const header = b64({ alg: 'ES256', kid: keyId, typ: 'JWT' });
const payload = b64({ iss: teamId, iat: now, exp, aud: 'https://appleid.apple.com', sub: servicesId });
const signature = crypto.sign('SHA256', Buffer.from(`${header}.${payload}`), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
console.log(`${header}.${payload}.${signature}`);
console.error(`\n만료: ${new Date(exp * 1000).toISOString().slice(0, 10)} — 그 전에 다시 만들어 Supabase 에 교체하세요.`);
