"use client";
import React, { useState } from 'react';
import { account } from '../api/appwrite';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Effettua il login su Appwrite
            await account.createEmailPasswordSession(email, password);
            router.push('/tabletop');
        } catch (err) {
            alert("Errore: Credenziali non valide o utente inesistente!");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-screen items-center justify-center bg-[radial-gradient(circle_at_center,_#1a1a1a_0%,_#050505_100%)]">
            
            {/* Header d'impatto */}
            <div className="text-center mb-10">
                <h1 className="text-6xl font-black italic tracking-tighter text-amber-500 drop-shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                    T.ALVERNA
                </h1>
                <p className="text-gray-400 uppercase tracking-[0.4em] text-[10px] mt-2">
                    La Taverna Protetta VTT
                </p>
            </div>

            {/* Box di Login con effetto Glass */}
            <div className="glass p-10 rounded-[2rem] border border-amber-900/20 w-full max-w-sm shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                        <input 
                            type="email" 
                            placeholder="Email del Viandante" 
                            required
                            className="w-full p-4 rounded-xl bg-white/5 border border-white/10 focus:border-amber-500/50 focus:outline-none transition-all placeholder:text-gray-600"
                            onChange={e => setEmail(e.target.value)} 
                        />
                    </div>
                    <div>
                        <input 
                            type="password" 
                            placeholder="Parola d'ordine" 
                            required
                            className="w-full p-4 rounded-xl bg-white/5 border border-white/10 focus:border-amber-500/50 focus:outline-none transition-all placeholder:text-gray-600"
                            onChange={e => setPassword(e.target.value)} 
                        />
                    </div>
                    
                    <button 
                        type="submit"
                        disabled={loading}
                        className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 text-white font-bold py-4 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-amber-900/20 uppercase tracking-widest text-sm"
                    >
                        {loading ? "Entrando..." : "Entra nella Locanda"}
                    </button>
                </form>

                <p className="text-center text-gray-500 text-[10px] mt-6 uppercase tracking-tight">
                    L'accesso è riservato ai membri della gilda
                </p>
            </div>
            
            {/* Footer */}
            <div className="absolute bottom-10 text-[9px] text-gray-600 uppercase tracking-[0.5em] font-medium">
                Powered by Groq AI & Appwrite
            </div>
        </div>
    );
}
