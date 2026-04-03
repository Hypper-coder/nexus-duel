# Nexus Duel

This repository seeds a React + Vite + Phaser application with the structure described in `ARHITEKTURA.md`.
It is meant to be a playable 1v1 duel prototype, with a lobby, champion selection, and a Phaser canvas syncing over PeerJS.

## Getting started

```bash
npm install
npm run dev
```

A dev server at `http://localhost:4173` will serve the lobby and, eventually, the Phaser arena.
Use `npm run build` to produce a production bundle.

## Project layout

- `public/` – static assets (sprites, audio, fonts) = placeholders. Keep any future PNG/WAV/WOFF2 files here.
- `src/main.jsx` – entry point that mounts `App`.
- `src/App.jsx` – orchestrates lobby, champion selection, and the game view.
- `src/components/` – React views for lobby, champion pick, and the Phaser canvas.
- `src/game/` – Phaser `GameScene`, the `Player` helper, and champion state builders.
- `src/network/` – PeerJS connection wrapper plus `GameSync` for sending updates every 100ms.
- `src/utils/constants.js` – arena metrics, champion definitions, and helper IDs.

## Architectural notes

- Phaser renders inside `<section className="panel">` from `Game.jsx`; the scene is destroyed when the component unmounts.
- `PeerConnection` is a thin PeerJS wrapper that exposes callback subscriptions, and `GameSync` regularly broadcasts state payloads.
- Champion data and arena constants are centralized so additional abilities or balance patches can reuse the same source.

Consult `ARHITEKTURA.md` for the full specification before continuing feature work.
