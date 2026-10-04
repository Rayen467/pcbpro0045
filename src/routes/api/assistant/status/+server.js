const CONFIGURED_MODELS = [
  'openai/gpt-5.6-sol',
  'google/gemini-3.6-flash',
  'anthropic/claude-sonnet-5'
];

export async function GET({ fetch }) {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  const oidc = process.env.VERCEL_OIDC_TOKEN;
  const token = apiKey || oidc;

  if (!token) {
    return Response.json({
      connected: false,
      code: 'AI_AUTH_MISSING',
      auth_source: null,
      configured_models: CONFIGURED_MODELS,
      message: 'No AI Gateway API key or Vercel OIDC token is available to this deployment.'
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const response = await fetch('https://ai-gateway.vercel.sh/v1/models', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const raw = await response.text();
    let data = null;
    try { data = JSON.parse(raw); } catch {}

    if (!response.ok) {
      return Response.json({
        connected: false,
        code: 'AI_GATEWAY_AUTH_FAILED',
        auth_source: apiKey ? 'AI_GATEWAY_API_KEY' : 'VERCEL_OIDC_TOKEN',
        gateway_status: response.status,
        configured_models: CONFIGURED_MODELS,
        message: data?.error?.message || raw || `AI Gateway HTTP ${response.status}`
      }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }

    /** @type {string[]} */
    const ids = [];
    if (Array.isArray(data?.data)) {
      for (const model of data.data) {
        if (model && typeof model === 'object' && typeof model.id === 'string') ids.push(model.id);
      }
    }
    return Response.json({
      connected: true,
      code: 'AI_GATEWAY_OK',
      auth_source: apiKey ? 'AI_GATEWAY_API_KEY' : 'VERCEL_OIDC_TOKEN',
      gateway_status: response.status,
      configured_models: CONFIGURED_MODELS.map((id) => ({ id, available: ids.length ? ids.includes(id) : null })),
      model_count: ids.length,
      checked_at: new Date().toISOString()
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({
      connected: false,
      code: 'AI_GATEWAY_UNREACHABLE',
      auth_source: apiKey ? 'AI_GATEWAY_API_KEY' : 'VERCEL_OIDC_TOKEN',
      configured_models: CONFIGURED_MODELS,
      message: error instanceof Error ? error.message : 'AI Gateway status request failed.'
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
