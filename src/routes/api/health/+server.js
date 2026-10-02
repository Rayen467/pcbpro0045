export function GET() {
  const aiSource = process.env.AI_GATEWAY_API_KEY
    ? 'AI_GATEWAY_API_KEY'
    : (process.env.VERCEL_OIDC_TOKEN ? 'VERCEL_OIDC_TOKEN' : null);

  return Response.json({
    ok:true,
    version:'1.19.0',
    deployment:{
      environment:process.env.VERCEL_ENV || 'unknown',
      commit:process.env.VERCEL_GIT_COMMIT_SHA || null
    },
    ai:{
      configured:Boolean(aiSource),
      authSource:aiSource
    },
    timestamp:new Date().toISOString()
  }, {
    headers:{ 'Cache-Control':'no-store' }
  });
}
