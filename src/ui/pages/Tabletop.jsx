import React, { useEffect } from 'react';
import MapGrid from '../components/vtt/MapGrid';
import AIChatPanel from '../components/aichatpanel'; 
import DiceRoller from '../components/vtt/DiceRoller';
import { client, DB_CONFIG } from '../../api/appwrite';
import { useGameStore } from '../../store/gameStore';
import { useAuthStore } from '../../store/authStore';

export default function Tabletop() {
    // Recuperiamo l'utente dallo store dell'autenticazione
    const { user } = useAuthStore();
    // Recuperiamo le funzioni di gioco dallo store della sessione
    const { updateToken } = useGameStore();

    useEffect(() => {
        // Sottoscrizione Realtime: aggiorna la mappa quando qualcuno muove un token
        const unsubscribe = client.subscribe(
            `databases.${DB_CONFIG.dbId}.collections.${DB_CONFIG.colTokens}.documents`,
            (response) => {
                // Se un documento viene aggiornato, sincronizziamo lo stato locale
                if (response.events.includes('*.update')) {
                    updateToken(response.payload.$id, response.payload);
                }
            }
        );

        return () => unsubscribe();
    }, [updateToken]);

    return (
        <div className="flex h-screen w-screen bg-[#0f0f0f] text-gray-100 overflow-hidden font-sans">
            
            {/* AREA DI GIOCO (SINISTRA) */}
            <main className="flex-1 relative overflow-hidden flex flex-col justify-center items-center bg-[radial-gradient(circle,_#1a1a1a_0%,_#0f0f0f_100%)]">
                
                {/* La Mappa */}
                <div className="relative z-10">
                    <MapGrid />
                </div>

                {/* Overlay Dadi: Posizionato sopra la mappa in basso */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-20">
                    <DiceRoller 
                        username={user?.name || "Viandante"} 
                        sessionId={DB_CONFIG.dbId} 
                    />
                </div>

                {/* Info Sessione (opzionale, in alto a sinistra) */}
                <div className="absolute top-6 left-6 z-20">
                    <p className="text-[10px] text-amber-500 font-black uppercase tracking-[0.2em] mb-1">Sessione Attiva</p>
                    <h2 className="text-xl font-bold text-white italic">La Taverna Protetta</h2>
                </div>
            </main>

            {/* SIDEBAR (DESTRA): Chat e T.Alverna */}
            <aside className="w-80 border-l border-white/10 bg-[#121212] flex flex-col z-30 shadow-2xl">
                <AIChatPanel user={user} />
            </aside>

        </div>
    );
}
