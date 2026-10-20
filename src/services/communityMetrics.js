import {supabase,isSupabaseConfigured} from './supabase.js';
const recorded=new Set();
export async function recordActivity(activity){
    if(!isSupabaseConfigured)return;
    try{
        const {data}=await supabase.auth.getSession();const user=data?.session?.user;if(!user)return;
        const key=`${user.id}:${new Date().toISOString().slice(0,10)}:${activity}`;if(recorded.has(key))return;
        const {error}=await supabase.from('community_activity').upsert({user_id:user.id,activity},{onConflict:'user_id,day,activity',ignoreDuplicates:true});
        if(!error)recorded.add(key);
    }catch{/* Measurement must never interrupt playing. */}
}
export function contributionScenario({active,conversion,ordersPerBuyer,basket,commission,costs}){
    const values=[active,conversion,ordersPerBuyer,basket,commission,costs];
    if(values.some(v=>!Number.isFinite(v)||v<0)||conversion>100||commission>100)throw new Error('Inserisci valori validi; le percentuali devono essere fra 0 e 100.');
    const buyers=active*conversion/100,gmv=buyers*ordersPerBuyer*basket,revenue=gmv*commission/100;
    return {buyers,gmv,revenue,contribution:revenue-costs};
}
