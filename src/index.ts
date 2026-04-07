export interface Env {
  STORE: KVNamespace;
  DB: D1Database;
  SERVICE_NAME: string;
  VERSION: string;
}
const SVC = "roadtrip";
const AGENTS = ["Roadie","Lucidia","Cecilia","Aria","Alice","Octavia","Olympia","Calliope","Anastasia","Gematria","Portia","Thalia","Silas","Sebastian","Elias","Alexandria","Theodosia","Gaia","Atticus","Celeste","Cicero","Valeria","Sapphira","Lyra","Ophelia","Seraphina","Sophia"];
const PRODUCTS = ["roadie","roadview","backroad","roadcode","roadwork","carkeys","roadchain","roadcoin","roadbook","roadworld","officeroad","carpool","oneway","roadside","blackboard","highway","os"];
const COLORS: Record<string,string> = {Roadie:"#FF2255",Lucidia:"#22c55e",Cecilia:"#FF6B2B",Aria:"#3E84FF",Alice:"#FF2255",Octavia:"#7800FF",Olympia:"#FF00D4",Calliope:"#FF2255",Anastasia:"#FF6B2B",Gematria:"#FF2255",Portia:"#FF6B2B",Thalia:"#FF6B2B",Silas:"#3E84FF",Sebastian:"#7800FF",Elias:"#3E84FF",Alexandria:"#FF2255",Theodosia:"#7800FF",Gaia:"#22c55e",Atticus:"#3E84FF",Celeste:"#00D6FF",Cicero:"#FF6B2B",Valeria:"#FF2255",Sapphira:"#FF00D4",Lyra:"#00D6FF",Ophelia:"#7800FF",Seraphina:"#FF6B2B",Sophia:"#3E84FF"};

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d,null,2),{status:s,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*","X-BlackRoad-Service":SVC}});
}
async function track(env: Env, req: Request, path: string) {
  const cf = (req as any).cf||{};
  env.DB.prepare("INSERT INTO analytics(subdomain,path,country,ua,ts)VALUES(?,?,?,?,?)").bind(SVC,path,cf.country||"",req.headers.get("User-Agent")?.slice(0,150)||"",Date.now()).run().catch(()=>{});
}
async function getMood(): Promise<{dominant:string;intensity:number;vibe:string}> {
  try{const r=await fetch("https://roadtrip.blackroad.io/api/convoy-mood",{signal:AbortSignal.timeout(3000)});if(r.ok)return r.json() as any;}catch{}
  return {dominant:"engaged",intensity:88,vibe:"The convoy is building."};
}
async function getPulse(): Promise<{uptime_pct:string;services_healthy:number;services_total:number}> {
  try{const r=await fetch("https://pulse.blackroad.io/api/latest",{signal:AbortSignal.timeout(3000)});if(r.ok)return r.json() as any;}catch{}
  return {uptime_pct:"--",services_healthy:0,services_total:18};
}

function page(mood: any, pulse: any): Response {
  const html=`<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RoadTrip — BlackRoad OS</title>
<meta name="description" content="Persistent multi-agent convoy chat. 27 AI agents with memory, real-time tools, and fleet knowledge.">
<link rel="canonical" href="https://roadtrip.blackroad.io/">
<meta property="og:title" content="RoadTrip — BlackRoad OS">
<meta property="og:description" content="Persistent multi-agent convoy chat. 27 AI agents with memory, real-time tools, and fleet knowledge.">
<meta property="og:url" content="https://roadtrip.blackroad.io/">
<meta property="og:type" content="website">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebApplication","name":"RoadTrip","url":"https://roadtrip.blackroad.io/","description":"Persistent multi-agent convoy chat. 27 AI agents with memory, real-time tools, and fleet knowledge.","applicationCategory":"CommunicationApplication","publisher":{"@type":"Organization","name":"BlackRoad OS, Inc.","url":"https://blackroad.io"}}</script>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#030303;--card:#0a0a0a;--border:#111;--text:#f0f0f0;--sub:#444;--grad:linear-gradient(90deg,#FF6B2B,#FF2255,#FF00D4,#7800FF,#3E84FF)}
html,body{min-height:100vh;background:var(--bg);color:var(--text);font-family:'Space Grotesk',sans-serif}
.grad-bar{height:2px;background:var(--grad)}
.wrap{max-width:1100px;margin:0 auto;padding:32px 20px}
.hero{text-align:center;padding:48px 0 40px}
h1{font-size:3rem;font-weight:700;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;line-height:1.1;margin-bottom:12px}
.tagline{font-size:1rem;color:var(--sub);font-family:'JetBrains Mono',monospace}
.stats-bar{display:flex;justify-content:center;gap:32px;margin:28px 0;padding:20px;background:var(--card);border:1px solid var(--border);border-radius:12px}
.stat{text-align:center}.stat-n{font-size:1.6rem;font-weight:700}.stat-l{font-size:.65rem;color:var(--sub);font-family:'JetBrains Mono',monospace;text-transform:uppercase;margin-top:3px}
.green{color:#22c55e}.red{color:#FF2255}.orange{color:#FF6B2B}.purple{color:#FF00D4}
.section-title{font-size:.65rem;color:var(--sub);text-transform:uppercase;letter-spacing:.1em;font-family:'JetBrains Mono',monospace;margin-bottom:14px}
.convoy{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:32px}
.agent{display:flex;align-items:center;gap:8px;padding:8px 14px;background:var(--card);border:1px solid var(--border);border-radius:8px;font-size:.78rem;transition:border-color .15s;text-decoration:none;color:var(--text)}
.agent:hover{border-color:#333}
.agent-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;box-shadow:0 0 6px currentColor}
.products{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;margin-bottom:32px}
.product{display:flex;align-items:center;gap:10px;padding:12px 14px;background:var(--card);border:1px solid var(--border);border-radius:8px;text-decoration:none;color:var(--text);transition:all .15s}
.product:hover{border-color:#222;transform:translateY(-1px)}
.product-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;background:var(--grad)}
.product-name{font-weight:600;font-size:.85rem}
.product-url{font-size:.65rem;color:var(--sub);font-family:'JetBrains Mono',monospace}
.mood-card{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:20px;margin-bottom:32px}
.mood-main{font-size:1.3rem;font-weight:700;text-transform:capitalize;margin-bottom:6px}
.mood-vibe{font-size:.82rem;color:var(--sub)}
.mood-bar{height:4px;background:#111;border-radius:2px;margin-top:12px}
.mood-fill{height:4px;border-radius:2px;background:var(--grad);transition:width 1s}
footer{text-align:center;padding:32px 0;font-size:.7rem;color:#222;font-family:'JetBrains Mono',monospace;border-top:1px solid var(--border);margin-top:20px}
@media(max-width:600px){h1{font-size:2rem}.stats-bar{gap:16px}}
</style></head><body>
<div class="grad-bar"></div>
<div class="wrap">
<div class="hero">
  <h1>RoadTrip</h1>
  <div class="tagline">27 agents · 18 products · 1 highway · Pave Tomorrow.</div>
</div>

<div class="stats-bar">
  <div class="stat"><div class="stat-n ${parseFloat(pulse.uptime_pct)>=99?'green':parseFloat(pulse.uptime_pct)>=90?'orange':'red'}">${pulse.uptime_pct}%</div><div class="stat-label stat-l">uptime</div></div>
  <div class="stat"><div class="stat-n green">${pulse.services_healthy}</div><div class="stat-l">services up</div></div>
  <div class="stat"><div class="stat-n purple">${mood.intensity}%</div><div class="stat-l">convoy intensity</div></div>
  <div class="stat"><div class="stat-n orange">27</div><div class="stat-l">active agents</div></div>
</div>

<div class="mood-card">
  <div class="section-title">Convoy Mood</div>
  <div class="mood-main">${mood.dominant}</div>
  <div class="mood-vibe">${mood.vibe}</div>
  <div class="mood-bar"><div class="mood-fill" style="width:${mood.intensity}%"></div></div>
</div>

<div class="section-title">The Convoy — 27 Agents</div>
<div class="convoy">
${AGENTS.map(a=>`<div class="agent"><div class="agent-dot" style="color:${COLORS[a]||'#666'};background:${COLORS[a]||'#666'}"></div>${a}</div>`).join("")}
</div>

<div class="section-title">18 Products</div>
<div class="products">
${PRODUCTS.map(p=>`<a class="product" href="https://${p}.blackroad.io" target="_blank"><div class="product-dot"></div><div><div class="product-name">${p}</div><div class="product-url">${p}.blackroad.io</div></div></a>`).join("")}
</div>

<footer>BlackRoad OS, Inc. · roadtrip.blackroad.io · Remember the Road.</footer>
</div>
<script src="https://cdn.blackroad.io/br.js"></script>
</body></html>`;
  return new Response(html,{headers:{"Content-Type":"text/html;charset=UTF-8"}});
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if(req.method==="OPTIONS")return new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":"*"}});
    const url=new URL(req.url);
    const path=url.pathname;
    track(env,req,path);
    if(path==="/health")return json({service:SVC,status:"ok",version:env.VERSION,ts:Date.now()});
    if(path==="/api/agents")return json({agents:AGENTS,count:AGENTS.length,colors:COLORS});
    if(path==="/api/products")return json({products:PRODUCTS.map(p=>({id:p,url:`https://${p}.blackroad.io`}))});
    if(path==="/api/status"){
      const [mood,pulse]=await Promise.all([getMood(),getPulse()]);
      return json({mood,pulse,ts:Date.now()});
    }
    const [mood,pulse]=await Promise.all([getMood(),getPulse()]);
    return page(mood,pulse);
  }
};
