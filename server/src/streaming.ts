import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';
import type { CameraConfig } from './game/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GO2RTC_DIR = path.resolve(__dirname, '../../config');
const GO2RTC_CONFIG = path.join(GO2RTC_DIR, 'go2rtc.yaml');
const BIN_DIR = path.resolve(__dirname, '../bin');
const BIN_NAME = process.platform === 'win32' ? 'go2rtc.exe' : 'go2rtc';

let go2rtcProcess: ChildProcess | null = null;

export function realCameras(cameras: CameraConfig[]): CameraConfig[] {
  return cameras.filter((c) => c.host && c.username && c.password);
}

function findGo2rtcBinary(): string | null {
  const local = path.join(BIN_DIR, BIN_NAME);
  if (fs.existsSync(local)) return local;
  const pathDirs = (process.env.PATH ?? '').split(path.delimiter);
  for (const dir of pathDirs) {
    const candidate = path.join(dir, BIN_NAME);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function go2rtcAssetName(): string | null {
  const { platform, arch } = process;
  if (platform === 'win32' && arch === 'x64') return 'go2rtc_win64.zip';
  if (platform === 'linux' && arch === 'x64') return 'go2rtc_linux_amd64';
  if (platform === 'linux' && arch === 'arm64') return 'go2rtc_linux_arm64';
  if (platform === 'darwin') return arch === 'arm64' ? 'go2rtc_mac_arm64.zip' : 'go2rtc_mac_amd64.zip';
  return null;
}

/** Find go2rtc, downloading it from GitHub releases into server/bin if missing. */
async function ensureGo2rtcBinary(): Promise<string | null> {
  const existing = findGo2rtcBinary();
  if (existing) return existing;
  const asset = go2rtcAssetName();
  if (!asset) return null;
  const url = `https://github.com/AlexxIT/go2rtc/releases/latest/download/${asset}`;
  try {
    console.log(`Téléchargement de go2rtc (${asset})…`);
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    fs.mkdirSync(BIN_DIR, { recursive: true });
    const target = path.join(BIN_DIR, BIN_NAME);
    if (asset.endsWith('.zip')) {
      const zipPath = path.join(BIN_DIR, asset);
      fs.writeFileSync(zipPath, buf);
      execFileSync('tar', ['-xf', zipPath, '-C', BIN_DIR]);
      fs.rmSync(zipPath);
    } else {
      fs.writeFileSync(target, buf);
    }
    if (process.platform !== 'win32') fs.chmodSync(target, 0o755);
    if (!fs.existsSync(target)) return null;
    console.log(`go2rtc installé : ${target}`);
    return target;
  } catch (err) {
    console.error('Téléchargement de go2rtc échoué :', err);
    return null;
  }
}

export function writeGo2rtcConfig(cameras: CameraConfig[]): void {
  const streams: Record<string, string> = {};
  for (const cam of realCameras(cameras)) {
    const stream = cam.stream ?? 'stream1';
    streams[cam.id] = `rtsp://${encodeURIComponent(cam.username!)}:${encodeURIComponent(cam.password!)}@${cam.host}:554/${stream}`;
  }
  fs.mkdirSync(GO2RTC_DIR, { recursive: true });
  fs.writeFileSync(
    GO2RTC_CONFIG,
    stringify({ api: { listen: ':1984' }, webrtc: { listen: ':8555' }, streams }),
  );
}

/** (Re)start go2rtc with the current camera list. Returns whether it is running. */
export async function restartGo2rtc(cameras: CameraConfig[]): Promise<{ running: boolean; reason?: string }> {
  writeGo2rtcConfig(cameras);
  if (go2rtcProcess) {
    go2rtcProcess.kill();
    go2rtcProcess = null;
  }
  if (realCameras(cameras).length === 0) {
    return { running: false, reason: 'Aucune caméra réelle configurée (mode démo).' };
  }
  const binary = await ensureGo2rtcBinary();
  if (!binary) {
    return {
      running: false,
      reason:
        'go2rtc introuvable et téléchargement automatique échoué. Téléchargez-le depuis https://github.com/AlexxIT/go2rtc/releases et placez-le dans server/bin/ (go2rtc.exe sous Windows).',
    };
  }
  go2rtcProcess = spawn(binary, ['-config', GO2RTC_CONFIG], { stdio: 'inherit' });
  go2rtcProcess.on('exit', () => {
    go2rtcProcess = null;
  });
  return { running: true };
}

export function go2rtcRunning(): boolean {
  return go2rtcProcess !== null;
}

export function stopGo2rtc(): void {
  if (go2rtcProcess) {
    go2rtcProcess.kill();
    go2rtcProcess = null;
  }
}
