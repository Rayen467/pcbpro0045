# PCB Pro 0045

Browser-based EDA workspace built with SvelteKit.

## Current baseline — v1.1.0

- Responsive professional workspace shell
- Schematic, PCB, Simulator, 3D, BOM, Fabrication, Rules, and Release workspaces
- Click-to-place component flow
- Smooth custom Pointer Events placement instead of native HTML drag-and-drop
- requestAnimationFrame-batched pointer updates for smoother movement
- Direct element movement while dragging, with state committed on pointer release
- Mouse, pen, and touch use the same pointer interaction path
- Resizable left library and right inspector panels
- Collapsible library and inspector panels
- Wheel zoom anchored to the cursor
- Space/middle-mouse pan
- Snap on/off with Alt temporary snap bypass
- Undo/redo for editing operations
- PCB layer visibility controls
- Local browser save
- Project JSON export
- BOM CSV export
- Explicit engine-status labels so unfinished simulation/manufacturing features are not presented as production-ready

## Interaction shortcuts

- `Wheel` — zoom canvas
- `Space + drag` or middle mouse — pan
- `Alt` while dragging — bypass grid snapping
- `R` — rotate selected component
- `Delete` — remove selected component
- `Ctrl+Z` / `Ctrl+Y` — undo / redo
- `Ctrl+S` — save project locally
- `X` — swap F.Cu / B.Cu active layer

## Development direction

1. Circuit domain model: symbols, pins, wires, nets, footprints, pads, tracks, vias, layers, rules
2. Real schematic connectivity + ERC
3. SPICE integration
4. Interactive PCB routing + geometry-aware DRC
5. Gerber X2, Excellon, BOM, and pick-and-place exporters
6. 3D/STEP component model support

## Local run

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Deployment

Production source is `Rayen467/pcbpro0045` on branch `main`. Vercel should stay connected to this repository so every successful push to `main` produces a new deployment.
