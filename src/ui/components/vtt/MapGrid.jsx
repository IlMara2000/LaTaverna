"use client";
import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../../store/gameStore';
import { databases, DB_CONFIG } from '../../../api/appwrite';

export default function MapGrid() {
    const { tokens, setTokens, updateToken } = useGameStore();
    const [mapImageUrl, setMapImageUrl] = useState('https://via.placeholder.com/1200x800'); 

    // Dimensioni griglia
    const rows = 20;
    const cols = 30;

    // 1. Caricamento Iniziale (Mappa + Token)
    useEffect(() => {
        const initMap = async () => {
            try {
                // Carica i token
                const res = await databases.listDocuments(DB_CONFIG.dbId, DB_CONFIG.colTokens);
                setTokens(res.documents);

                // Carica la mappa attiva
                const maps = await databases.listDocuments(DB_CONFIG.dbId, DB_CONFIG.colMaps);
                if (maps.documents.length > 0) {
                    // Prendi l'URL dell'ultima mappa caricata
                    setMapImageUrl(maps.documents[maps.documents.length - 1].imageUrl);
                }
            } catch (err) {
                console.error("Errore inizializzazione VTT:", err);
            }
        };
        initMap();
    }, [setTokens]);

    // 2. Gestione del Drag & Drop (Trascinamento)
    const handleDragEnd = async (tokenId, e) => {
        const rect = e.currentTarget.parentElement.getBoundingClientRect();
        
        // Calcolo posizione in percentuale (%) per mantenere la precisione su ogni schermo
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        // Aggiornamento immediato nello Store (Zustand)
        updateToken(tokenId, { x, y });

        // Sincronizzazione con il Backend Appwrite
        try {
            await databases.updateDocument(DB_CONFIG.dbId, DB_CONFIG.colTokens, tokenId, { x, y });
        } catch (err) {
            console.error("Errore salvataggio posizione token:", err);
        }
    };

    return (
        <div className="relative w-[95vh] aspect-[3/2] shadow-2xl border-4 border-amber-900/30 rounded-lg overflow-hidden bg-black">
            
            {/* Background: La Mappa di Battaglia */}
            <img 
                src={mapImageUrl} 
                className="absolute inset-0 w-full h-full object-cover opacity-90 select-none"
                alt="VTT Battlemap"
                draggable="false"
            />

            {/* Overlay Griglia Dinamica */}
            <div 
                className="absolute inset-0 grid pointer-events-none" 
                style={{ 
                    gridTemplateColumns: `repeat(${cols}, 1fr)`,
                    gridTemplateRows: `repeat(${rows}, 1fr)` 
                }}
            >
                {Array.from({ length: rows * cols }).map((_, i) => (
                    <div key={i} className="border-[0.5px] border-white/5" />
                ))}
            </div>

            {/* Layer dei Token (Personaggi/Mostri) */}
            <div className="absolute inset-0">
                {tokens.map((token) => (
                    <div
                        key={token.$id}
                        draggable
                        onDragEnd={(e) => handleDragEnd(token.$id, e)}
                        className="absolute w-12 h-12 -ml-6 -mt-6 cursor-grab active:cursor-grabbing transition-transform active:scale-110 group"
                        style={{ left: `${token.x}%`, top: `${token.y}%` }}
                    >
                        {/* Immagine Token Circolare */}
                        <div 
                            className={`w-full h-full rounded-full border-2 shadow-2xl bg-cover bg-center ${
                                token.type === 'enemy' ? 'border-red-600 shadow-red-900/50' : 'border-amber-400 shadow-amber-900/50'
                            }`}
                            style={{ backgroundImage: `url(${token.avatarUrl || token.imageUrl})` }}
                        />
                        
                        {/* Label Nome (appare in Hover) */}
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/90 text-white text-[10px] px-2 py-0.5 rounded border border-amber-900/50 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                            {token.name}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
