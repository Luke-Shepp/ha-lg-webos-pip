// Assembles the installable app: app/ + hls.js + config.js.
//   node scripts/build.mjs           -> build/        (optional non-secret .env defaults)
//   node scripts/build.mjs --mock    -> .mock/app/    (points at scripts/mock-ha.mjs)
//
// The HA token must be entered on the TV or explicitly sent from the HA integration.
// Never embed it in an IPK: app files are readable by anyone with access to it.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mock = process.argv.includes('--mock');
const out = join(root, mock ? '.mock/app' : 'build');

function readEnv(file) {
  if (!existsSync(file)) return {};
  const env = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return env;
}

const env = mock
  ? { HA_URL: 'http://localhost:8124', HA_TOKEN: 'mock-token', HA_CAMERA: 'camera.front_door', HA_TIMEOUT: '0' }
  : { ...readEnv(join(root, '.env')), ...process.env };

if (!mock && env.HA_TOKEN) {
  throw new Error('HA_TOKEN cannot be embedded in the TV app; enter it on the TV or use Send connection to TV');
}

// Only values that are actually set, so settings saved on the TV take over.
const config = Object.fromEntries(Object.entries({
  url: (env.HA_URL || '').replace(/\/+$/, ''),
  token: mock ? env.HA_TOKEN : undefined,
  camera: env.HA_CAMERA,
  mode: env.HA_MODE,
  position: env.HA_POSITION,
  size: env.HA_SIZE && Number(env.HA_SIZE),
  timeout: env.HA_TIMEOUT && Number(env.HA_TIMEOUT)
}).filter(([, v]) => v !== undefined && v !== ''));

const appinfo = JSON.parse(readFileSync(join(root, 'app/appinfo.json'), 'utf8'));

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, 'app'), out, { recursive: true });
mkdirSync(join(out, 'lib'), { recursive: true });
cpSync(join(root, 'node_modules/hls.js/dist/hls.min.js'), join(out, 'lib/hls.min.js'));
writeFileSync(join(out, 'config.js'),
  `window.APP_INFO = ${JSON.stringify({ id: appinfo.id, title: appinfo.title, version: appinfo.version })};\n` +
  `window.HA_CONFIG = ${JSON.stringify(config, null, 2)};\n`);

console.log(`built ${out}${mock ? ' (mock)' : ''}`);
