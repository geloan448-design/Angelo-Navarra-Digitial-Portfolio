// Validate index.html with the W3C Nu HTML Checker.
//
// - If Java is installed and the optional `vnu-jar` package is present
//   (npm i -D vnu-jar), validation runs fully offline.
// - Otherwise index.html is sent to the public W3C service at
//   https://validator.w3.org/nu/ (requires internet).
//
// Writes reports/html-validation.json. Exits 1 if any errors are found.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const FILES = ['index.html'];
const OUT = path.join(ROOT, 'reports');

function tryLocal(file) {
  let jar;
  try { jar = require('vnu-jar'); } catch { return null; }
  try {
    const out = execFileSync('java', ['-jar', jar, '--format', 'json', '--exit-zero-always', file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return JSON.parse(out || '{"messages":[]}');
  } catch (e) {
    // vnu prints JSON to stderr
    if (e.stderr) { try { return JSON.parse(e.stderr); } catch { /* fall through */ } }
    return null;
  }
}

async function tryRemote(file) {
  const res = await fetch('https://validator.w3.org/nu/?out=json', {
    method: 'POST',
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'User-Agent': 'portfolio-html-validation-script' },
    body: fs.readFileSync(file),
  });
  if (!res.ok) throw new Error(`W3C validator responded with HTTP ${res.status}`);
  return res.json();
}

(async () => {
  let errors = 0;
  const all = {};
  for (const name of FILES) {
    const file = path.join(ROOT, name);
    let result = tryLocal(file);
    let source = 'local vnu.jar';
    if (!result) { result = await tryRemote(file); source = 'validator.w3.org/nu'; }
    all[name] = result;

    const errs = result.messages.filter((m) => m.type === 'error' || m.subType === 'fatal');
    const warns = result.messages.filter((m) => m.type === 'info' && m.subType === 'warning');
    const infos = result.messages.filter((m) => m.type === 'info' && m.subType !== 'warning');
    errors += errs.length;

    console.log(`\nW3C HTML validation — ${name} (via ${source})`);
    console.log(`  ${errs.length} error(s), ${warns.length} warning(s), ${infos.length} info message(s)`);
    for (const m of [...errs, ...warns, ...infos]) {
      const kind = m.type === 'error' ? 'ERROR' : m.subType === 'warning' ? 'WARN ' : 'INFO ';
      console.log(`  ${kind} line ${m.lastLine ?? '?'}: ${m.message}`);
      if (m.extract) console.log(`         ${m.extract.replace(/\s+/g, ' ').trim().slice(0, 110)}`);
    }
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'html-validation.json'), JSON.stringify(all, null, 2));
  console.log(`\n${errors === 0 ? 'PASS' : 'FAIL'} — report saved to reports/html-validation.json\n`);
  process.exit(errors === 0 ? 0 : 1);
})().catch((err) => {
  console.error(`HTML validation could not run: ${err.message}`);
  process.exit(2);
});
