"use client";
import React, { useState } from 'react';
import { authService } from '../services/auth';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await authService.login(email, password);
      router.push('/tabletop'); // Ti manda al gioco dopo il login
    } catch (err) {
      alert("Errore nell'accesso. Controlla le credenziali.");
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-[#050505]">
      <div className="glass p-10 rounded-3xl w-full max-w-sm border border-white/10 shadow-2xl">
        <h1 className="text-3xl font-black text-center mb-8 tracking-tighter italic">TAVERNA PROTETTA</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input 
            type="email" 
            placeholder="Email" 
            className="w-full p-4 rounded-xl bg-white/5 border border-white/10 focus:border-amber-500 outline-none"
            onChange={e => setEmail(e.target.value)}
          />
          <input 
            type="password" 
            placeholder="Password" 
            className="w-full p-4 rounded-xl bg-white/5 border border-white/10 focus:border-amber-500 outline-none"
            onChange={e => setPassword(e.target.value)}
          />
          <button className="w-full bg-amber-600 hover:bg-amber-500 py-4 rounded-xl font-bold transition-all shadow-lg shadow-amber-900/40">
            ENTRA
          </button>
        </form>
      </div>
    </div>
  );
}
