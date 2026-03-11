import React, { useEffect } from 'react';
import MapGrid from '../components/vtt/MapGrid';
import Sidebar from '../components/vtt/Sidebar';
import { client } from '../../api/appwrite';
import { useGameStore } from '../../store/gameStore';

export default function Tabletop() {
    const { currentSession, setTokens } = useGameStore();

    useEffect(() => {
        // Sottoscrizione Realtime ai Token
        const unsubscribe = client.subscribe(
            `databases.IL_TUO_DB_ID.collections.tokens.documents`,
            (response) => {
                if (response.events.includes('*.update')) {
                    useGameStore.getState().updateToken(response.payload.$id, response.payload);
                }
            }
        );
        return () => unsubscribe();
    }, []);

    return (
        <div className="flex h-screen w-screen bg-[#0f0f0f] text-gray-100 overflow-hidden">
            {/* Area Mappa */}
            <main className="flex-1 relative overflow-auto p-4 flex justify-center items-center bg-[radial-gradient(circle,_#1a1a1a_0%,_#0f0f0f_100%)]">
                <MapGrid />
            </main>

            {/* Sidebar Destra */}
            <aside className="w-80 border-l border-white/10 bg-[#161616] flex flex-col">
                <Sidebar />
            </aside>
        </div>
    );
}
