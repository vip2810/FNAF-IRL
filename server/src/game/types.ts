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

export interface CameraConfig {
  id: string;
  name: string;
  /** IP or hostname of the Tapo camera on the LAN. Empty = mock (simulated) stream. */
  host?: string;
  /** Camera account created in the Tapo app (Advanced Settings > Camera Account). */
  username?: string;
  password?: string;
  /** stream1 = 1080p, stream2 = 360p */
  stream?: 'stream1' | 'stream2';
}

export interface GameConfig {
  nightMinutes: number;
  /** Base URL of the go2rtc API as reachable from browsers, e.g. http://192.168.1.10:1984 */
  go2rtcUrl: string;
  zones: ZoneConfig[];
  cameras: CameraConfig[];
}

export interface Monster {
  id: string;
  name: string;
  zone: string;
  frozen: boolean;
  connected: boolean;
}

export interface GuardState {
  watching: string | null;
}

export interface GameState {
  phase: Phase;
  night: number;
  elapsedSec: number;
  hour: number;
  power: number;
  blackout: boolean;
  guard: GuardState;
  monsters: Monster[];
  winner?: { monsterName?: string };
}

export interface Instruction {
  text: string;
  kind: 'freeze' | 'move' | 'attack' | 'blackout' | 'info';
}
