# PCB Pro 0045 — Reality Simulation Architecture

## Goal

PCB Pro should behave more like a virtual bring-up bench than a cosmetic waveform viewer. The target is not a claim that software can guarantee fabricated hardware will be identical. The target is a prediction envelope that becomes progressively closer to the physical board as the model coverage improves and is correlated against measured hardware.

## Research and industry basis

This architecture follows current circuit-simulation and digital-twin practice:

- ngspice 47 (2026): current open-source SPICE engine for operating point, transient, AC, noise, nonlinear compact models, subcircuits and vendor `.model` / `.lib` flows.
  - https://ngspice.sourceforge.io/docs.html
  - https://sourceforge.net/projects/ngspice/files/ng-spice-rework/47/
- Xyce 7.10 (Sandia, 2025): open-source SPICE-compatible simulator with large-scale parallel simulation, mixed-signal support, sensitivity/uncertainty work and an external interface for coupled simulation.
  - https://xyce.sandia.gov/
  - https://xyce.sandia.gov/documentation-tutorials/
- IBIS 8.0 and Touchstone 2.1: standardized behavioral I/O and interconnect/network data used for signal- and power-integrity modeling.
  - https://ibis.org/
  - https://ibis.org/specs/specs.htm
- Recent uncertainty-quantification research in electronic circuits supports Monte Carlo methods for propagating component uncertainty into response uncertainty.
  - Dieste-Velasco, 2025, Journal of Electronic Testing, DOI 10.1007/s10836-025-06202-5
- Recent HIL / digital-twin research reinforces the need to close the loop between virtual models and physical hardware instead of treating simulation as a one-time ideal calculation.
  - IEEE TITS 2025, DOI 10.1109/TITS.2025.3526204
  - IEEE TIE 2025, DOI 10.1109/TIE.2024.3497340
  - Solar Energy 2025, DOI 10.1016/j.solener.2025.113666

## Architecture levels

### Level A — Active now: Field Reality Envelope

The browser Reality Engine uses the live project netlist and computes:

- Modified Nodal Analysis (MNA)
- piecewise nonlinear LED/diode behavior
- component tolerance Monte Carlo
- temperature coefficients
- lumped self-heating using package thermal resistance defaults
- source internal resistance and DC PCB trace-loop resistance
- source/supply tolerance
- open-circuit, short-circuit and brownout fault injection
- statistical result envelope (P05/P50/P95), not a single ideal answer
- explicit numerical failures instead of fabricated fallback values
- SPICE netlist export as a bridge to sign-off engines

Generic component limits and thermal defaults are placeholders until the user supplies the exact manufacturer part/model/datasheet.

### Level B — Next: Real SPICE sign-off engine

Integrate ngspice 47 using a Web Worker/WASM build or a controlled simulation service. Required features:

- `.op`
- `.dc`
- `.tran`
- `.ac`
- noise analysis
- parameter stepping
- vendor `.model` and `.lib`
- subcircuits
- MOSFET/BJT/op-amp/regulator models
- convergence diagnostics
- deterministic model/version capture in the project release

The in-browser MNA engine remains useful as a fast preview and diagnostic path; ngspice becomes the higher-fidelity electrical sign-off path.

### Level C — Layout-aware board physics

Add the physical PCB into the electrical model:

- copper trace resistance from geometry, copper weight and temperature
- via resistance / inductance
- connector/contact resistance
- decoupling ESR/ESL
- package/interconnect parasitics
- transmission line models for fast edges
- IBIS 8.0 for digital I/O
- Touchstone 2.1 / S-parameters for measured or extracted interconnects
- optional IBIS-ISS interconnect models

This is required before claiming high-speed digital or power-integrity realism.

### Level D — Multiphysics / reliability

Add electro-thermal coupling and reliability envelopes:

- board/component temperature map
- thermal derating
- ambient and airflow profiles
- power cycling
- solder/package reliability inputs when appropriate
- worst-case and statistical aging scenarios

Use reduced-order thermal networks in the interactive browser path and allow higher-order offline/coupled solvers for sign-off.

### Level E — Hardware-in-the-loop and correlation

This is the part that makes the workflow closest to the Cisco/Packet-Tracer analogy requested for PCB hardware:

1. Simulate the design.
2. Build the first prototype.
3. Connect measurement hardware / bench instruments.
4. Import or stream measured voltage/current/temperature/waveform data.
5. Compare predicted and measured signals.
6. Estimate model error and calibrate source resistance, parasitics, thermal coefficients and component distributions.
7. Save the calibrated model as a revision-specific digital twin.
8. Re-run faults/corners using the calibrated model before the next board revision.

The project should display correlation metrics (MAE/RMSE, worst-case error, waveform timing/overshoot error) instead of a vague “simulation matches hardware” statement.

## Accuracy policy

PCB Pro must never label a result as “real-world accurate” simply because a solver converged. Each simulation result should carry a model-coverage report:

- exact vendor model loaded? yes/no
- PCB parasitics extracted? yes/no
- thermal environment modeled? yes/no
- manufacturing tolerance included? yes/no
- high-speed interconnect model included? yes/no
- physical prototype correlated? yes/no

The closer these are to complete, the stronger the confidence in the predicted field envelope.
