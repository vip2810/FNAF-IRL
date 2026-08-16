# FNAF-IRL — Five Nights at Freddy's en vrai, avec des caméras Tapo C210

Jeu multijoueur en réseau local : un **Surveillant** observe de vraies caméras Tapo C210,
des **Monstres** (joueurs humains, téléphone en poche + casque Bluetooth) se déplacent
physiquement dans le bâtiment et reçoivent des instructions audio en temps réel.

## 1. Vue d'ensemble de l'architecture

```
                        ┌──────────────────────────────┐
   Tapo C210 (RTSP) ───►│  go2rtc (RTSP → WebRTC/MSE)  │───► flux vidéo <1s de latence
   Tapo C210 (RTSP) ───►│  lancé/configuré par le      │     dans le navigateur
   Tapo C210 (RTSP) ───►│  serveur de jeu              │
                        └──────────────────────────────┘
                        ┌──────────────────────────────┐
  Surveillant (PC) ◄───►│  Serveur de jeu              │◄──► Monstres (téléphones)
  vue /guard   WebSocket│  Node.js + Socket.IO         │     vue /monster
                        │  moteur autoritaire :        │     TTS fr-FR + vibration
  Admin (config) ◄─────►│  énergie, temps, zones,      │
  vue /admin            │  freeze, attaques, jumpscare │
                        └──────────────────────────────┘
```

- **Serveur de jeu** : Node.js 20 + TypeScript + Express + Socket.IO. Moteur de jeu
  autoritaire (tick 1 s) : temps de la nuit, énergie, positions des monstres, règles.
  Il génère aussi la config go2rtc et lance le binaire.
- **Streaming caméras** : les Tapo C210 exposent un flux RTSP local
  (`rtsp://user:pass@IP:554/stream1`, compte caméra créé dans l'app Tapo).
  [go2rtc](https://github.com/AlexxIT/go2rtc) convertit le RTSP en WebRTC/MSE pour le
  navigateur avec ~0,5 s de latence. **Mode démo sans caméras** : flux simulés
  (bruit statique généré en canvas) pour tester le gameplay sans matériel.
- **Frontend** : React + Vite + TypeScript, une seule app, 4 routes :
  - `/` — lobby : choisir son rôle, entrer son nom
  - `/guard` — écran du surveillant, style FNAF (bureau, tablette caméras, portes, énergie)
  - `/monster` — écran téléphone du monstre (instructions audio TTS, boutons de zone, ATTAQUE)
  - `/admin` — configuration : caméras (IP + compte), zones, plan du bâtiment, durée de nuit
- Tout tourne sur le **réseau local** (le PC du surveillant peut héberger le serveur).

## 2. Le gameplay — « Red light, green light » horrifique

Une **nuit dure 6 minutes** (minuit → 6h00, 1 min = 1 heure). Le bâtiment est découpé
en **zones** (une caméra Tapo par zone), reliées entre elles par un graphe configurable,
qui convergent vers le **Bureau** du surveillant (2 entrées : gauche/droite).

### Le Surveillant (écran PC)
- Ne voit **qu'une caméra à la fois** (comme dans FNAF : la tablette se lève/baisse).
- Peut « fermer » les **portes** gauche/droite (virtuelles, signalées sur les téléphones).
- **Énergie limitée (100 %)** : la tablette levée et chaque porte fermée consomment.
  À 0 % → **blackout** : plus de caméras, plus de portes, les monstres sont libres…
- Gagne s'il survit jusqu'à 6h00.

### Les Monstres (téléphone + oreillette Bluetooth, téléphone en poche)
- Se déplacent physiquement de zone en zone (déclaration par gros boutons, ou QR codes
  affichés dans les zones — v2).
- **Règle d'or : quand la caméra de leur zone est regardée, l'oreillette dit
  « STOP ! Caméra sur toi ! » → le monstre doit s'immobiliser** (comme les animatroniques
  de FNAF qui ne bougent jamais à l'écran). Le serveur refuse tout déplacement pendant
  l'observation. Quand la tablette se baisse : « Tu peux bouger. »
- Arrivé à une entrée du Bureau : si la porte est **ouverte** → bouton **ATTAQUE** →
  **jumpscare plein écran + hurlement** chez le surveillant → victoire des monstres.
  Si la porte est fermée → il faut attendre, repartir… ou pousser le surveillant à
  vider son énergie.

### Pourquoi c'est addictif
- **Tension asymétrique** : le surveillant gère une ressource qui fond (énergie) avec de
  l'information partielle (une seule caméra) ; les monstres jouent un 1-2-3 soleil
  physique avec une voix dans l'oreille.
- **Bluff et méta** : fermer une porte coûte cher → le surveillant bluffe ; les monstres
  coordonnent des attaques sur deux entrées.
- **Difficulté progressive** : Nuit 1, 2, 3… (drain d'énergie accru, nuit plus longue).
- **Feedback sensoriel** : statique CRT, ambiance sonore, vibrations du téléphone,
  jumpscare final.

## 3. Modèle de données & événements temps réel

```ts
GameState {
  phase: 'lobby' | 'night' | 'guard_win' | 'monsters_win'
  night: number            // difficulté
  clock: { hour: 0..6, elapsedSec }
  power: 0..100            // drain = base + tablette + portes
  guard: { watching: camId | null, doors: { left: bool, right: bool } }
  monsters: { id, name, zone, frozen: bool }[]
  zones: { id, name, camId, adjacentes: zoneId[], officeSide?: 'left'|'right' }[]
}
```

Événements Socket.IO : `guard:watch`, `guard:door`, `monster:move`, `monster:attack`,
`admin:start`, `state` (broadcast à chaque tick), `instruction` (texte → TTS fr-FR sur
le téléphone du monstre), `jumpscare`.

## 4. Configuration des caméras Tapo C210 (une fois)

1. Dans l'app Tapo : *Paramètres de l'appareil → Paramètres avancés → Compte caméra* →
   créer un identifiant/mot de passe (différent du compte TP-Link).
2. Relever l'IP locale de chaque caméra (app Tapo ou box internet). IP fixe conseillée.
3. Dans `/admin` : ajouter chaque caméra (nom de zone, IP, identifiants) → le serveur
   génère la config go2rtc et vérifie le flux.

## 5. Structure du dépôt

```
FNAF-IRL/
├── server/          # Node + TS : Express, Socket.IO, moteur de jeu, pilotage go2rtc
│   └── src/
│       ├── index.ts       # HTTP + WebSocket + fichiers statiques
│       ├── game/          # machine à états, tick, règles, zones
│       └── streaming.ts   # génération go2rtc.yaml + lancement du binaire
├── web/             # React + Vite + TS : /, /guard, /monster, /admin
└── config/          # cameras.json, zones.json (plan du bâtiment)
```

## 6. Étapes suivantes (v2)

- QR codes physiques par zone pour valider les déplacements (anti-triche).
- Détection de mouvement ONVIF des Tapo → le serveur détecte un monstre qui bouge
  pendant un freeze → pénalité automatique.
- Rôles de monstres différenciés (Foxy = rapide mais bruyant, etc.), mode spectateur.
