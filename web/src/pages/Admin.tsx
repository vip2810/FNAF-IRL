import { useEffect, useState } from 'react';
import type { CameraInfo, PublicConfig, ZoneConfig } from '../lib/types';

interface EditableCamera extends CameraInfo {
  password?: string;
}

export default function Admin() {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [cameras, setCameras] = useState<EditableCamera[]>([]);
  const [nightMinutes, setNightMinutes] = useState(6);
  const [go2rtcUrl, setGo2rtcUrl] = useState('');
  const [zonesJson, setZonesJson] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/config')
      .then((r) => r.json())
      .then((c: PublicConfig) => {
        setConfig(c);
        setCameras(c.cameras);
        setNightMinutes(c.nightMinutes);
        setGo2rtcUrl(c.go2rtcUrl);
        setZonesJson(JSON.stringify(c.zones, null, 2));
      });
  }, []);

  if (!config) return <div className="page">Chargement…</div>;

  const updateCamera = (index: number, patch: Partial<EditableCamera>) => {
    setCameras((prev) => prev.map((cam, i) => (i === index ? { ...cam, ...patch } : cam)));
  };

  const save = async () => {
    setMessage(null);
    let zones: ZoneConfig[];
    try {
      zones = JSON.parse(zonesJson) as ZoneConfig[];
    } catch {
      setMessage('JSON des zones invalide.');
      return;
    }
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nightMinutes, go2rtcUrl, zones, cameras }),
    });
    const body = (await res.json()) as PublicConfig & { streaming?: { running: boolean; reason?: string } };
    setConfig(body);
    setCameras(body.cameras);
    setMessage(
      body.streaming?.running
        ? 'Enregistré — go2rtc relancé avec les caméras réelles.'
        : `Enregistré. ${body.streaming?.reason ?? ''}`,
    );
  };

  return (
    <div className="page">
      <h1 className="title-glow">⚙️ Configuration</h1>

      <div className="panel">
        <h2>Partie</h2>
        <div className="row">
          <label className="field">
            Durée de la nuit (minutes)
            <input
              type="number"
              min={1}
              max={30}
              value={nightMinutes}
              onChange={(e) => setNightMinutes(Number(e.target.value))}
            />
          </label>
          <label className="field">
            URL go2rtc vue des navigateurs (vide = auto)
            <input
              placeholder="http://192.168.1.10:1984"
              value={go2rtcUrl}
              onChange={(e) => setGo2rtcUrl(e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="panel">
        <h2>Caméras Tapo C210</h2>
        <p className="muted">
          Dans l'app Tapo : Paramètres de l'appareil → Paramètres avancés → Compte caméra. Utilisez
          ce compte (pas le compte TP-Link). Laissez l'IP vide pour un flux simulé (mode démo).
        </p>
        {cameras.map((cam, i) => (
          <div className="row" key={cam.id} style={{ marginBottom: 10 }}>
            <label className="field">
              Nom
              <input value={cam.name} onChange={(e) => updateCamera(i, { name: e.target.value })} />
            </label>
            <label className="field">
              IP de la caméra
              <input
                placeholder="192.168.1.50"
                value={cam.host ?? ''}
                onChange={(e) => updateCamera(i, { host: e.target.value })}
              />
            </label>
            <label className="field">
              Compte caméra
              <input
                placeholder="utilisateur"
                value={cam.username ?? ''}
                onChange={(e) => updateCamera(i, { username: e.target.value })}
              />
            </label>
            <label className="field">
              Mot de passe {cam.hasPassword ? '(enregistré — laisser vide pour garder)' : ''}
              <input
                type="password"
                value={cam.password ?? ''}
                onChange={(e) => updateCamera(i, { password: e.target.value })}
              />
            </label>
            <label className="field">
              Qualité
              <select
                value={cam.stream ?? 'stream1'}
                onChange={(e) => updateCamera(i, { stream: e.target.value as 'stream1' | 'stream2' })}
              >
                <option value="stream1">1080p (stream1)</option>
                <option value="stream2">360p (stream2)</option>
              </select>
            </label>
          </div>
        ))}
        <p className="muted">
          go2rtc : {config.go2rtcRunning ? '🟢 en cours' : '⚪ arrêté (mode démo ou binaire manquant)'} — flux
          réels : {config.streamingCamIds.length ? config.streamingCamIds.join(', ') : 'aucun'}
        </p>
      </div>

      <div className="panel">
        <h2>Zones (plan du bâtiment)</h2>
        <p className="muted">
          Graphe des zones : <code>camId</code> relie une zone à sa caméra, <code>adjacent</code>{' '}
          liste les zones accessibles à pied, <code>officeSide</code> (left/right) marque les deux
          entrées du bureau, <code>spawn</code> les points de départ des monstres.
        </p>
        <textarea
          rows={16}
          style={{ width: '100%' }}
          value={zonesJson}
          onChange={(e) => setZonesJson(e.target.value)}
        />
      </div>

      <div className="row">
        <button className="primary" onClick={() => void save()}>
          💾 ENREGISTRER
        </button>
        {message && <span className="muted">{message}</span>}
      </div>
    </div>
  );
}
