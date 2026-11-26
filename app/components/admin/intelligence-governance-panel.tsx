"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

type Intelligence = { id:string; name:string; intelligence_type:string; provider:string; status:string; legacy_agent_id:string|null };
type Organization = { id:string; slug:string; display_name:string };
type Assignment = { id:string; intelligence_id:string; organization_id:string; status:string; access_mode:string; environments:string[]; expires_at:string|null; approved_at:string|null };
type Connection = {id:string;intelligence_id:string;organization_id:string;provider:string;display_name:string;credential_hint:string;status:string};
const providers = ["openai","anthropic","google","xai","local","custom","internal","mcp"];

export function IntelligenceGovernancePanel() {
  const [items,setItems]=useState<Intelligence[]>([]);
  const [organizations,setOrganizations]=useState<Organization[]>([]);
  const [assignments,setAssignments]=useState<Assignment[]>([]);
  const [connections,setConnections]=useState<Connection[]>([]);
  const [intelligenceId,setIntelligenceId]=useState("");
  const [organizationId,setOrganizationId]=useState("");
  const [accessMode,setAccessMode]=useState("internal");
  const [environment,setEnvironment]=useState("qa");
  const [expiresAt,setExpiresAt]=useState("");
  const [connectionAssignment,setConnectionAssignment]=useState("");
  const [provider,setProvider]=useState("openai");
  const [displayName,setDisplayName]=useState("");
  const [endpointUrl,setEndpointUrl]=useState("");
  const [model,setModel]=useState("");
  const [credential,setCredential]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  const refresh=useCallback(async()=>{
    const r=await fetch("/api/intelligence-assignments",{cache:"no-store"});
    const j=await r.json();
    if(!r.ok) throw new Error(j.error||"Falha ao carregar governança");
    setItems(j.intelligences||[]);
    setOrganizations((j.organizations||[]).filter((o:Organization)=>o.slug!=="rsbuild"));
    setAssignments(j.assignments||[]);
    const cr=await fetch("/api/intelligence-connections",{cache:"no-store"});const cj=await cr.json();if(!cr.ok)throw new Error(cj.error||"Falha ao carregar conexões");setConnections(cj.connections||[]);
  },[]);
  useEffect(()=>{void refresh().catch(e=>setMessage(e instanceof Error?e.message:"Falha ao carregar"))},[refresh]);

  const assignable=useMemo(()=>items.filter(i=>i.status==="registered"),[items]);
  const activeAssignment=assignments.find(a=>a.id===connectionAssignment && a.status==="active");
  const linkedIntelligence=activeAssignment?items.find(i=>i.id===activeAssignment.intelligence_id):undefined;
  const canConfigure=Boolean(activeAssignment && linkedIntelligence?.status==="registered" && activeAssignment.environments.some(e=>e==="qa"||e==="sandbox"));

  async function assign(){
    setBusy(true);setMessage("");
    try{
      const r=await fetch("/api/intelligence-assignments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        intelligenceId,organizationId,accessMode,environments:[environment],expiresAt:expiresAt?new Date(expiresAt).toISOString():null
      })});
      const j=await r.json();if(!r.ok)throw new Error(j.error||"Falha ao atribuir inteligência");
      setMessage("Atribuição aprovada e auditada. Nenhuma execução foi habilitada.");
      await refresh();
    }catch(e){setMessage(e instanceof Error?e.message:"Falha ao atribuir")}finally{setBusy(false)}
  }
  async function revoke(id:string){
    if(!window.confirm("Revogar esta atribuição?"))return;
    setBusy(true);setMessage("");
    try{const r=await fetch("/api/intelligence-assignments?id="+encodeURIComponent(id),{method:"DELETE"});const j=await r.json();if(!r.ok)throw new Error(j.error||"Falha ao revogar");setMessage("Atribuição revogada e auditada.");await refresh()}
    catch(e){setMessage(e instanceof Error?e.message:"Falha ao revogar")}finally{setBusy(false)}
  }
  async function connect(){
    if(!activeAssignment||!linkedIntelligence)return;
    setBusy(true);setMessage("");
    try{
      const r=await fetch("/api/intelligence-connections",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        intelligenceId:linkedIntelligence.id,organizationId:activeAssignment.organization_id,
        provider,displayName,endpointUrl,model,credential
      })});
      const j=await r.json();if(!r.ok)throw new Error(j.error||"Falha ao configurar conexão");
      setCredential("");setMessage("Conexão armazenada e auditada. Conectividade não verificada; execução permanece desabilitada.");await refresh();
    }catch(e){setMessage(e instanceof Error?e.message:"Falha ao configurar conexão")}finally{setBusy(false)}
  }

  const field={display:"grid",gap:5,color:"var(--muted)",fontSize:11} as const;
  const input={width:"100%",minWidth:0} as const;
  return <section className="card cockpit-card" style={{padding:20,display:"grid",gap:16}}>
    <header><div className="eyebrow">SYMBEON · INTELLIGENCE GOVERNANCE</div><h2 style={{margin:"5px 0",fontSize:18,color:"var(--ink)"}}>Atribuição, autorização e conexão</h2><p style={{margin:0,fontSize:12,color:"var(--muted)",lineHeight:1.6}}>Atribuição aprovada é pré-requisito para cadastrar credenciais. Isso não executa nem testa o agente.</p></header>
    {message&&<div className="notice" role="status">{message}</div>}
    <div style={{display:"grid",gap:10}}>
      <h3 style={{margin:0,fontSize:14,color:"var(--ink)"}}>1 · Autorizar inteligência para uma organização</h3>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10}}>
        <label style={field}>INTELIGÊNCIA<select style={input} value={intelligenceId} onChange={e=>setIntelligenceId(e.target.value)}><option value="">Selecione</option>{assignable.map(i=><option key={i.id} value={i.id}>{i.name} · {i.intelligence_type}</option>)}</select></label>
        <label style={field}>ORGANIZAÇÃO<select style={input} value={organizationId} onChange={e=>setOrganizationId(e.target.value)}><option value="">Selecione</option>{organizations.map(o=><option key={o.id} value={o.id}>{o.display_name}</option>)}</select></label>
        <label style={field}>MODALIDADE<select style={input} value={accessMode} onChange={e=>setAccessMode(e.target.value)}><option value="internal">Interno</option><option value="beta">Beta</option><option value="contractual">Contratual</option></select></label>
        <label style={field}>AMBIENTE<select style={input} value={environment} onChange={e=>setEnvironment(e.target.value)}><option value="qa">QA</option><option value="sandbox">Sandbox</option></select></label>
        <label style={field}>VALIDADE (OPCIONAL)<input style={input} type="date" value={expiresAt} onChange={e=>setExpiresAt(e.target.value)}/></label>
      </div>
      <div><button className="primary-button" type="button" disabled={busy||!intelligenceId||!organizationId} onClick={()=>void assign()}>{busy?"Processando…":"Aprovar atribuição"}</button></div>
    </div>
    <div style={{display:"grid",gap:10}}>
      <h3 style={{margin:0,fontSize:14,color:"var(--ink)"}}>2 · Atribuições registradas</h3>
      {assignments.length?assignments.map(a=>{
        const item=items.find(i=>i.id===a.intelligence_id), org=organizations.find(o=>o.id===a.organization_id);
        return <article key={a.id} style={{border:"1px solid var(--line)",borderRadius:8,padding:12,display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
          <div><strong style={{fontSize:12,color:"var(--ink)"}}>{item?.name||"Inteligência"}</strong><div style={{fontSize:11,color:"var(--muted)",marginTop:3}}>{org?.display_name||"Organização"} · {a.access_mode} · {a.environments.join(", ")} · {a.status}</div>{a.expires_at&&<div style={{fontSize:10,color:"var(--muted)"}}>Válida até {new Date(a.expires_at).toLocaleDateString("pt-BR")}</div>}</div>
          {a.status==="active"&&<button className="secondary-button" type="button" disabled={busy} onClick={()=>void revoke(a.id)}>Revogar</button>}
        </article>
      }):<p style={{margin:0,fontSize:12,color:"var(--muted)"}}>Nenhuma atribuição cadastrada.</p>}
    </div>
    <div style={{display:"grid",gap:10}}>
      <h3 style={{margin:0,fontSize:14,color:"var(--ink)"}}>3 · Configurar conexão protegida</h3>
      <label style={field}>ATRIBUIÇÃO ATIVA<select style={input} value={connectionAssignment} onChange={e=>setConnectionAssignment(e.target.value)}><option value="">Selecione uma atribuição</option>{assignments.filter(a=>a.status==="active").map(a=>{const i=items.find(x=>x.id===a.intelligence_id),o=organizations.find(x=>x.id===a.organization_id);return <option key={a.id} value={a.id}>{i?.name||"Inteligência"} · {o?.display_name||"Organização"}</option>})}</select></label>
      {activeAssignment&&!canConfigure&&<div className="notice" role="note">Esta inteligência não possui atribuição ativa em QA/Sandbox. A conexão não pode ser configurada nesta etapa.</div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10}}>
        <label style={field}>PROVEDOR<select style={input} value={provider} onChange={e=>setProvider(e.target.value)}>{providers.map(p=><option key={p} value={p}>{p}</option>)}</select></label>
        <label style={field}>NOME DA CONEXÃO<input style={input} value={displayName} onChange={e=>setDisplayName(e.target.value)} maxLength={100}/></label>
        <label style={field}>ENDPOINT HTTPS<input style={input} value={endpointUrl} onChange={e=>setEndpointUrl(e.target.value)} maxLength={2048} placeholder="https://…"/></label>
        <label style={field}>MODELO<input style={input} value={model} onChange={e=>setModel(e.target.value)} maxLength={120}/></label>
        <label style={{...field,gridColumn:"1 / -1"}}>CHAVE / TOKEN<input style={input} type="password" autoComplete="new-password" value={credential} onChange={e=>setCredential(e.target.value)} maxLength={8192}/></label>
      </div>
      <div><button className="primary-button" type="button" disabled={busy||!canConfigure||displayName.trim().length<2||credential.trim().length<8} onClick={()=>void connect()}>{busy?"Processando…":"Salvar conexão protegida"}</button></div>
      <p style={{margin:0,fontSize:10,color:"var(--muted)"}}>Credenciais são criptografadas no servidor, nunca retornadas em claro e nunca testadas ou usadas para execução por esta interface.</p>
      <div style={{display:"grid",gap:6}}>
        <strong style={{fontSize:12,color:"var(--ink)"}}>Conexões configuradas</strong>
        {connections.length?connections.map(c=>{const i=items.find(x=>x.id===c.intelligence_id),o=organizations.find(x=>x.id===c.organization_id);return <div key={c.id} style={{fontSize:11,color:"var(--muted)",display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}><span>{i?.name||"Inteligência"} · {o?.display_name||"Organização"} · {c.provider} · {c.credential_hint} · {c.status}</span>{c.status!=="disabled"&&<button type="button" className="secondary-button" disabled={busy} onClick={async()=>{setBusy(true);try{const r=await fetch("/api/intelligence-connections?id="+encodeURIComponent(c.id),{method:"DELETE"});const j=await r.json();if(!r.ok)throw new Error(j.error||"Falha ao desativar");setMessage("Conexão desativada e auditada.");await refresh()}catch(e){setMessage(e instanceof Error?e.message:"Falha ao desativar")}finally{setBusy(false)}}}>Desativar</button>}</div>}):<span style={{fontSize:11,color:"var(--muted)"}}>Nenhuma conexão configurada.</span>}
      </div>
    </div>
  </section>;
}
