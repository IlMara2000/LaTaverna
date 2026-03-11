import React, { useState } from 'react';
import { authService } from '../../services/auth';
import { Link } from 'react-router-dom';

export default function Register() {
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await authService.register(formData.email, formData.password, formData.name);
      window.location.href = '/';
    } catch (err) {
      alert("Errore nella registrazione");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] p-6">
      <div className="w-full max-w-md glass p-8 rounded-3xl border border-white/5">
        <h2 className="text-2xl font-bold text-white mb-6">Inizia l'Avventura</h2>
        <form onSubmit={handleRegister} className="space-y-4">
          <input 
            type="text" placeholder="Nome Personaggio / Player"
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-amber-500/50"
            onChange={(e) => setFormData({...formData, name: e.target.value})}
          />
          <input 
            type="email" placeholder="Email"
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-amber-500/50"
            onChange={(e) => setFormData({...formData, email: e.target.value})}
          />
          <input 
            type="password" placeholder="Password (min. 8 caratteri)"
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-amber-500/50"
            onChange={(e) => setFormData({...formData, password: e.target.value})}
          />
          <button className="w-full bg-amber-600 py-4 rounded-2xl font-bold">Registrati</button>
        </form>
      </div>
    </div>
  );
}
