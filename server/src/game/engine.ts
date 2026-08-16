import { EventEmitter } from 'node:events';
import type {
  DoorSide,
  GameConfig,
  GameState,
  Instruction,
  Monster,
  ZoneConfig,
} from './types.js';

const BASE_DRAIN = 0.05; // % per second
const CAMERA_DRAIN = 0.14;
const DOOR_DRAIN = 0.2;

export interface EngineEvents {
  state: (state: GameState) => void;
  instruction: (monsterId: string, instruction: Instruction) => void;
  guardEvent: (event: { kind: 'knock' | 'blackout' | 'jumpscare'; side?: DoorSide; monsterName?: string }) => void;
}

export class GameEngine extends EventEmitter {
  private state: GameState;
  private timer: NodeJS.Timeout | null = null;

  constructor(private config: GameConfig) {
    super();
    this.state = this.freshState(1);
  }

  override emit<K extends keyof EngineEvents>(event: K, ...args: Parameters<EngineEvents[K]>): boolean {
    return super.emit(event, ...args);
  }

  override on<K extends keyof EngineEvents>(event: K, listener: EngineEvents[K]): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  setConfig(config: GameConfig): void {
    this.config = config;
  }

  getState(): GameState {
    return this.state;
  }

  private freshState(night: number): GameState {
    return {
      phase: 'lobby',
      night,
      elapsedSec: 0,
      hour: 0,
      power: 100,
      blackout: false,
      guard: { watching: null, doors: { left: false, right: false } },
      monsters: this.state?.monsters.map((m) => ({ ...m, zone: this.spawnZone(), frozen: false })) ?? [],
    };
  }

  private zone(id: string): ZoneConfig | undefined {
    return this.config.zones.find((z) => z.id === id);
  }

  private spawnZone(): string {
    const spawns = this.config.zones.filter((z) => z.spawn);
    const pool = spawns.length > 0 ? spawns : this.config.zones;
    return pool[Math.floor(Math.random() * pool.length)].id;
  }

  private broadcast(): void {
    this.emit('state', this.state);
  }

  private instruct(monsterId: string, instruction: Instruction): void {
    this.emit('instruction', monsterId, instruction);
  }

  private difficulty(): number {
    return 1 + 0.2 * (this.state.night - 1);
  }

  addMonster(id: string, name: string): Monster {
    let monster = this.state.monsters.find((m) => m.id === id);
    if (monster) {
      monster.connected = true;
      monster.name = name || monster.name;
    } else {
      monster = { id, name, zone: this.spawnZone(), frozen: false, connected: true };
      this.state.monsters.push(monster);
    }
    this.refreshFreezes();
    this.broadcast();
    return monster;
  }

  removeMonster(id: string): void {
    const monster = this.state.monsters.find((m) => m.id === id);
    if (!monster) return;
    if (this.state.phase === 'night') {
      monster.connected = false;
    } else {
      this.state.monsters = this.state.monsters.filter((m) => m.id !== id);
    }
    this.broadcast();
  }

  startNight(night?: number): void {
    this.state = this.freshState(night ?? this.state.night);
    this.state.phase = 'night';
    for (const monster of this.state.monsters) {
      const zone = this.zone(monster.zone);
      this.instruct(monster.id, {
        kind: 'info',
        text: `La nuit ${this.state.night} commence. Tu pars de : ${zone?.name ?? monster.zone}. Rejoins cette zone maintenant, puis avance vers le bureau sans te faire voir.`,
      });
    }
    this.timer = setInterval(() => this.tick(), 1000);
    this.broadcast();
  }

  stopNight(phase: GameState['phase'], winnerName?: string): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.state.phase = phase;
    if (winnerName) this.state.winner = { monsterName: winnerName };
    for (const monster of this.state.monsters) {
      monster.frozen = false;
      const text =
        phase === 'monsters_win'
          ? 'Victoire des monstres ! Revenez au bureau.'
          : phase === 'guard_win'
            ? 'Il est 6 heures. Le surveillant a survécu. Revenez au bureau.'
            : 'Partie arrêtée.';
      this.instruct(monster.id, { kind: 'info', text });
    }
    this.broadcast();
  }

  backToLobby(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.state = this.freshState(this.state.night);
    this.broadcast();
  }

  private tick(): void {
    if (this.state.phase !== 'night') return;
    this.state.elapsedSec += 1;
    const secondsPerHour = (this.config.nightMinutes * 60) / 6;
    this.state.hour = Math.min(6, Math.floor(this.state.elapsedSec / secondsPerHour));

    if (this.state.hour >= 6) {
      this.stopNight('guard_win');
      return;
    }

    if (!this.state.blackout) {
      let drain = BASE_DRAIN;
      if (this.state.guard.watching) drain += CAMERA_DRAIN;
      if (this.state.guard.doors.left) drain += DOOR_DRAIN;
      if (this.state.guard.doors.right) drain += DOOR_DRAIN;
      this.state.power = Math.max(0, this.state.power - drain * this.difficulty());
      if (this.state.power === 0) this.triggerBlackout();
    }

    this.broadcast();
  }

  private triggerBlackout(): void {
    this.state.blackout = true;
    this.state.guard.watching = null;
    this.state.guard.doors = { left: false, right: false };
    this.refreshFreezes();
    this.emit('guardEvent', { kind: 'blackout' });
    for (const monster of this.state.monsters) {
      this.instruct(monster.id, {
        kind: 'blackout',
        text: 'BLACKOUT ! Plus de caméras, plus de portes. Foncez sur le bureau !',
      });
    }
  }

  guardWatch(camId: string | null): void {
    if (this.state.phase !== 'night' || this.state.blackout) return;
    this.state.guard.watching = camId;
    this.refreshFreezes();
    this.broadcast();
  }

  guardDoor(side: DoorSide, closed: boolean): void {
    if (this.state.phase !== 'night' || this.state.blackout) return;
    this.state.guard.doors[side] = closed;
    for (const monster of this.state.monsters) {
      const zone = this.zone(monster.zone);
      if (zone?.officeSide === side) {
        this.instruct(monster.id, {
          kind: 'door',
          text: closed
            ? 'La porte devant toi vient de se fermer. Attends ou change de couloir.'
            : 'La porte devant toi est ouverte. Tu peux attaquer !',
        });
      }
    }
    this.broadcast();
  }

  private refreshFreezes(): void {
    for (const monster of this.state.monsters) {
      const zone = this.zone(monster.zone);
      const shouldFreeze =
        this.state.phase === 'night' &&
        !this.state.blackout &&
        zone?.camId != null &&
        zone.camId === this.state.guard.watching;
      if (shouldFreeze && !monster.frozen) {
        monster.frozen = true;
        this.instruct(monster.id, { kind: 'freeze', text: 'STOP ! La caméra te regarde. Ne bouge plus !' });
      } else if (!shouldFreeze && monster.frozen) {
        monster.frozen = false;
        this.instruct(monster.id, { kind: 'move', text: 'Caméra baissée. Tu peux bouger.' });
      }
    }
  }

  monsterMove(monsterId: string, targetZoneId: string): { ok: boolean; error?: string } {
    if (this.state.phase !== 'night') return { ok: false, error: 'La nuit n’a pas commencé.' };
    const monster = this.state.monsters.find((m) => m.id === monsterId);
    if (!monster) return { ok: false, error: 'Monstre inconnu.' };
    if (monster.frozen) {
      this.instruct(monsterId, { kind: 'freeze', text: 'Interdit ! La caméra te regarde encore. Ne bouge pas.' });
      return { ok: false, error: 'Caméra sur toi.' };
    }
    const current = this.zone(monster.zone);
    if (!current || !current.adjacent.includes(targetZoneId)) {
      return { ok: false, error: 'Zone non adjacente.' };
    }
    const target = this.zone(targetZoneId);
    if (!target) return { ok: false, error: 'Zone inconnue.' };
    monster.zone = targetZoneId;
    this.refreshFreezes();
    if (!monster.frozen) {
      const attackHint = target.officeSide
        ? this.state.guard.doors[target.officeSide]
          ? ' La porte est fermée.'
          : ' La porte est OUVERTE : tu peux attaquer !'
        : '';
      this.instruct(monsterId, { kind: 'move', text: `Tu es maintenant : ${target.name}.${attackHint}` });
    }
    this.broadcast();
    return { ok: true };
  }

  monsterAttack(monsterId: string): { ok: boolean; error?: string } {
    if (this.state.phase !== 'night') return { ok: false, error: 'La nuit n’a pas commencé.' };
    const monster = this.state.monsters.find((m) => m.id === monsterId);
    if (!monster) return { ok: false, error: 'Monstre inconnu.' };
    if (monster.frozen) {
      this.instruct(monsterId, { kind: 'freeze', text: 'Impossible d’attaquer : la caméra te regarde.' });
      return { ok: false, error: 'Caméra sur toi.' };
    }
    const zone = this.zone(monster.zone);
    if (!zone?.officeSide) return { ok: false, error: 'Tu n’es pas à une entrée du bureau.' };
    if (this.state.guard.doors[zone.officeSide]) {
      this.emit('guardEvent', { kind: 'knock', side: zone.officeSide });
      this.instruct(monsterId, { kind: 'door', text: 'BOUM ! La porte est fermée. Le surveillant t’a entendu…' });
      return { ok: false, error: 'Porte fermée.' };
    }
    this.emit('guardEvent', { kind: 'jumpscare', side: zone.officeSide, monsterName: monster.name });
    this.instruct(monsterId, { kind: 'attack', text: 'ATTAQUE ! Fonce dans le bureau et fais ton cri !' });
    this.stopNight('monsters_win', monster.name);
    return { ok: true };
  }
}
