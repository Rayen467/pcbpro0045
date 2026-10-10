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

## Electrical Engineering Workspace — v1.26

Open the native **Electrical** tab to draft a low-voltage AC distribution project alongside PCB design. Electrical state is stored independently inside the **same cloud project and portable full backup**. Starting a new SirkuitLab project clears the local electrical state.

- Supply configurations: 1-phase line-to-neutral or 3-phase line-to-line.
- Circuit load schedule: active power, quantity, utilization/demand factor, power factor, line assignment for single-phase branches, branch cable length, copper cross-section, conductor temperature, optional cable reactance and entered protective-breaker rating.
- Calculated per-circuit current, VA and approximate voltage drop; total demanded W/VA; L1/L2/L3 line currents and heaviest phase; approximate feeder voltage drop.
- SVG single-line overview, CSV load schedule, JSON calculation/report export. No bundled sample loads are inserted into an empty project.
- Input and topology validation, unbalanced three-phase caveat, missing reactance, excessive illustrative voltage-drop review flag, breaker load-over-rating flag and non-verified installation-safety warnings.
- Global VERIFY includes electrical calculations as additional review evidence when circuits exist.

**Safety and coverage:** This tool is for **preliminary planning only**, not installation instructions or a certified electrical design. It does not determine conductor current-carrying capacity (KHA), installation method, derating/grouping, short-circuit levels (IEC 60909), breaker/RCD selection/coordination or disconnection, neutral/harmonics, motor starts, surge protection or site measurements. A contractor/qualified engineer must review site conditions and the relevant PUIL 2020 / SNI 0225 requirements before construction. Values are not connected to an actual digital-twin SPICE or power-flow solver.

Indicative copper resistance is R20 (ohm/km) = 17.241 / conductor area (mm2), adjusted with alpha 0.00393 per deg C. Voltage drop uses 2 I L (R pf + X sin(phi)) for 1-phase and sqrt(3) I L (R pf + X sin(phi)) for balanced 3-phase. Unbalanced line current totals are displayed, but full phase/neutral phasors are not simulated.


## Electrical energy & protection review — v1.27 (2026 update)

The native Electrical tab now includes **Energy Intelligence & Proteksi** as a collapsible section (available inside the same local, cloud-encrypted and portable project):

- User-entered start hour (0–23) and duty duration (0–24 h) per circuit; numerical 24-hour load curve with overnight/fractional-hour integration.
- Optional PV AC hourly generation profile: exactly 24 input factors 0–1 and entered nameplate kWp. **No solar yield or weather is fabricated.**
- Optional PV-surplus-to-battery dispatch model with *atomically entered* capacity (kWh), power (kW), round-trip efficiency and minimum SOC; hourly grid import, PV output, curtailment, hypothetical export and battery state. No grid export is assumed by default; grid export is only an explicitly enabled scenario.
- Tariff entered by user only; projected daily grid bill and hypothetical export revenue remain unavailable when tariffs are unknown.
- Fundamental-frequency phase-current phasor sum to estimate neutral current; no triplen harmonics, nonlinear currents or detailed neutral impedance model.
- Inputs for prospective fault level **Ik** and protective device interrupting rating **Icu** in kA. The tool flags the case Icu below entered Ik; it **does not** determine fault levels, protection curves, coordination, or cable ampacity.
- Motor inrush screens only with a user-entered starting multiplier, plus EVSE-specific protection warnings (no automatic breaker/RCD selection).
- A combined JSON evidence report. Validation stays conservative; test cases include phase phasors, AC energy profiles, battery energy conservation, invalid values, missing PV profile, and protection warnings.

Technical references include IEC 60364-8-81:2026 (replacing IEC 60364-8-1:2019), IEC 60364-8-82:2022 Amendment 1:2026 for prosumer installations, IEC 60364-7-722:2018 for EV supply, and applicable Indonesian PUIL 2020 / SNI 0225 editions. This is an **energy scenario estimator**, NOT a verified IEC compliance implementation or real measured energy/voltage fault protection model. Site study, smart meters, PLC/SCADA, grid approvals, AC power flow and protection coordination remain future integrations.


## Beginner Academy and guided pin routing — v1.28 (October 2026)

SirkuitLab adds a native **Learning** tab with an integrated, evidence-based route from zero electronics/coding experience to safe low-voltage robotics and smart-home prototypes:

- **42 complete Indonesian lessons across 14 modules**, including V/I/R/P, DC safety, component datasheets, software logic/HTML, schematic/netlist/footprints, PCB placement/routing/ERC/DRC/DFM, ESP32 GPIO/firmware, sensor I²C/SPI/UART, motor drivers/PWM/feedback, electrical power distribution concepts, MQTT/ESPHome/Home Assistant, voice Assist, robot drivetrain/PID/ROS 2, and integration/testing/release.
- Four track views: **PCB & Electronics**, **Electrical & Power**, **Smart Home & IoT**, and **Robotics**. The curriculum has explicit conceptual explanations, numerical or technical examples, hands-on exercises, pass criteria, source links and individual questions with real distractors. Both correct quiz answer and **self-confirmed practice** are required to mark a lesson complete; completion is not a certification.
- Three entirely virtual **Routing Labs**: 5 V source/resistor/LED, 3.3 V MCU/I²C sensor, and MCU/controller/motor driver/supply. Pins are clickable, each proposed link is checked against intended nets, mistakes are visually indicated, users can undo/reset and complete an exercise. The exercise is about logical connectivity, **not real copper routing, live electrical measurements, safety certification or a fabrication model**.
- Course progress and three lab completions stored in browser. It joins the existing encrypted DB snapshot and v1.28 portable project backup, and merges achievements from imported projects instead of erasing globally completed coursework. Earlier backups without academy fields preserve existing learning progress.
- Official 2026 references: [KiCad 10 getting started](https://docs.kicad.org/10.0/en/getting_started_in_kicad/getting_started_in_kicad.html), [IPC PCB DFM](https://www.ipc.org/design-manufacturing-confirmed-ipc-standards), [BSN PUIL/SNI 0225](https://pesta.bsn.go.id/produk/detail/12857-sni0225-22020), [ESP-IDF](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/get-started/linux-macos-setup.html), [Home Assistant Assist](https://www.home-assistant.io/voice_control/), [Matter 1.5](https://csa-iot.org/newsroom/matter-1-5-introduces-cameras-closures-and-enhanced-energy-management-capabilities/), and [ROS 2 distribution lifecycle](https://github.com/ros2/ros2_documentation/blob/rolling/source/Releases.rst).
- The **48-week example study plan** and first detailed LED lesson are at [docs/ACADEMY_ROADMAP_2026.md](docs/ACADEMY_ROADMAP_2026.md). This is a plan, not a promise of proficiency within a fixed time.

The existing old Learning Center modal is retained for backward compatibility and does not claim to duplicate the new native Learning tab. Electrical installation and high-current robotics must be assessed by qualified personnel; **no mains AC experimentation** is taught in the routing exercises. Full SPICE, physical wiring CAD, routing continuity-to-net verification with real footprints, board fab compliance, hardware debug telemetry and certification remain work to do, not features advertised by the Academy.
