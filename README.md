# PCB Pro 0045

Browser-based EDA workspace built with SvelteKit.

## Original shell baseline — v1.1.0

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

## Project management improvements — v1.15.1

The Svelte shell is extended by the engines loaded from `static/runtime-loader.js`, including wiring, PCB geometry, basic ERC/DRC, and a limited circuit solver.

- New clears the component project and resets wiring, tracks, outline, vias, zones, keepouts and differential pairs.
- Import layout opens a component-layout JSON export, including legacy shell exports. Files are validated before any replacement (2 MB / 5,000 components maximum). Import requires confirmation and clears previous connectivity and board geometry; start a new wiring design from the imported components.
- Export layout creates a JSON backup of component properties and schematic/PCB positions. It does not contain wiring or board geometry. The existing File menu project snapshot remains a separate diagnostic export and is not accepted as a layout import if required fields are missing.
- Save persists components in this browser; the runtime engines persist their own data separately. Component storage failures are reported without claiming success.
- Unsaved component edits are indicated and guarded when leaving the page. Undo/redo applies to component edits, not full-project replacement or runtime engine history.
- The shell fallback avoids claiming verified ERC/DRC or completed routing before the runtime engines are available. Runtime basic checks remain distinct from manufacturing-grade verification.

## Validation

```bash
npm ci
npm test
npm run check
npm run build
```

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
