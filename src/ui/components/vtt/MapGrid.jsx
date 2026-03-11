import React from 'react';
import { useGameStore } from '../../../store/gameStore';

const CM_PER_CELL = 150;

export default function MapGrid() {
    const { tokens } = useGameStore();
    
    const rows = 20;
    const cols = 30;

    return (
        <div className="relative shadow-2xl border-4 border-amber-900/30 rounded-lg overflow-hidden bg-black">
            {/* Immagine di Sfondo (Mappa) */}
            <img 
                src="https://via.placeholder.com/1200x800" // Sostituire con URL Appwrite
                className="block w-full h-auto opacity-80"
                alt="VTT Map"
            />

            {/* Griglia Overlay */}
            <div 
                className="absolute inset-0 grid" 
                style={{ 
                    gridTemplateColumns: `repeat(${cols}, 1fr)`,
                    gridTemplateRows: `repeat(${rows}, 1fr)` 
                }}
            >
                {Array.from({ length: rows * cols }).map((_, i) => (
                    <div key={i} className="border-[0.5px] border-white/5 hover:bg-white/10 transition-colors" />
                ))}

                {/* Render Token */}
                {tokens.map(token => (
                    <div 
                        key={token.$id}
                        className="absolute w-10 h-10 rounded-full border-2 border-amber-400 bg-cover shadow-lg cursor-grab active:cursor-grabbing"
                        style={{ 
                            left: `${token.x}px`, 
                            top: `${token.y}px`,
                            backgroundImage: `url(${token.imageUrl})` 
                        }}
                    >
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 text-[10px] px-2 py-0.5 rounded border border-white/20 whitespace-nowrap">
                            {token.name}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
