import { create } from 'zustand';

export const useGameStore = create((set) => ({
    // Stato iniziale
    tokens: [],
    currentMap: null,

    // Funzioni per aggiornare lo stato
    setTokens: (newTokens) => set({ tokens: newTokens }),
    
    updateToken: (tokenId, data) => set((state) => ({
        tokens: state.tokens.map(t => 
            t.$id === tokenId ? { ...t, ...data } : t
        )
    })),

    setMap: (mapUrl) => set({ currentMap: mapUrl }),
}));
