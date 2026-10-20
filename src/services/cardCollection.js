import {supabase} from './supabase.js';
import {getMagicAccount} from './magicLibrary.js';
export const CARD_GAMES=Object.freeze([{id:'mtg',name:'Magic / MTG'},{id:'pokemon',name:'Pokémon'},{id:'yugioh',name:'Yu-Gi-Oh!'},{id:'onepiece',name:'One Piece'}]);
const checked=({data,error})=>{if(error)throw new Error(error.message);return data;};
export async function loadCardCollection(){
    const user=await getMagicAccount();if(!user)throw new Error('Accedi per salvare e ritrovare la tua collezione.');
    const collection=checked(await supabase.from('magic_collections').select('id').eq('user_id',user.id).maybeSingle());
    const [extra,magic]=await Promise.all([
        supabase.from('tcg_cards').select('*').eq('user_id',user.id).order('created_at'),
        collection?supabase.from('magic_collection_cards').select('card_id,card_name,quantity,card_data').eq('collection_id',collection.id):Promise.resolve({data:[]})
    ]);
    return {userId:user.id,collectionId:collection?.id,cards:[...checked(extra),...checked(magic).map(c=>({id:c.card_id,game:'mtg',name:c.card_name,quantity:c.quantity,set_name:c.card_data?.set||'',language:c.card_data?.language||'',image:c.card_data?.image||'',oracleText:c.card_data?.oracleText||''}))]};
}
async function assertAccount(account){
    const {data,error}=await supabase.auth.getUser();
    if(error||data?.user?.id!==account?.userId)throw new Error('L’account è cambiato. Aggiorna la collezione prima di continuare.');
}
export async function saveCollectedCard(account,item){
    await assertAccount(account);
    if(!CARD_GAMES.some(g=>g.id===item.game)||!String(item.name).trim())throw new Error('Conferma il gioco e il nome della carta.');
    const quantity=Math.min(99,Math.max(1,parseInt(item.quantity)||1));
    if(item.game==='mtg'){
        const response=await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(item.name.trim())}`);
        if(!response.ok)throw new Error('Carta Magic non identificata con certezza. Correggi il nome oppure usa l’importazione Magic.');
        const c=await response.json();
        // Named lookup identifies the card, not a photographed printing. Do not claim exact printing recognition.
        let collectionId=account.collectionId;
        if(!collectionId){const row=checked(await supabase.from('magic_collections').upsert({user_id:account.userId},{onConflict:'user_id'}).select('id').single());collectionId=row.id;account.collectionId=collectionId;}
        const existing=checked(await supabase.from('magic_collection_cards').select('quantity').eq('collection_id',collectionId).eq('card_id',c.id).maybeSingle());
        checked(await supabase.from('magic_collection_cards').upsert({collection_id:collectionId,card_id:c.id,card_name:c.name,quantity:Math.min(99,(existing?.quantity||0)+quantity),card_data:{name:c.name,image:c.image_uris?.normal||c.card_faces?.[0]?.image_uris?.normal||'',oracleText:c.oracle_text||'',typeLine:c.type_line||'',manaCost:c.mana_cost||'',set:c.set_name||'',language:c.lang||'en',oracleId:c.oracle_id||'',colors:c.colors||[],colorIdentity:c.color_identity||[],cmc:c.cmc||0},updated_at:new Date().toISOString()},{onConflict:'collection_id,card_id'}));
        return;
    }
    checked(await supabase.from('tcg_cards').insert({user_id:account.userId,game:item.game,name:item.name.trim().slice(0,160),set_name:String(item.set||'').slice(0,160),card_number:String(item.number||'').slice(0,80),language:String(item.language||'it').slice(0,20),quantity}));
}
export async function removeCollectedCard(account,card){
    await assertAccount(account);
    if(card.game==='mtg')throw new Error('Gestisci quantità e rimozioni Magic nella collezione MTG, per mantenere coerenti i mazzi.');
    checked(await supabase.from('tcg_cards').delete().eq('user_id',account.userId).eq('id',card.id));
}
