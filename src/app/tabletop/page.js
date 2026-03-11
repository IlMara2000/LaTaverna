"use client";
import React, { useEffect } from 'react';
import MapGrid from '../../ui/components/vtt/MapGrid';
import AIChatPanel from '../../ui/components/aichatpanel';
import DiceRoller from '../../ui/components/vtt/DiceRoller';
import { client, DB_CONFIG } from '../../api/appwrite';
import { useGameStore } from '../../store/gameStore';

export default function TabletopPage() {
    const { updateToken } = useGameStore();

    useEffect(() => {
        const unsubscribe = client.subscribe(
            `databases.${DB_CONFIG.dbId}.collections.${DB_CONFIG.colTokens}.documents`,
            (response) => {
                if (response.events.includes('*.update')) {
                    updateToken(response.payload.$id, response.payload);
                }
            }
        );
        return () => unsubscribe();
    }, [updateToken]);

    return (
        <div className="flex h-screen w-screen overflow-hidden">
            <main className="flex-1 relative flex items-center justify-center bg-[#111]">
                <MapGrid />
                <div className="absolute bottom-6 w-full max-w-md z-20">
                    <DiceRoller />
                </div>
            </main>
            <aside className="w-80 border-l border-white/10 bg-[#0d0d0d]">
                <AIChatPanel />
            </aside>
        </div>
    );
}
