# PCB Pro Explanation Contract

Version: 1.13.0

PCB Pro follows an **Explain Everything** rule. A feature is not considered fully integrated until its behavior and outputs can be explained to a normal user in Indonesian/English.

## Required explanation for every feature

Every new or changed feature must document:

1. **What it is** — what the feature/control represents.
2. **Why it exists** — the problem it solves or engineering reason it is needed.
3. **Input/source data** — project state, geometry, netlist, model, datasheet, user input, etc.
4. **Process** — what the software actually does. Do not describe engines that do not exist.
5. **Output/result** — what is produced and the unit/status where relevant.
6. **How to interpret the result** — what the user can conclude.
7. **Limitations / what must not be concluded** — unsupported models, missing checks, assumptions, uncertainty.
8. **Next step** — what the user should inspect or do next in the workflow.

Use `PCBProExplain.register(entry)` for runtime-owned features or add a dedicated entry to `/static/explanation-registry-v113.json`.

## Required explanation for every result

A result must identify its level. Do not merge these levels:

- UI state
- derived project state
- calculated/simulated result
- verified exact-part datasheet data
- manufacturing/file check
- physical measurement

`clean`, `ready`, `done`, or `0 findings` only applies to the rules/models that actually ran. It must never silently mean the whole design is correct.

`unsupported`, `unavailable`, `blocked`, and `pending` are valid engineering states. Never replace them with dummy numbers or fake success.

## Required explanation for every change

Every patch/change should record:

- what changed;
- why it changed;
- affected feature/result;
- how behavior/results are different now;
- migration or user action, when applicable;
- remaining limitations;
- test/deploy evidence separately from the release note.

A runtime feature can additionally call `PCBProExplain.registerChange({ feature, title, why, detail, impact, limits })`.

## Coverage audit

The Explanation Center scans visible interactive controls. Controls with dedicated documentation are counted separately from fallback explanations. Fallback exists so an unknown/new control is never silent, but fallback coverage is **documentation debt**, not completion.

Before calling a release complete, review **Explanation → Coverage** and resolve newly introduced undocumented controls where practical.

## Language

All user-facing explanations should support Indonesian and English. Engineering terms may remain in standard industry English where translating them would reduce clarity (e.g. netlist, footprint, Edge.Cuts, DRC, ERC, Gerber, via, pad, RefDes).
