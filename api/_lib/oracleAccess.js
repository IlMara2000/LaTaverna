export async function authorizeOracle(request) {
    const url=process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key=process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const authorization=request.headers?.authorization;
    if(!url||!key) throw Object.assign(new Error('Configurazione account Oracolo non disponibile.'),{statusCode:503});
    if(!/^Bearer [A-Za-z0-9._-]+$/.test(authorization||'')) throw Object.assign(new Error('Accedi per parlare con l’Oracolo.'),{statusCode:401});
    const headers={apikey:key,Authorization:authorization,'Content-Type':'application/json'};
    const userResponse=await fetch(`${url}/auth/v1/user`,{headers,signal:AbortSignal.timeout(10000)});
    if(!userResponse.ok)throw Object.assign(new Error('Sessione scaduta. Accedi nuovamente.'),{statusCode:401});
    const result=await fetch(`${url}/rest/v1/rpc/take_oracle_quota`,{method:'POST',headers,body:'{}',signal:AbortSignal.timeout(10000)});
    const data=await result.json().catch(()=>null);
    if(!result.ok)throw Object.assign(new Error(result.status===400&&data?.message?.includes('giornalier')?data.message:'Limiti Oracolo non disponibili. Riprova più tardi.'),{statusCode:result.status===400?429:503});
    return {remaining:data};
}
