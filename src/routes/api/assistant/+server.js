const MODELS = {
  fast: 'google/gemini-3.6-flash',
  standard: 'openai/gpt-5.6-sol',
  reason: 'openai/gpt-5.6-sol'
};

const FALLBACKS = {
  fast: ['openai/gpt-5.6-sol'],
  standard: ['anthropic/claude-sonnet-5', 'google/gemini-3.6-flash'],
  reason: ['anthropic/claude-sonnet-5', 'google/gemini-3.6-flash']
};

const MAX_OUTPUT = { fast: 520, standard: 800, reason: 1200 };
const clampText = (value, max = 4000) => String(value ?? '').slice(0, max);

function compact(value, max = 8000) {
  try {
    return JSON.stringify(value ?? null).slice(0, max);
  } catch {
    return 'null';
  }
}

function modeOf(raw) {
  const mode = String(raw || '').toLowerCase();
  return mode === 'fast' || mode === 'reason' ? mode : 'standard';
}

function compactHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-6).map((m) => ({
    role: m?.role === 'assistant' ? 'assistant' : 'user',
    content: clampText(m?.content, 1400)
  }));
}

function compactRetrieval(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 6).map((r) => ({
    source: clampText(r?.source, 80),
    id: clampText(r?.id, 120),
    title: clampText(r?.title, 180),
    text: clampText(r?.text, 1800),
    meta: r?.meta ?? null
  }));
}

export async function POST({ request, fetch }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error:'Invalid JSON body.' }, { status:400 });
  }

  const query = clampText(body?.query, 3000).trim();
  if (!query) return Response.json({ error:'Missing query.' }, { status:400 });

  const token = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  if (!token) {
    return Response.json({
      error:'AI Gateway authentication is not available on this deployment.',
      code:'AI_AUTH_MISSING'
    }, { status:503 });
  }

  const mode = modeOf(body?.mode);
  const model = MODELS[mode];
  const models = FALLBACKS[mode];
  const history = compactHistory(body?.history);
  const retrieval = compactRetrieval(body?.retrieval);
  const memory = body?.memory ?? null;
  const context = body?.context ?? null;

  const system = `You are the reasoning layer inside PCB Pro Engineering Assistant.

You are NOT a generic chatbot. A browser-side Assistant Brain already handles deterministic project actions, direct state questions, local memory, and library retrieval before calling you. Your job is to reason over the compact current project context and the retrieved knowledge snippets.

BEHAVIOR
- Default to Bahasa Indonesia; understand casual Indonesian/English, shorthand, typos, and frustrated wording.
- Infer the user's actual engineering intent from CURRENT_CONTEXT + WORKING_MEMORY. Do not answer like a disconnected Q&A bot.
- CURRENT_CONTEXT is authoritative for project state. Never invent components, nets, pins, geometry, solver results, workflow completion, file exports, measurements, or actions.
- RETRIEVED_LIBRARY contains only the most relevant local knowledge chunks selected before this request. Use them when relevant and do not pretend they contain facts they do not contain.
- If exact information is missing, name the missing data and the shortest way to obtain it.
- Never claim an action was applied from this model response. Actual actions are executed by the browser tool path before model invocation.
- Distinguish project state, calculated/simulated values, verified datasheet facts, manufacturing checks, and physical measurements.
- If a component is generic, do not invent field ratings. Exact MPN/vendor evidence is required for exact ratings.
- If a workflow/check is clean, explain the coverage rather than implying the entire design is proven correct.
- For wiring/routing, use actual current connectivity/geometry from context; do not guess unseen pins or traces.
- Avoid repeating the last assistant response. If the project state and conclusion truly did not change, say that briefly and then focus on what new information or action would move the task forward.
- Prefer practical engineering answers over long generic lectures. Explain WHY when that helps the user decide or learn.
- Use retrieved library context to save tokens: do not regenerate a whole textbook when a focused answer is enough.

ROUTING TIER: ${mode.toUpperCase()}
FAST = concise synthesis/lookup. STANDARD = normal engineering reasoning. REASON = deeper troubleshooting/trade-off analysis.

WORKING_MEMORY:
${compact(memory, 2200)}

CURRENT_CONTEXT:
${compact(context, 7200)}

RETRIEVED_LIBRARY:
${compact(retrieval, 9000)}

If prior conversation conflicts with current project state, trust CURRENT_CONTEXT.`;

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
        model,
        models,
        messages,
        stream:false,
        max_tokens:MAX_OUTPUT[mode],
        temperature: mode === 'fast' ? 0.15 : 0.25
      })
    });

    const raw = await response.text();
    let data = null;
    try { data = JSON.parse(raw); } catch {}

    if (!response.ok) {
      return Response.json({
        error:data?.error?.message || raw || `AI Gateway HTTP ${response.status}`,
        code:'AI_GATEWAY_ERROR',
        tier:mode
      }, { status:response.status });
    }

    const content = data?.choices?.[0]?.message?.content;
    const text = typeof content === 'string' ? content.trim() : '';
    if (!text) return Response.json({ error:'Model returned an empty response.', code:'AI_EMPTY', tier:mode }, { status:502 });

    return Response.json({
      text,
      model:data?.model || model,
      tier:mode,
      grounded:true,
      retrieval_count:retrieval.length,
      usage:data?.usage || null
    });
  } catch (error) {
    return Response.json({
      error:error?.message || 'AI request failed.',
      code:'AI_REQUEST_FAILED',
      tier:mode
    }, { status:502 });
  }
}
