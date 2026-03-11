"use client";
import React, { useState } from 'react';
import { account } from '../api/appwrite';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await account.createEmailPasswordSession(email, password);
      router.push('/tabletop');
    } catch (err) {
      alert("Errore: controlla email e password!");
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-black">
      <div className="glass p-8 rounded-3xl border border-white/10 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-amber-500 text-center mb-6 italic">LA TAVERNA PROTETTA</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input 
            type="email" 
            placeholder="Email" 
            className="w-full p-4 rounded-xl bg-white/5 border border-white/10"
            onChange={e => setEmail(e.target.value)} 
          />
          <input 
            type="password" 
            placeholder="Password" 
            className="w-full p-4 rounded-xl bg-white/5 border border-white/10"
            onChange={e => setPassword(e.target.value)} 
          />
          <button className="w-full bg-amber-600 py-4 rounded-xl font-bold">ENTRA</button>
        </form>
      </div>
    </div>
  );
}
