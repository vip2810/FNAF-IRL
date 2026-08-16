import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GameConfig } from './game/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = path.resolve(__dirname, '../../config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'game.json');

export const DEFAULT_CONFIG: GameConfig = {
  nightMinutes: 6,
  go2rtcUrl: '',
  zones: [
    { id: 'scene', name: 'Scène', camId: 'cam1', adjacent: ['salle', 'coulisses'], spawn: true },
    { id: 'coulisses', name: 'Coulisses', camId: 'cam2', adjacent: ['scene', 'couloir_ouest'] },
    { id: 'salle', name: 'Salle à manger', camId: 'cam3', adjacent: ['scene', 'cuisine', 'couloir_est', 'couloir_ouest'] },
    { id: 'cuisine', name: 'Cuisine', camId: 'cam4', adjacent: ['salle', 'couloir_est'] },
    { id: 'couloir_ouest', name: 'Couloir Ouest', camId: 'cam5', adjacent: ['coulisses', 'salle'], officeSide: 'left' },
    { id: 'couloir_est', name: 'Couloir Est', camId: 'cam6', adjacent: ['cuisine', 'salle'], officeSide: 'right' },
  ],
  cameras: [
    { id: 'cam1', name: 'CAM 1 — Scène' },
    { id: 'cam2', name: 'CAM 2 — Coulisses' },
    { id: 'cam3', name: 'CAM 3 — Salle' },
    { id: 'cam4', name: 'CAM 4 — Cuisine' },
    { id: 'cam5', name: 'CAM 5 — Couloir Ouest' },
    { id: 'cam6', name: 'CAM 6 — Couloir Est' },
  ],
};

export function loadConfig(): GameConfig {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<GameConfig>) };
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }
}

export function saveConfig(config: GameConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}
