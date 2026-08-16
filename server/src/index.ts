import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { loadConfig, saveConfig } from './config.js';
import { GameEngine } from './game/engine.js';
import type { DoorSide, GameConfig } from './game/types.js';
import { go2rtcRunning, realCameras, restartGo2rtc } from './streaming.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3000);

let config = loadConfig();
const engine = new GameEngine(config);

const app = express();
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } });

function lanAddress(): string {
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }
  return 'localhost';
}

function publicConfig() {
  const streaming = realCameras(config.cameras).map((c) => c.id);
  return {
    nightMinutes: config.nightMinutes,
    go2rtcUrl: config.go2rtcUrl || `http://${lanAddress()}:1984`,
    go2rtcRunning: go2rtcRunning(),
    zones: config.zones,
    cameras: config.cameras.map(({ password, ...cam }) => ({ ...cam, hasPassword: Boolean(password) })),
    streamingCamIds: streaming,
  };
}

app.get('/api/config', (_req, res) => {
  res.json(publicConfig());
});

app.put('/api/config', (req, res) => {
  const incoming = req.body as Partial<GameConfig>;
  const cameras = (incoming.cameras ?? config.cameras).map((cam) => {
    if (!cam.password) {
      const existing = config.cameras.find((c) => c.id === cam.id);
      return { ...cam, password: existing?.password };
    }
    return cam;
  });
  config = {
    ...config,
    ...incoming,
    cameras,
    zones: incoming.zones ?? config.zones,
  };
  saveConfig(config);
  engine.setConfig(config);
  const result = restartGo2rtc(config.cameras);
  io.emit('config', publicConfig());
  res.json({ ...publicConfig(), streaming: result });
});

const webDist = path.resolve(__dirname, '../../web/dist');
app.use(express.static(webDist));
app.get(/^\/(?!api|socket\.io).*/, (_req, res) => {
  res.sendFile(path.join(webDist, 'index.html'), (err) => {
    if (err) res.status(404).send('Frontend non compilé. Lancez `npm run build` ou utilisez `npm run dev`.');
  });
});

engine.on('state', (state) => io.emit('state', state));
engine.on('instruction', (monsterId, instruction) => {
  io.to(`monster:${monsterId}`).emit('instruction', instruction);
});
engine.on('guardEvent', (event) => io.emit('guardEvent', event));

io.on('connection', (socket) => {
  socket.emit('config', publicConfig());
  socket.emit('state', engine.getState());

  socket.on('monster:join', (payload: { monsterId: string; name: string }, ack?: (m: unknown) => void) => {
    const id = payload.monsterId || socket.id;
    void socket.join(`monster:${id}`);
    socket.data.monsterId = id;
    const monster = engine.addMonster(id, (payload.name || 'Monstre').slice(0, 24));
    ack?.(monster);
  });

  socket.on('monster:move', (zoneId: string, ack?: (r: unknown) => void) => {
    const id = socket.data.monsterId as string | undefined;
    if (!id) return ack?.({ ok: false, error: 'Non enregistré.' });
    ack?.(engine.monsterMove(id, zoneId));
  });

  socket.on('monster:attack', (ack?: (r: unknown) => void) => {
    const id = socket.data.monsterId as string | undefined;
    if (!id) return ack?.({ ok: false, error: 'Non enregistré.' });
    ack?.(engine.monsterAttack(id));
  });

  socket.on('guard:watch', (camId: string | null) => engine.guardWatch(camId));
  socket.on('guard:door', (payload: { side: DoorSide; closed: boolean }) =>
    engine.guardDoor(payload.side, payload.closed),
  );
  socket.on('guard:start', (night?: number) => engine.startNight(night));
  socket.on('guard:lobby', () => engine.backToLobby());

  socket.on('disconnect', () => {
    const id = socket.data.monsterId as string | undefined;
    if (id) engine.removeMonster(id);
  });
});

restartGo2rtc(config.cameras);

server.listen(PORT, () => {
  console.log(`FNAF-IRL prêt : http://${lanAddress()}:${PORT} (surveillant : /guard, monstres : /monster, config : /admin)`);
});
