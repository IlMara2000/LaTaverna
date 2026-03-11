import { create } from 'zustand';

export const useGameStore = create((set) => ({
    currentSession: null,
    tokens: [],
    setSession: (session) => set({ currentSession: session }),
    setTokens: (tokens) => set({ tokens }),
    updateToken: (tokenId, data) => set((state) => ({
        tokens: state.tokens.map(t => t.$id === tokenId ? { ...t, ...data } : t)
    })),
}));
