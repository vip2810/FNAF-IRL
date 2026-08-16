export type Phase = 'lobby' | 'night' | 'guard_win' | 'monsters_win';
export type DoorSide = 'left' | 'right';

export interface ZoneConfig {
  id: string;
  name: string;
  camId: string | null;
  adjacent: string[];
  officeSide?: DoorSide;
  spawn?: boolean;
}

export interface CameraInfo {
  id: string;
  name: string;
  host?: string;
  username?: string;
  stream?: 'stream1' | 'stream2';
  hasPassword?: boolean;
}

export interface PublicConfig {
  nightMinutes: number;
  go2rtcUrl: string;
  go2rtcRunning: boolean;
  zones: ZoneConfig[];
  cameras: CameraInfo[];
  streamingCamIds: string[];
}

export interface Monster {
  id: string;
  name: string;
  zone: string;
  frozen: boolean;
  connected: boolean;
}

export interface GameState {
  phase: Phase;
  night: number;
  elapsedSec: number;
  hour: number;
  power: number;
  blackout: boolean;
  guard: { watching: string | null; doors: Record<DoorSide, boolean> };
  monsters: Monster[];
  winner?: { monsterName?: string };
}

export interface Instruction {
  text: string;
  kind: 'freeze' | 'move' | 'door' | 'attack' | 'blackout' | 'info';
}

export interface GuardEvent {
  kind: 'knock' | 'blackout' | 'jumpscare';
  side?: DoorSide;
  monsterName?: string;
}
