import React, { useState } from 'react';
import { authService } from '../../services/auth';
import { Link } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await authService.login(email, password);
      window.location.href = '/';
    } catch (err) {
      alert("Errore: Credenziali non valide");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] p-6">
      <div className="w-full max-w-md glass p-8 rounded-3xl shadow-2xl border border-white/5">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-white tracking-tighter mb-2">LA TAVERNA</h1>
          <p className="text-gray-500 text-sm uppercase tracking-widest">Bentornato, Viandante</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-amber-500 uppercase mb-2 ml-1">Email</label>
            <input 
              type="email" 
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-amber-500/50 transition-all"
              placeholder="tuo@email.com"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-amber-500 uppercase mb-2 ml-1">Password</label>
            <input 
              type="password" 
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-amber-500/50 transition-all"
              placeholder="••••••••"
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-amber-900/20 transition-all transform active:scale-[0.98]">
            Entra nel Gioco
          </button>
        </form>

        <p className="text-center mt-8 text-gray-500 text-sm">
          Nuovo qui? <Link to="/register" className="text-amber-500 hover:underline">Crea un account</Link>
        </p>
      </div>
    </div>
  );
}
