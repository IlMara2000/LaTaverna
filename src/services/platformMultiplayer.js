import { supabase } from './supabase.js';
import { createMinigameRoom, joinMinigameRoom, getSavedMinigameRoom, getMinigameRoomByCode, clearSavedMinigameRoom, watchMinigameRoom, getMinigameClientId, getRoomParticipants } from './minigameMultiplayer.js';

let room = null, stopWatch = null, timer = null, polling = false, generation = 0;
const listeners = new Set();
const emit = error => listeners.forEach(fn => fn({room, error: error || null}));
function accept(next) { room=next; emit(); }
export const currentPlatformRoom = () => room || getSavedMinigameRoom();
export async function refreshPlatformRoom() {
    const saved=currentPlatformRoom();
    if (!saved?.code) return null;
    const version=generation;
    const result=await getMinigameRoomByCode(saved.code);
    if(version!==generation)return room;
    if(result.error){emit(result.error);throw result.error;}
    if(!result.room || result.room.status==='closed') { disconnectLocal(); return null; }
    accept(result.room);return result.room;
}
function disconnectLocal() {
    generation++;stopWatch?.();stopWatch=null;clearInterval(timer);timer=null;room=null;
    clearSavedMinigameRoom();window.__tavernaMultiplayerConnection=null;emit();
}
function watch(next) {
    generation++;stopWatch?.();clearInterval(timer);accept(next);
    const version=generation;
    stopWatch=watchMinigameRoom(next.code,value=>{if(version!==generation)return;if(value?.status==='closed')disconnectLocal();else accept(value);});
    timer=setInterval(async()=>{if(polling)return;polling=true;try{await refreshPlatformRoom();}catch{}finally{polling=false;}},3000);
}
export function subscribePlatformRoom(listener) {
    listeners.add(listener);listener({room:currentPlatformRoom(),error:null});
    if(!timer&&currentPlatformRoom())watch(currentPlatformRoom());
    return ()=>listeners.delete(listener);
}
export async function createPlatformRoom() {
    if(currentPlatformRoom())throw new Error('Lascia il collegamento attuale prima di crearne un altro.');
    const result=await createMinigameRoom({scope:'platform'});
    if(result.error||!result.room)throw result.error||new Error('Collegamento non creato.');
    watch(result.room);return result.room;
}
export async function joinPlatformRoom(code) {
    if(currentPlatformRoom()&&currentPlatformRoom().code!==String(code).trim().toUpperCase())throw new Error('Lascia prima il collegamento attuale.');
    const result=await joinMinigameRoom(code);
    if(result.error||!result.room)throw result.error||new Error('Collegamento non riuscito.');
    watch(result.room);return result.room;
}
export async function leavePlatformRoom() {
    const current=currentPlatformRoom();
    if(current){const {error}=await supabase.rpc('leave_platform_room',{p_code:current.code});if(error)throw error;}
    disconnectLocal();
}
export async function requirePlatformRoom() {
    const current=await refreshPlatformRoom();
    if(!current)throw new Error('Collegati prima dalla sezione Multiplayer.');
    if(!getRoomParticipants(current).includes(getMinigameClientId()))throw new Error('Rientra nel collegamento dalla sezione Multiplayer.');
    return current;
}
export async function openPlatformDnd(container) {
    const current=await requirePlatformRoom();
    if(!current.dndSessionId)throw new Error('Il Master deve aprire una sessione D&D e premere Online per condividerla.');
    const {resetAppSurface}=await import('./appNavigation.js');
    const {showSession}=await import('../components/features/tabletop/Session.js');
    resetAppSurface();await showSession(container,current.dndSessionId,{systemId:'dnd5e',platformRoomCode:current.code});
}
export async function sharePlatformDnd(sessionId) {
    const current=await requirePlatformRoom();
    const {error}=await supabase.rpc('link_platform_dnd_room',{p_code:current.code,p_session_id:sessionId});
    if(error)throw error;
    return refreshPlatformRoom();
}
let account;
supabase.auth.onAuthStateChange?.((event,session)=>{
    const next=session?.user?.id;
    if(event==='SIGNED_OUT'||(account&&next&&account!==next))disconnectLocal();
    account=next;
});
