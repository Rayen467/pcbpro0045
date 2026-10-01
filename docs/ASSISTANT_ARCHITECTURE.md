# PCB Pro Hybrid AI Assistant Architecture

Version: 1.14.0

The assistant is designed as an **engineering assistant embedded in the project**, not as a generic chatbot.

## Decision path

1. **Read current project context**
   - active workspace/view
   - selected component
   - component/net/wire/track counts
   - workflow/readiness state
   - compact board state
   - live simulation state when available

2. **Try deterministic local tools/state first**
   - navigation
   - simple project-state questions
   - supported direct edit commands
   - supported local simulator/tool actions

   These paths do not need an LLM.

3. **Retrieve from the local engineering library**
   Browser-side RAG indexes:
   - Learning Atlas
   - transcript-grounded Deep Learning expansion
   - Explanation Registry
   - verified component catalog
   - patch/change history

   Retrieval is lexical/local and spends no model tokens. Only a small number of relevant chunks are sent onward.

4. **Route to an LLM only when useful**
   - `FAST`: short synthesis/lookup
   - `STANDARD`: normal engineering reasoning
   - `REASON`: troubleshooting, design review, and trade-off analysis

5. **Return routing metadata**
   Responses can expose route/tier, library hit count, model, and model usage when the provider returns usage information.

## Working memory

The assistant keeps lightweight browser working memory:
- current goal when clearly expressed by the user;
- focus (selected component or active view);
- unresolved issue summary;
- recent conversation;
- project-state fingerprint.

This memory is not part of the design source of truth. Resetting assistant memory must never modify the PCB project.

## Token policy

The assistant should not send the complete project knowledge base on every question.

Per model call it sends only:
- a compact project context;
- up to the most relevant library chunks;
- bounded recent history;
- compact working-memory state;
- the current user question.

Output budgets are also bounded by route tier.

## Grounding policy

The assistant must never invent:
- pin/net connectivity;
- board geometry;
- simulation outputs;
- exact component ratings without exact MPN/vendor evidence;
- completed workflow steps;
- manufacturing files/readiness;
- physical measurements;
- successful project actions that were not confirmed by tool execution.

A model response is a reasoning layer. Project state, rule-engine results, solver state, verified datasheet data, manufacturing checks, and physical measurements remain distinct evidence levels.

## Future direction

The preferred future command architecture is a typed command/tool API (`PCBProProject.command(...)`) so the assistant can act through validated project operations rather than DOM interaction. Model calls should request or explain actions; actual project mutations must be executed and verified by tools.
