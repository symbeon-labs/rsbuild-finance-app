import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret, maskKey } from "@/lib/erp-credentials";
import { consumeRateLimit } from "@/lib/api/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROVIDERS=["openai","anthropic","google","xai","local","custom","internal","mcp"] as const;

async function authorize(request:Request){
  const origin=request.headers.get("origin");
  if(origin&&origin!==new URL(request.url).origin)return {session:null,user:null,error:"origin_forbidden" as const};
  const session=await createClient();
  const {data:{user},error}=await session.auth.getUser();
  if(error||!user)return {session:null,user:null,error:"unauthenticated" as const};
  if(!consumeRateLimit(`${user.id}:/api/intelligence-connections`))return {session:null,user:null,error:"rate_limited" as const};
  const {data:allowed,error:rpcError}=await session.rpc("is_platform_administrator");
  if(rpcError||allowed!==true)return {session:null,user:null,error:"forbidden" as const};
  return {session,user,error:null};
}
function fail(error:string){return NextResponse.json({error},{status:error==="unauthenticated"?401:error==="rate_limited"?429:403});}

export async function GET(request:Request){
  const access=await authorize(request);
  if(access.error||!access.user)return fail(access.error??"forbidden");
  const admin=createAdminClient();
  const {data,error}=await admin.from("intelligence_connections")
    .select("id,intelligence_id,organization_id,provider,display_name,endpoint_url,model,credential_hint,status,last_verified_at,last_error,updated_at")
    .order("updated_at",{ascending:false});
  if(error)return NextResponse.json({error:"connections_unavailable"},{status:502});
  return NextResponse.json({connections:data??[]},{headers:{"Cache-Control":"private, no-store"}});
}

export async function POST(request:Request){
  const access=await authorize(request);
  if(access.error||!access.user||!access.session)return fail(access.error??"forbidden");
  const body=await request.json().catch(()=>null);
  if(!body||typeof body!=="object")return NextResponse.json({error:"invalid_json"},{status:400});
  const intelligenceId=String(body.intelligenceId??"");
  const organizationId=String(body.organizationId??"");
  const provider=String(body.provider??"");
  const displayName=String(body.displayName??"").trim();
  const endpointRaw=String(body.endpointUrl??"").trim();
  const model=String(body.model??"").trim();
  const credential=String(body.credential??"").trim();
  if(!UUID.test(intelligenceId)||!UUID.test(organizationId)||
    !PROVIDERS.includes(provider as typeof PROVIDERS[number])||
    displayName.length<2||displayName.length>100||
    credential.length<8||credential.length>8192||model.length>160||endpointRaw.length>2048){
    return NextResponse.json({error:"invalid_connection_payload"},{status:400});
  }
  let endpointUrl:string|null=null;
  if(endpointRaw){
    try{const parsed=new URL(endpointRaw);if(parsed.protocol!=="https:"||parsed.username||parsed.password||parsed.hash)throw new Error("invalid");endpointUrl=parsed.toString();}
    catch{return NextResponse.json({error:"endpoint_must_be_https"},{status:400});}
  }
  let encrypted:string;
  try{encrypted=encryptSecret(credential);}catch{return NextResponse.json({error:"encryption_unavailable"},{status:500});}
  const {data:id,error}=await access.session.rpc("save_intelligence_connection",{
    p_intelligence_id:intelligenceId,p_organization_id:organizationId,p_provider:provider,
    p_display_name:displayName,p_endpoint_url:endpointUrl,p_model:model||null,
    p_credential_encrypted:encrypted,p_credential_hint:maskKey(credential)
  });
  if(error||!id){
    const message=error?.message||"";
    return NextResponse.json({error:message.includes("active_intelligence_assignment_required")?"active_intelligence_assignment_required":
      message.includes("audit_organization_missing")?"audit_unavailable":"connection_save_failed"},
      {status:error?.code==="42501"?403:error?.code==="22023"?400:502});
  }
  const admin=createAdminClient();
  const {data:connection,error:readError}=await admin.from("intelligence_connections")
    .select("id,intelligence_id,organization_id,provider,display_name,endpoint_url,model,credential_hint,status,last_verified_at,last_error,updated_at")
    .eq("id",id).single();
  if(readError||!connection)return NextResponse.json({error:"connection_readback_failed"},{status:502});
  return NextResponse.json({ok:true,connection},{status:201,headers:{"Cache-Control":"private, no-store"}});
}

export async function DELETE(request:Request){
  const access=await authorize(request);
  if(access.error||!access.user||!access.session)return fail(access.error??"forbidden");
  const id=new URL(request.url).searchParams.get("id")??"";
  if(!UUID.test(id))return NextResponse.json({error:"invalid_connection_id"},{status:400});
  const {error}=await access.session.rpc("disable_intelligence_connection",{p_connection_id:id});
  if(error)return NextResponse.json({error:error.code==="P0002"?"connection_not_found":
    error.message.includes("audit_organization_missing")?"audit_unavailable":"connection_disable_failed"},
    {status:error.code==="P0002"?404:error.code==="42501"?403:502});
  return NextResponse.json({ok:true});
}
