const MODEL='openai/gpt-5.6-sol';
const FALLBACKS=['anthropic/claude-sonnet-5','google/gemini-3.6-flash'];
const clamp=(v,n=4000)=>String(v??'').slice(0,n);
const compact=(v,n=9000)=>{try{return JSON.stringify(v??null).slice(0,n)}catch{return'null'}};

export async function POST({request,fetch}){
  let body;try{body=await request.json()}catch{return Response.json({error:'Invalid JSON body.'},{status:400})}
  const query=clamp(body?.query,3000).trim();if(!query)return Response.json({error:'Missing query.'},{status:400});
  const token=process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN;
  if(!token)return Response.json({error:'AI Gateway authentication is not available on this deployment.',code:'AI_AUTH_MISSING'},{status:503});
  const commands=body?.commands||{}; const allowed=Object.keys(commands);
  const system=`You are PCB Pro Action Planner. Convert a user's requested project action into a SMALL, VALID, AUDITABLE action plan.

You are not a chat bot and you do not execute actions. The browser will validate and execute commands after showing a preview.

STRICT RULES
- Use ONLY command names in COMMAND_MANIFEST.
- Never invent pins, refs, wires, board geometry, ratings, or results.
- CURRENT_CONTEXT is authoritative.
- For schematic wiring, use exact pin IDs present or clearly supported by current component/pin context. If the intended pin cannot be established, return no actions and ask a precise clarification.
- Never translate a request for PCB copper routing/via/zone into schematic.connect. If no typed PCB geometry command exists, return no actions and explain that this mutation is not exposed yet.
- Keep plans minimal. Do not add unrelated cleanup.
- Checks such as ERC/DRC may be appended only when they directly verify the requested mutation.
- Destructive commands such as clearWires require explicit destructive intent from the user.
- Output JSON only. No markdown.

JSON SHAPE:
{
  "intent":"short intent",
  "summary":"what the plan will actually do",
  "actions":[{"command":"one allowed command","args":{},"why":"short reason"}],
  "needs_clarification":null
}
If missing information:
{"intent":"...","summary":"No executable plan yet","actions":[],"needs_clarification":"specific question or missing datum"}

COMMAND_MANIFEST:
${compact(commands,12000)}

CURRENT_CONTEXT:
${compact(body?.context,9000)}

RETRIEVED_LIBRARY:
${compact(body?.retrieval,4500)}

Allowed command names: ${allowed.join(', ')}`;
  try{
    const r=await fetch('https://ai-gateway.vercel.sh/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,models:FALLBACKS,messages:[{role:'system',content:system},{role:'user',content:query}],stream:false,max_tokens:900,temperature:0.05,response_format:{type:'json_object'}})});
    const raw=await r.text();let data=null;try{data=JSON.parse(raw)}catch{}
    if(!r.ok)return Response.json({error:data?.error?.message||raw||`AI Gateway HTTP ${r.status}`,code:'AI_GATEWAY_ERROR'},{status:r.status});
    const content=data?.choices?.[0]?.message?.content;let plan=null;try{plan=JSON.parse(content)}catch{return Response.json({error:'Planner returned invalid JSON.',code:'PLAN_INVALID_JSON'},{status:502})}
    if(!Array.isArray(plan?.actions))plan.actions=[];
    for(const a of plan.actions){if(!allowed.includes(a?.command))return Response.json({error:`Planner emitted unsupported command: ${a?.command}`,code:'PLAN_UNSUPPORTED_COMMAND'},{status:502})}
    return Response.json({plan,model:data?.model||MODEL,usage:data?.usage||null,grounded:true});
  }catch(error){return Response.json({error:error?.message||'Planner request failed.',code:'PLAN_REQUEST_FAILED'},{status:502})}
}