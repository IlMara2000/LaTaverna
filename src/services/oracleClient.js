import {supabase,isSupabaseConfigured} from './supabase.js';
export async function oracleHeaders(){
    if(!isSupabaseConfigured)throw new Error('Configura l’accesso alla Taverna per usare l’Oracolo.');
    let {data}=await supabase.auth.getSession();
    if(!data?.session){const result=await supabase.auth.signInAnonymously();if(result.error)throw new Error('Accedi alla Taverna per usare l’Oracolo.');data=result.data;}
    return {'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`};
}
export async function postOracle(url,payload,{signal}={}){
    const headers=await oracleHeaders();
    const response=await fetch(url,{method:'POST',headers,body:JSON.stringify(payload),signal});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||data.ok!==true)throw new Error(data.error||'L’Oracolo non è raggiungibile. Riprova tra poco.');
    return data;
}
export function readOracleImage(file){
    if(!['image/jpeg','image/png','image/webp'].includes(file?.type)||file.size>2*1024*1024)throw new Error('Scegli una foto JPG, PNG o WebP fino a 2 MB.');
    return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Immagine non leggibile.'));reader.readAsDataURL(file);});
}
