import { create } from 'zustand';

export const useGameStore = create((set) => ({
    tokens: [],
    setTokens: (tokens) => set({ tokens }),
    updateToken: (tokenId, data) => set((state) => ({
        tokens: state.tokens.map(t => t.$id === tokenId ? { ...t, ...data } : t)
    })),
    addToken: (token) => set((state) => ({ tokens: [...state.tokens, token] })),
}));
