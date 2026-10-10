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

## Portable full-project backup — v1.24.0

The **BACKUP** control in the top toolbar exports or restores a local JSON archive with:
- all components and schematic/PCB positions;
- the wire graph;
- board tracks, outline, placements and pads;
- advanced board objects (vias, zones and keepouts);
- professional rule settings and manufacturing calibration.

Backup files include a SHA-256 checksum, format/version checks, size limits and structural validation. Import is **explicitly confirmed** before replacing the local project, and a storage error triggers best-effort rollback of the prior local state. A restored project is detached from the prior cloud project ID, so an import cannot silently overwrite that cloud project.

**Important:** This is an unencrypted local JSON backup. Store it carefully. It does **not** include the private cloud recovery key; use the separate **Backup key** option for that. This archive does not reproduce cloud revision history, external data/library files, generated output packages or the last preflight/DRC result. Re-run simulation, ERC, physical DRC and manufacturing preflight before fabrication. The older "Export layout" remains layout-only.

## Engineering verification — v1.25.0

The toolbar now exposes **SPICE** and **VERIFY**. Both use live project objects, not sample circuits:

- SPICE assembles a strictly checked ngspice-compatible .cir input from connected R/C/L/V/I sources and real nets. Invalid values, absent ground, unconnected pins, conflicting pin-to-net mappings, and unsupported types block export. Generic LED/diode models are available only by explicit opt-in and are labeled *illustrative only*. Vendor-model sign-off is not available.
- VERIFY combines actual project integrity, SPICE model coverage, physical geometry DRC and manufacturing preflight into one auditable downloadable JSON report. It never claims hardware-certified readiness.
- Physical DRC rejects copper without net identity, tracks/vias outside the board, and retains existing clearance/width/edge/via checks.
- The simulation UI reads actual project components and nets rather than substituting demo hardware on empty designs.
- CAM blocks boards with unexported copper zones. All packages are deliberately labeled ENGINEERING DRAFT while mask/paste/silkscreen, complete padstack, footprint and THT drill hole coverage remains unverified.

**Still to build:** actual ngspice execution (WASM or service), vendor subcircuits, multilayer/rip-up autorouting, high-speed SI/PI parasitics, independent full-Gerber roundtrips, and HIL comparison. Exported SPICE input is not an executed simulation or fabrication sign-off.
