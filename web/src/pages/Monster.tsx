import { useEffect, useRef, useState } from 'react';
import { sfxAlarm, sfxBlip, speak, unlockAudio, vibrate } from '../lib/audio';
import { socket, useGame } from '../lib/socket';
import type { Instruction, Monster as MonsterType } from '../lib/types';

function monsterId(): string {
  const key = 'fnaf-irl-monster-id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = `m-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

export default function Monster() {
  const { state, config } = useGame();
  const [joined, setJoined] = useState(false);
  const [name, setName] = useState(localStorage.getItem('fnaf-irl-monster-name') ?? '');
  const [log, setLog] = useState<Instruction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const joinedRef = useRef(false);

  useEffect(() => {
    const onInstruction = (instruction: Instruction) => {
      setLog((prev) => [instruction, ...prev].slice(0, 20));
      const urgent = instruction.kind === 'freeze' || instruction.kind === 'blackout' || instruction.kind === 'attack';
      if (instruction.kind === 'freeze') vibrate([200, 80, 200, 80, 400]);
      else if (instruction.kind === 'blackout') {
        sfxAlarm();
        vibrate([400, 100, 400]);
      } else vibrate(150);
      speak(instruction.text, urgent);
    };
    const onReconnect = () => {
      if (joinedRef.current) {
        socket.emit('monster:join', { monsterId: monsterId(), name: localStorage.getItem('fnaf-irl-monster-name') ?? 'Monstre' });
      }
    };
    socket.on('instruction', onInstruction);
    socket.on('connect', onReconnect);
    return () => {
      socket.off('instruction', onInstruction);
      socket.off('connect', onReconnect);
    };
  }, []);

  const join = () => {
    unlockAudio();
    const trimmed = name.trim() || 'Monstre';
    localStorage.setItem('fnaf-irl-monster-name', trimmed);
    socket.emit('monster:join', { monsterId: monsterId(), name: trimmed }, (m: MonsterType) => {
      joinedRef.current = true;
      setJoined(true);
      speak(`Bienvenue ${m.name}. Garde ton téléphone en poche et écoute les instructions.`);
    });
  };

  if (!state || !config) return <div className="page">Connexion…</div>;

  const me = state.monsters.find((m) => m.id === monsterId());

  if (!joined || !me) {
    return (
      <div className="page">
        <h1 className="title-glow">👹 Monstre</h1>
        <div className="panel">
          <p className="muted">
            Mets ton casque Bluetooth, entre ton nom de monstre, puis garde le téléphone en poche :
            les instructions arrivent en audio.
          </p>
          <div className="row">
            <input
              placeholder="Nom du monstre (ex. Freddy)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
            />
            <button className="primary" onClick={join}>
              REJOINDRE
            </button>
          </div>
        </div>
      </div>
    );
  }

  const zone = config.zones.find((z) => z.id === me.zone);
  const adjacent = (zone?.adjacent ?? [])
    .map((id) => config.zones.find((z) => z.id === id))
    .filter((z) => z != null);
  const atOfficeDoor = zone?.officeSide != null;

  const move = (zoneId: string) => {
    sfxBlip();
    setError(null);
    socket.emit('monster:move', zoneId, (r: { ok: boolean; error?: string }) => {
      if (!r.ok && r.error) setError(r.error);
    });
  };

  const attack = () => {
    vibrate(300);
    setError(null);
    socket.emit('monster:attack', (r: { ok: boolean; error?: string }) => {
      if (!r.ok && r.error) setError(r.error);
    });
  };

  const status = state.phase !== 'night' ? 'waiting' : me.frozen ? 'freeze' : 'free';
  const statusText =
    state.phase === 'lobby'
      ? '⌛ EN ATTENTE DE LA NUIT'
      : state.phase === 'guard_win'
        ? '☀️ 6H00 — LE SURVEILLANT A SURVÉCU'
        : state.phase === 'monsters_win'
          ? `🎉 VICTOIRE ${state.winner?.monsterName === me.name ? '— C’EST TOI !' : 'DES MONSTRES'}`
          : me.frozen
            ? '🔴 STOP — CAMÉRA SUR TOI'
            : state.blackout
              ? '⚡ BLACKOUT — FONCE !'
              : '🟢 TU PEUX BOUGER';

  return (
    <div className="page">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>👹 {me.name}</h2>
        <span className="muted">
          Nuit {state.night} — {state.hour}h00
        </span>
      </div>

      <div className={`monster-status ${status}`}>{statusText}</div>

      {state.phase === 'night' && (
        <>
          <div className="panel">
            <h2 style={{ marginTop: 0 }}>📍 {zone?.name ?? me.zone}</h2>
            {atOfficeDoor && (
              <p style={{ color: 'var(--danger)' }}>
                🚪 Tu es à une entrée du bureau. Si tu passes la porte réelle, appuie sur ATTAQUER !
              </p>
            )}
            <p className="muted">Déplace-toi physiquement, puis déclare ta nouvelle zone :</p>
            <div className="zone-buttons">
              {adjacent.map((z) => (
                <button key={z.id} onClick={() => move(z.id)} disabled={me.frozen}>
                  ➜ {z.name}
                </button>
              ))}
            </div>
            {atOfficeDoor && (
              <button className="attack-button" onClick={attack} disabled={me.frozen}>
                💀 JE SUIS ENTRÉ — ATTAQUER !
              </button>
            )}
            {error && <p style={{ color: 'var(--warn)' }}>{error}</p>}
          </div>

          <div className="panel instruction-log">
            {log.map((entry, i) => (
              <div key={i}>• {entry.text}</div>
            ))}
          </div>
        </>
      )}

      {state.phase !== 'night' && (
        <p className="muted">Reste sur cette page : la nuit démarre depuis l'écran du surveillant.</p>
      )}
    </div>
  );
}
