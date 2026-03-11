import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { authService } from './services/auth';
import Layout from './ui/components/layout';
import Login from './ui/pages/login';
import Register from './ui/pages/register';
import Tabletop from './ui/pages/Tabletop'; // Quello creato prima
import './style.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Controlla se l'utente è già loggato all'avvio
    authService.getCurrentUser()
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="text-amber-500 animate-pulse font-bold tracking-widest">CARICAMENTO TAVERNA...</div>
    </div>
  );

  return (
    <BrowserRouter>
      <Routes>
        {/* Rotte Pubbliche */}
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />

        {/* Rotte Protette (Taverna) */}
        <Route path="/" element={
          user ? (
            <Layout>
              <Tabletop user={user} />
            </Layout>
          ) : (
            <Navigate to="/login" />
          )
        } />
      </Routes>
    </BrowserRouter>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);
