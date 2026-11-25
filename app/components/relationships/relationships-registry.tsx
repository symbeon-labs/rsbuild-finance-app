"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getRelationshipHistory, listRelationships, saveRelationship, type RelationshipInput } from "@/app/actions/relationships";
import { formatDocument } from "@/lib/brazilian-documents";

type RecordItem = {
  id: string; document: string | null; legal_name: string; trade_name: string | null;
  relationship_types: string[]; state_registration: string | null; email: string | null; phone: string | null;
  street_address: string | null; city: string | null; state: string | null; status: string; notes: string | null;
};
const TYPES = [
  ["cliente","Cliente"],["fornecedor","Fornecedor"],["transportadora","Transportadora"],
  ["parceiro_comercial","Parceiro comercial"],["prestador_servico","Prestador de serviço"],
  ["distribuidor","Distribuidor"],["outros","Outros"]
] as const;
const EMPTY: RelationshipInput = { legalName:"", relationshipTypes:["cliente"], status:"active" };

export function RelationshipsRegistry({ organizationId, environment }: { organizationId: string; environment: "qa" | "production" }) {
  const [records,setRecords] = useState<RecordItem[]>([]);
  const [search,setSearch] = useState("");
  const [status,setStatus] = useState("all");
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [editing,setEditing] = useState<RelationshipInput & {id?:string} | null>(null);
  const [saving,setSaving] = useState(false);
  const [history,setHistory] = useState<{id:string; event_type:string; changed_fields:string[]; occurred_at:string; actor_id:string|null}[] | null>(null);
  const [historyLoading,setHistoryLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    const result = await listRelationships(organizationId, search, status);
    if (result.ok) setRecords(result.records as RecordItem[]);
    else setError(result.error);
    setLoading(false);
  },[organizationId,search,status]);
  useEffect(() => { void refresh(); },[refresh]);

  const countLabel = useMemo(() => `${records.length} registro${records.length === 1 ? "" : "s"}`,[records.length]);

  function update<K extends keyof RelationshipInput>(key: K, value: RelationshipInput[K]) {
    setEditing(current => current ? { ...current, [key]: value } : current);
  }

  async function showHistory(recordId: string) {
    setHistoryLoading(true); setHistory([]);
    const result = await getRelationshipHistory(organizationId, recordId);
    setHistoryLoading(false);
    if (result.ok) setHistory(result.events); else setError(result.error);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true); setError(""); setNotice("");
    const result = await saveRelationship(organizationId, editing);
    setSaving(false);
    if (!result.ok) { setError(result.error); return; }
    setEditing(null); setNotice("Cadastro salvo com sucesso."); await refresh();
  }

  return <section style={{display:"grid",gap:12}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
      <div><strong style={{fontSize:12,color:"var(--ink)"}}>CADASTRO DE RELACIONAMENTOS</strong><p style={{margin:"4px 0 0",fontSize:10,color:"var(--muted)"}}>Registros privados desta organização · {environment === "qa" ? "AMBIENTE QA" : "PRODUÇÃO"}</p></div>
      <button type="button" className="primary-button" onClick={()=>{setEditing({...EMPTY});setError("");}} style={{fontSize:10,padding:"8px 12px"}}>＋ Novo cadastro</button>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 150px",gap:8}}>
      <input aria-label="Pesquisar relacionamentos" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nome, documento ou e-mail…" style={fieldStyle}/>
      <select aria-label="Filtrar por status" value={status} onChange={e=>setStatus(e.target.value)} style={fieldStyle}>
        <option value="all">Todos os status</option><option value="active">Ativos</option><option value="inactive">Inativos</option><option value="archived">Arquivados</option>
      </select>
    </div>
    {notice && <div role="status" style={{fontSize:10,color:"var(--green-text,#047857)"}}>{notice}</div>}
    {error && <div role="alert" style={{fontSize:10,color:"var(--red,#B91C1C)"}}>{error}</div>}
    <div style={{fontSize:10,color:"var(--muted)"}}>{loading ? "Carregando…" : countLabel}</div>
    <div style={{display:"grid",gap:6,maxHeight:300,overflowY:"auto"}}>
      {!loading && records.length===0 && <div style={{padding:18,textAlign:"center",border:"1px dashed var(--line)",borderRadius:8,color:"var(--muted)",fontSize:11}}>Nenhum relacionamento encontrado nesta organização.</div>}
      {records.map(record=><article key={record.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"9px 10px",border:"1px solid var(--line)",borderRadius:7,background:"var(--surface)"}}>
        <div style={{minWidth:0}}>
          <strong style={{display:"block",fontSize:11,color:"var(--ink)",overflowWrap:"anywhere"}}>{record.trade_name || record.legal_name}</strong>
          <span style={{display:"block",fontSize:9,color:"var(--muted)",marginTop:3}}>{record.relationship_types.map(t=>TYPES.find(x=>x[0]===t)?.[1] ?? t).join(" · ")}{record.document ? ` · ${formatDocument(record.document)}` : ""}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:7,flexShrink:0}}>
          <span style={{fontSize:8,fontWeight:700,color:record.status==="active"?"var(--green-text,#047857)":"var(--muted)"}}>{record.status==="active"?"ATIVO":record.status==="inactive"?"INATIVO":"ARQUIVADO"}</span>
          <button type="button" className="secondary-button" onClick={()=>void showHistory(record.id)} style={{fontSize:9,padding:"5px 8px"}}>Histórico</button><button type="button" className="secondary-button" onClick={()=>setEditing({id:record.id,legalName:record.legal_name,tradeName:record.trade_name ?? "",document:record.document ?? "",relationshipTypes:record.relationship_types,stateRegistration:record.state_registration ?? "",email:record.email ?? "",phone:record.phone ?? "",streetAddress:record.street_address ?? "",city:record.city ?? "",state:record.state ?? "",notes:record.notes ?? "",status:record.status})} style={{fontSize:9,padding:"5px 8px"}}>Editar</button>
        </div>
      </article>)}
    </div>

    {history !== null && <div role="dialog" aria-modal="true" aria-label="Histórico do relacionamento" style={{position:"fixed",inset:0,zIndex:1001,background:"rgba(15,15,15,.55)",display:"grid",placeItems:"center",padding:14}} onMouseDown={e=>{if(e.target===e.currentTarget)setHistory(null);}}><section style={{width:"min(100%,480px)",maxHeight:"80vh",overflowY:"auto",background:"var(--surface)",border:"1px solid var(--line)",borderRadius:12,padding:18,display:"grid",gap:10}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><strong style={{fontSize:12}}>HISTÓRICO DE ALTERAÇÕES</strong><button type="button" className="secondary-button" onClick={()=>setHistory(null)}>Fechar</button></div>{historyLoading ? <p style={{fontSize:11,color:"var(--muted)"}}>Carregando histórico…</p> : history.length===0 ? <p style={{fontSize:11,color:"var(--muted)"}}>Nenhum evento registrado.</p> : history.map(event=><article key={event.id} style={{padding:"9px 0",borderBottom:"1px solid var(--line)"}}><strong style={{fontSize:10}}>{event.event_type==="created"?"Cadastro criado":event.event_type==="status_changed"?"Status alterado":"Cadastro atualizado"}</strong><span style={{display:"block",fontSize:9,color:"var(--muted)",marginTop:3}}>{new Date(event.occurred_at).toLocaleString("pt-BR")} · {event.actor_id ? `Usuário ${event.actor_id.slice(0,8)}` : "Sistema"}</span><span style={{display:"block",fontSize:9,color:"var(--muted)",marginTop:3}}>{event.changed_fields.join(" · ")}</span></article>)}</section></div>}

    {editing && <div role="dialog" aria-modal="true" aria-label="Cadastro de relacionamento" style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(15,15,15,.55)",display:"grid",placeItems:"center",padding:14}} onMouseDown={e=>{if(e.target===e.currentTarget)setEditing(null);}}>
      <form onSubmit={submit} style={{width:"min(100%,620px)",maxHeight:"92vh",overflowY:"auto",background:"var(--surface)",border:"1px solid var(--line)",borderRadius:12,padding:18,display:"grid",gap:10,boxShadow:"0 18px 60px rgba(0,0,0,.22)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><span style={{fontSize:9,color:"var(--rsbuild-terracotta)",fontWeight:800,letterSpacing:".08em"}}>RELACIONAMENTO · V1</span><h3 style={{margin:"4px 0 0",fontSize:16}}>{editing.id?"Editar cadastro":"Novo cadastro"}</h3></div><button type="button" className="secondary-button" onClick={()=>setEditing(null)}>Fechar</button></div>
        <label style={labelStyle}>CPF/CNPJ<input value={editing.document ?? ""} onChange={e=>update("document",e.target.value)} placeholder="Documento (opcional)" style={fieldStyle}/></label>
        <label style={labelStyle}>Razão social / Nome<input required value={editing.legalName} onChange={e=>update("legalName",e.target.value)} maxLength={180} style={fieldStyle}/></label>
        <label style={labelStyle}>Nome fantasia<input value={editing.tradeName ?? ""} onChange={e=>update("tradeName",e.target.value)} style={fieldStyle}/></label>
        <div style={labelStyle}>Classificações <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:7,marginTop:7}}>
          {TYPES.map(([key,label])=><label key={key} style={{display:"flex",alignItems:"center",gap:6,fontSize:10,color:"var(--ink)"}}><input type="checkbox" checked={(editing.relationshipTypes??[]).includes(key)} onChange={e=>update("relationshipTypes",e.target.checked?[...(editing.relationshipTypes??[]),key]:(editing.relationshipTypes??[]).filter(x=>x!==key))}/>{label}</label>)}
        </div></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:9}}>
          <label style={labelStyle}>Inscrição estadual<input value={editing.stateRegistration??""} onChange={e=>update("stateRegistration",e.target.value)} style={fieldStyle}/></label>
          <label style={labelStyle}>E-mail<input type="email" value={editing.email??""} onChange={e=>update("email",e.target.value)} style={fieldStyle}/></label>
          <label style={labelStyle}>Telefone<input value={editing.phone??""} onChange={e=>update("phone",e.target.value)} style={fieldStyle}/></label>
          <label style={labelStyle}>Município<input value={editing.city??""} onChange={e=>update("city",e.target.value)} style={fieldStyle}/></label>
          <label style={labelStyle}>UF<input maxLength={2} value={editing.state??""} onChange={e=>update("state",e.target.value.toUpperCase())} style={fieldStyle}/></label>
          <label style={labelStyle}>Status<select value={editing.status??"active"} onChange={e=>update("status",e.target.value)} style={fieldStyle}><option value="active">Ativo</option><option value="inactive">Inativo</option><option value="archived">Arquivado</option></select></label>
        </div>
        <label style={labelStyle}>Endereço<input value={editing.streetAddress??""} onChange={e=>update("streetAddress",e.target.value)} style={fieldStyle}/></label>
        <label style={labelStyle}>Observações<textarea value={editing.notes??""} onChange={e=>update("notes",e.target.value)} maxLength={2000} rows={3} style={{...fieldStyle,height:"auto",padding:9,resize:"vertical"}}/></label>
        {error && <div role="alert" style={{fontSize:10,color:"var(--red,#B91C1C)"}}>{error}</div>}
        <div style={{display:"flex",justifyContent:"flex-end",gap:8}}><button type="button" className="secondary-button" onClick={()=>setEditing(null)}>Cancelar</button><button type="submit" className="primary-button" disabled={saving}>{saving?"Salvando…":"Salvar cadastro"}</button></div>
      </form>
    </div>}
  </section>;
}

const labelStyle: React.CSSProperties = {display:"grid",gap:5,fontSize:10,fontWeight:650,color:"var(--muted)"};
const fieldStyle: React.CSSProperties = {width:"100%",minWidth:0,minHeight:36,padding:"7px 9px",border:"1px solid var(--line)",borderRadius:6,background:"var(--bg)",color:"var(--ink)",fontSize:11};
