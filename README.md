# Harmony

A harmonic visualizer: see musical intervals as the curves they trace. Tone, listen and file modes feed a harmonograph renderer (2D and a 3D orbit view), with a gallery for saving and sharing curves.

Built with Next.js 16, React 19, TypeScript and three.js.

## Running locally

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` to configure it. With `DATABASE_URL` unset, the gallery stores data in a JSON file in `.data/`. Set it to any Postgres URL (Neon, Supabase) to use a real database.

## Scripts

- `npm run dev`: start the dev server
- `npm run build`: production build
- `npm run typecheck`: type-check without emitting
