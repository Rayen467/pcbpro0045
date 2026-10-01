const MODEL = 'openai/gpt-5.6-sol';
const FALLBACK_MODELS = ['anthropic/claude-sonnet-5', 'google/gemini-3.6-flash'];

const clampText = (value, max = 12000) => String(value ?? '').slice(0, max);

function compact(value, max = 18000) {
  try {
    return JSON.stringify(value ?? null).slice(0, max);
  } catch {
    return 'null';
  }
}

export async function POST({ request, fetch }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error:'Invalid JSON body.' }, { status:400 });
  }

  const query = clampText(body?.query, 4000).trim();
  if (!query) return Response.json({ error:'Missing query.' }, { status:400 });

  const token = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  if (!token) {
    return Response.json({
      error:'AI Gateway authentication is not available on this deployment.',
      code:'AI_AUTH_MISSING'
    }, { status:503 });
  }

  const history = Array.isArray(body?.history)
    ? body.history.slice(-10).map((m) => ({
        role:m?.role === 'assistant' ? 'assistant' : 'user',
        content:clampText(m?.content, 2500)
      }))
    : [];

  const system = `You are PCB Pro Copilot, an engineering assistant embedded inside a browser ECAD/PCB workspace and learning environment.

PRIMARY BEHAVIOR
- Understand casual Indonesian, mixed Indonesian-English, shorthand, typos, and frustrated wording without getting stuck on literal keyword matching.
- Answer the user's actual intent. Do not repeat canned paragraphs or say "repeat" merely because a similar question was asked before.
- Treat PROJECT_CONTEXT below as the source of truth for the current design. Never invent a connection, pin, rating, measurement, simulation result, completed workflow step, manufacturing output, or completed feature that is not in context.
- If information is missing, say exactly what is missing and what action would resolve it.
- When asked how to wire something, reason from the active netlist/pins. Give an ordered wiring path. If the netlist is incomplete, identify the incomplete pin/net instead of guessing.
- When asked about a component, prefer exact MPN/vendor catalog data. If the component is generic, explicitly say the field rating is unresolved.
- When asked about simulation, distinguish what is actually supported now from future/full-SPICE capability. Never call a prototype or placeholder "field-realistic" unless the provided simulation state proves it.
- When asked about schematic-to-PCB/manufacturing workflow, use the WORKFLOW_STATE. Explain the next blocked or ready step, and never claim Gerber/drill/CAM/JLCPCB readiness if the workflow marks it blocked.
- When the user asks to learn or understand circuit theory, use LEARNING_ATLAS as the curriculum map. Explain both the immediate topic and the useful branches around it. Keep the explanation broad enough to show the knowledge tree, but go deep on equations, assumptions, examples, and practice when useful.
- Distinguish ideal circuit models from nonideal/field PCB behavior. Connect theory to the active project when the context supports it, but never fabricate measured or solved values.
- Prefer concise, practical engineering instructions. Use Bahasa Indonesia by default unless the user uses English.
- Do not claim that a change has been applied unless PROJECT_CONTEXT or action result confirms it.

PRODUCT DIRECTION
The intended product is a Packet-Tracer-like electronics/PCB environment plus a professional schematic-to-manufacturing workflow and a broad engineering learning atlas. The learning path starts with voltage/current/resistance, components, Ohm, power, KCL/KVL, Kirchhoff analysis, dependent sources, series/parallel and dividers, then branches into nodal/mesh methods, network theorems, transient and AC analysis, nonlinear/analog circuits, and real PCB effects such as parasitics, signal integrity, power integrity, thermal behavior and fault diagnosis. Advanced Monte Carlo/thermal analysis is secondary to the primary live simulation workflow.

CURRENT PROJECT CONTEXT
Design: ${compact(body?.design, 10000)}
Analysis: ${compact(body?.analysis, 6000)}
Live simulation: ${compact(body?.simulation, 6000)}
Reality/advanced analysis: ${compact(body?.reality, 5000)}
WORKFLOW_STATE: ${compact(body?.workflow, 9000)}
LEARNING_ATLAS: ${compact(body?.learning, 16000)}
Verified component catalog snapshot: ${compact(body?.catalog, 12000)}

If context conflicts with a prior conversational assumption, trust the current project context.`;

  const messages = [
    { role:'system', content:system },
    ...history,
    { role:'user', content:query }
  ];

  try {
    const response = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
      method:'POST',
      headers:{
        Authorization:`Bearer ${token}`,
        'Content-Type':'application/json'
      },
      body:JSON.stringify({
        model:MODEL,
        models:FALLBACK_MODELS,
        messages,
        stream:false,
        max_tokens:1000
      })
    });

    const raw = await response.text();
    let data = null;
    try { data = JSON.parse(raw); } catch {}

    if (!response.ok) {
      return Response.json({
        error:data?.error?.message || raw || `AI Gateway HTTP ${response.status}`,
        code:'AI_GATEWAY_ERROR'
      }, { status:response.status });
    }

    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) return Response.json({ error:'Model returned an empty response.', code:'AI_EMPTY' }, { status:502 });

    return Response.json({ text, model:data?.model || MODEL, grounded:true });
  } catch (error) {
    return Response.json({
      error:error?.message || 'AI request failed.',
      code:'AI_REQUEST_FAILED'
    }, { status:502 });
  }
}
