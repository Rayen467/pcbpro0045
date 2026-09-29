# PCB Pro 0045

Clean development baseline for a browser-based EDA workspace built with SvelteKit.

## Current baseline

- Responsive professional workspace shell
- Schematic, PCB, Simulator, 3D, BOM, Fabrication, Rules, and Release workspaces
- Click-to-place component flow
- Optional drag-and-drop placement from the component library
- Collapsible library and inspector panels
- PCB layer visibility controls
- Local browser save
- Project JSON export
- BOM CSV export
- Explicit engine-status labels so unfinished simulation/manufacturing features are not presented as production-ready

## Development direction

1. Circuit domain model: symbols, pins, wires, nets, footprints, pads, tracks, vias, layers, rules
2. Undo/redo command stack and project serialization
3. Real schematic connectivity + ERC
4. SPICE integration
5. Interactive PCB routing + geometry-aware DRC
6. Gerber X2, Excellon, BOM, and pick-and-place exporters
7. 3D/STEP component model support

## Local run

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Vercel

Import this repository as a new Vercel project and keep the production branch set to `main`.

Repository: `Rayen467/pcbpro0045`

Suggested Vercel project name: `pcbpro0045`
