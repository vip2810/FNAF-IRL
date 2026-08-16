// npm omet parfois silencieusement les bindings natifs optionnels
// (bug connu : https://github.com/npm/cli/issues/4828).
// Ce script vérifie que le binding de la plateforme courante est présent
// pour chaque paquet natif, et l'installe explicitement s'il manque.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');

function platformSuffix() {
  const { platform, arch } = process;
  if (platform === 'linux') {
    const glibc = process.report?.getReport()?.header?.glibcVersionRuntime;
    return `linux-${arch}-${glibc ? 'gnu' : 'musl'}`;
  }
  if (platform === 'darwin') return `darwin-${arch}`;
  if (platform === 'win32') return `win32-${arch}-msvc`;
  return `${platform}-${arch}`;
}

const suffix = platformSuffix();
const missing = [];

for (const pkg of ['rolldown', 'oxlint']) {
  let manifest;
  try {
    manifest = require(`${pkg}/package.json`);
  } catch {
    continue; // paquet non installé : rien à faire
  }
  const bindings = Object.keys(manifest.optionalDependencies ?? {});
  const wanted = bindings.find((name) => name.endsWith(`binding-${suffix}`));
  if (!wanted) continue;
  const installed = existsSync(path.join(root, 'node_modules', ...wanted.split('/')));
  if (!installed) missing.push(`${wanted}@${manifest.version}`);
}

if (missing.length > 0) {
  console.log(`[ensure-native-bindings] Bindings natifs manquants : ${missing.join(', ')} — installation…`);
  execSync(`npm install --no-save --no-audit --no-fund ${missing.join(' ')}`, {
    cwd: root,
    stdio: 'inherit',
  });
}
