/**
 * 크로스 repo 접근 확인 — 3앱 병렬의 관문.
 * CROSS_REPO_TOKEN (또는 GH_TOKEN)으로 각 앱 repo 읽기 가능 여부 + 파일 목록 확인.
 * 토큰 없이 → SKIPPED exit 0. 토큰 값은 절대 출력하지 않는다.
 * 실행: node scripts/cross-repo-check.mjs [--json]
 */
const TOKEN = process.env.CROSS_REPO_TOKEN || process.env.GH_TOKEN || '';
const JSON_MODE = process.argv.includes('--json');
const log = (...a) => { if (!JSON_MODE) console.log(...a); };
const H = { 'User-Agent': 'wws-4h', Accept: 'application/vnd.github+json' };
if (TOKEN) H.Authorization = `Bearer ${TOKEN}`;

import fs from 'node:fs';
const apps = JSON.parse(fs.readFileSync('design.apps.json', 'utf8')).apps;
fs.mkdirSync('reports', { recursive: true });

if (!TOKEN) {
  const out = { at: new Date().toISOString(), status: 'skipped', reason: 'CROSS_REPO_TOKEN 없음' };
  if (JSON_MODE) console.log(JSON.stringify(out, null, 2));
  else console.log('⏭️ cross-repo-check SKIPPED — repo Secrets에 CROSS_REPO_TOKEN 등록 필요 (docs/APPS.md).');
  fs.writeFileSync('reports/cross-repo.json', JSON.stringify(out, null, 2));
  process.exit(0);
}

const results = [];
for (const app of apps) {
  const entry = { id: app.id, repo: app.repo, refs: app.refs, ok: false };
  try {
    const meta = await fetch(`https://api.github.com/repos/${app.repo}`, { headers: H }).then((r) => r.json());
    if (meta.message === 'Not Found' || meta.message === 'Bad credentials') {
      entry.error = meta.message === 'Not Found' ? '404 (private인데 권한 없음 또는 미생성)' : '토큰 무효';
    } else {
      entry.ok = true; entry.branch = meta.default_branch; entry.private = meta.private;
      try {
        const tree = await fetch(`https://api.github.com/repos/${app.repo}/git/trees/${meta.default_branch}?recursive=1`, { headers: H }).then((r) => r.json());
        const files = (tree.tree || []).filter((n) => n.type === 'blob').map((n) => n.path);
        entry.files = files.length;
        entry.top = [...new Set(files.map((p) => p.split('/')[0]))].slice(0, 20);
        const stack = ['package.json', 'pubspec.yaml', 'app.json', 'eas.json', 'build.gradle', 'Podfile'];
        entry.stack = stack.filter((s) => files.includes(s));
      } catch (e) { entry.treeError = String(e.message).slice(0, 100); }
    }
  } catch (e) { entry.error = String(e.message).slice(0, 150); }
  results.push(entry);
  log(`${entry.ok ? '✅' : '❌'} ${app.id} (${app.repo})${entry.ok ? ` — ${entry.files} files · [${(entry.stack || []).join(',')}]` : ` — ${entry.error}`}`);
}
const out = { at: new Date().toISOString(), status: results.every((r) => r.ok) ? 'pass' : 'fail', apps: results };
fs.writeFileSync('reports/cross-repo.json', JSON.stringify(out, null, 2));
if (JSON_MODE) console.log(JSON.stringify(out, null, 2));
else console.log(`\n${results.filter((r) => r.ok).length}/${results.length} 접근 가능`);
process.exit(out.status === 'pass' ? 0 : 1);
