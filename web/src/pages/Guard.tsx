import { useEffect, useState } from 'react';
import CameraView from '../components/CameraView';
import { sfxAlarm, sfxBlip, sfxJumpscare, sfxKnock, unlockAudio } from '../lib/audio';
import { socket, useGame } from '../lib/socket';
import type { DoorSide, GuardEvent } from '../lib/types';

function clockLabel(hour: number): string {
  return hour === 0 ? 'Minuit' : `${hour}h00`;
}

export default function Guard() {
  const { state, config } = useGame();
  const [tabletUp, setTabletUp] = useState(false);
  const [jumpscare, setJumpscare] = useState<GuardEvent | null>(null);

  useEffect(() => {
    const onEvent = (event: GuardEvent) => {
      if (event.kind === 'knock') sfxKnock();
      if (event.kind === 'blackout') sfxAlarm();
      if (event.kind === 'jumpscare') {
        sfxJumpscare();
        setJumpscare(event);
      }
    };
    socket.on('guardEvent', onEvent);
    return () => {
      socket.off('guardEvent', onEvent);
    };
  }, []);

  useEffect(() => {
    if (state?.phase === 'night') setJumpscare(null);
  }, [state?.phase]);

  if (!state || !config) return <div className="page">Connexion…</div>;

  const watching = state.guard.watching;
  const watchedZone = config.zones.find((z) => z.camId === watching);
  const monstersInWatchedZone = watchedZone
    ? state.monsters.filter((m) => m.connected && m.zone === watchedZone.id)
    : [];
  const usage = 1 + (watching ? 1 : 0) + (state.guard.doors.left ? 1 : 0) + (state.guard.doors.right ? 1 : 0);

  const setWatch = (camId: string | null) => {
    sfxBlip();
    socket.emit('guard:watch', camId);
  };

  const toggleTablet = () => {
    unlockAudio();
    sfxBlip();
    const next = !tabletUp;
    setTabletUp(next);
    if (!next) setWatch(null);
    else setWatch(watching ?? config.cameras[0]?.id ?? null);
  };

  const toggleDoor = (side: DoorSide) => {
    unlockAudio();
    sfxBlip();
    socket.emit('guard:door', { side, closed: !state.guard.doors[side] });
  };

  const doorButton = (side: DoorSide, label: string) => (
    <div className={`door ${state.guard.doors[side] ? 'closed' : ''}`}>
      <div>{label}</div>
      <div style={{ fontSize: 34 }}>{state.guard.doors[side] ? '🚪🔒' : '🚪'}</div>
      <button className={state.guard.doors[side] ? 'danger' : ''} onClick={() => toggleDoor(side)} disabled={state.blackout}>
        {state.guard.doors[side] ? 'OUVRIR' : 'FERMER'}
      </button>
    </div>
  );

  return (
    <div className="page">
      <div className="guard-hud panel">
        <span>NUIT {state.night}</span>
        <span>🕛 {clockLabel(state.hour)}</span>
        <span className={state.power < 25 ? 'power-low' : ''}>
          ⚡ {state.power.toFixed(0)} % <small className="muted">(conso {'▮'.repeat(usage)})</small>
        </span>
        <span>👹 {state.monsters.filter((m) => m.connected).length}</span>
      </div>

      {state.phase === 'lobby' && (
        <div className="panel">
          <h2>Prêt à surveiller ?</h2>
          <p className="muted">
            Monstres connectés :{' '}
            {state.monsters.filter((m) => m.connected).map((m) => m.name).join(', ') || 'aucun'}
          </p>
          <div className="row">
            <button
              className="primary"
              onClick={() => {
                unlockAudio();
                socket.emit('guard:start', state.night);
              }}
            >
              ▶ LANCER LA NUIT {state.night}
            </button>
          </div>
        </div>
      )}

      {(state.phase === 'guard_win' || state.phase === 'monsters_win') && !jumpscare && (
        <div className="panel">
          <h2>{state.phase === 'guard_win' ? '6h00 — Tu as survécu !' : `Dévoré par ${state.winner?.monsterName ?? 'un monstre'}…`}</h2>
          <div className="row">
            <button
              className="primary"
              onClick={() => socket.emit('guard:start', state.phase === 'guard_win' ? state.night + 1 : state.night)}
            >
              {state.phase === 'guard_win' ? `▶ NUIT ${state.night + 1}` : '↻ REJOUER LA NUIT'}
            </button>
            <button onClick={() => socket.emit('guard:lobby')}>Retour au lobby</button>
          </div>
        </div>
      )}

      {state.phase === 'night' && (
        <>
          {!tabletUp && (
            <div className="office">
              {doorButton('left', 'PORTE GAUCHE')}
              <div className="office-center">
                <div style={{ fontSize: 46 }}>🪑</div>
                <div className="muted">Ton bureau. Les couloirs Ouest et Est mènent ici.</div>
                <div className="muted">Ferme les portes seulement quand c'est nécessaire : ça vide l'énergie.</div>
              </div>
              {doorButton('right', 'PORTE DROITE')}
            </div>
          )}

          {tabletUp && !state.blackout && (
            <div className="camera-grid">
              <div style={{ position: 'relative' }}>
                {watching ? (
                  <div style={{ position: 'relative' }}>
                    <CameraView camId={watching} config={config} />
                    <span className="rec" style={{ position: 'absolute', top: 8, right: 10, color: 'var(--danger)' }}>
                      ● REC
                    </span>
                    <div className="monster-overlay">
                      {monstersInWatchedZone.map((m) => (
                        <span key={m.id} className="monster-chip">
                          👹 {m.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="camera-feed" />
                )}
              </div>
              <div className="cam-buttons">
                {config.cameras.map((cam) => (
                  <button key={cam.id} className={watching === cam.id ? 'active' : ''} onClick={() => setWatch(cam.id)}>
                    {cam.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="row" style={{ marginTop: 12 }}>
            <button className="primary" onClick={toggleTablet} disabled={state.blackout} style={{ flex: 1, padding: 16 }}>
              {tabletUp ? '📱 BAISSER LA TABLETTE' : '📹 CAMÉRAS'}
            </button>
          </div>
        </>
      )}

      {state.blackout && state.phase === 'night' && (
        <div className="blackout-overlay">
          <div>⚠ BLACKOUT ⚠</div>
          <div style={{ fontSize: 16 }}>Plus d'énergie. Plus de portes. Tiens jusqu'à 6h00…</div>
        </div>
      )}

      {jumpscare && (
        <div className="jumpscare-overlay" onClick={() => setJumpscare(null)}>
          <div className="face">👹</div>
          <div className="name">{jumpscare.monsterName?.toUpperCase() ?? 'UN MONSTRE'} T'A EU !</div>
        </div>
      )}
    </div>
  );
}
