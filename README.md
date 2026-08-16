# FNAF IRL — Cinq Nuits En Vrai 👹📹

Un jeu type *Five Nights at Freddy's* joué **en vrai** : un **Surveillant** observe de vraies
caméras **Tapo C210**, des **Monstres** (joueurs humains, téléphone en poche + casque Bluetooth)
se déplacent physiquement dans le bâtiment et reçoivent des **instructions audio** en temps réel
(« STOP ! La caméra te regarde ! »).

Voir [ARCHITECTURE.md](./ARCHITECTURE.md) pour l'architecture complète et le gameplay détaillé.

## Démarrage rapide (mode démo, sans caméras)

```bash
npm install
npm run dev        # serveur de jeu sur :3000 + frontend Vite sur :5173
```

Puis :
- **Surveillant** (PC) : http://localhost:5173/guard
- **Monstres** (téléphones, même Wi-Fi) : `http://<IP-du-PC>:5173/monster`
- **Configuration** : http://localhost:5173/admin

Sans caméras configurées, les flux sont **simulés** (bruit statique) et les monstres présents
dans la zone regardée apparaissent en surimpression — parfait pour tester le gameplay.

En production : `npm run build` puis `npm start` (tout sur `http://<IP-du-PC>:3000`).

## Brancher de vraies caméras Tapo C210

1. Dans l'app Tapo : *Paramètres de l'appareil → Paramètres avancés → Compte caméra* → créer un
   identifiant/mot de passe (différent du compte TP-Link).
2. Relever l'IP locale de chaque caméra (app Tapo → Infos de l'appareil, ou votre box). IP fixe conseillée.
3. Télécharger le binaire [go2rtc](https://github.com/AlexxIT/go2rtc/releases) et le placer dans
   `server/bin/go2rtc` (ou dans le `PATH`), exécutable (`chmod +x`).
4. Ouvrir `/admin`, renseigner IP + compte caméra pour chaque zone, **Enregistrer** : le serveur
   génère la config go2rtc et le relance. Les flux passent en WebRTC (~0,5 s de latence).

## Comment on joue

- Une **nuit dure 6 minutes** (minuit → 6h00). Le surveillant gagne s'il survit.
- Le surveillant ne voit **qu'une caméra à la fois** et peut fermer 2 **portes** virtuelles —
  mais tout consomme son **énergie** (100 %). À 0 % : **blackout**, monstres libres.
- Quand la caméra d'une zone est regardée, les monstres qui s'y trouvent entendent
  **« STOP »** dans leur oreillette et doivent s'immobiliser (le serveur bloque leurs déplacements).
- Les monstres avancent de zone en zone (gros boutons sur le téléphone) jusqu'aux entrées du
  bureau ; porte ouverte → **ATTAQUE** → jumpscare plein écran chez le surveillant.

## Stack

- `server/` : Node.js 20 + TypeScript, Express, Socket.IO (moteur de jeu autoritaire, tick 1 s),
  pilotage de go2rtc (RTSP → WebRTC).
- `web/` : React 19 + Vite + TypeScript — routes `/` (lobby), `/guard`, `/monster`, `/admin`.
- Audio des monstres : Web Speech API (`speechSynthesis`, fr-FR) + vibrations.
