import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';
import type { CameraConfig } from './game/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GO2RTC_DIR = path.resolve(__dirname, '../../config');
const GO2RTC_CONFIG = path.join(GO2RTC_DIR, 'go2rtc.yaml');

let go2rtcProcess: ChildProcess | null = null;

export function realCameras(cameras: CameraConfig[]): CameraConfig[] {
  return cameras.filter((c) => c.host && c.username && c.password);
}

function findGo2rtcBinary(): string | null {
  const local = path.resolve(__dirname, '../../bin/go2rtc');
  if (fs.existsSync(local)) return local;
  const pathDirs = (process.env.PATH ?? '').split(path.delimiter);
  for (const dir of pathDirs) {
    const candidate = path.join(dir, 'go2rtc');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
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
export function restartGo2rtc(cameras: CameraConfig[]): { running: boolean; reason?: string } {
  writeGo2rtcConfig(cameras);
  if (go2rtcProcess) {
    go2rtcProcess.kill();
    go2rtcProcess = null;
  }
  if (realCameras(cameras).length === 0) {
    return { running: false, reason: 'Aucune caméra réelle configurée (mode démo).' };
  }
  const binary = findGo2rtcBinary();
  if (!binary) {
    return {
      running: false,
      reason:
        'Binaire go2rtc introuvable. Téléchargez-le depuis https://github.com/AlexxIT/go2rtc/releases et placez-le dans server/bin/go2rtc (ou dans le PATH).',
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
