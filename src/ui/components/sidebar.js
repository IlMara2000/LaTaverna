import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { authService } from '../../services/auth';

export default function Sidebar() {
  const location = useLocation();

  const menuItems = [
    { name: 'Taverna', path: '/', icon: '🏰' },
    { name: 'Dashboard', path: '/admin', icon: '⚙️' },
    { name: 'Personaggi', path: '/characters', icon: '👤' },
  ];

  return (
    <nav className="w-64 h-full bg-[#0d0d0d] border-r border-white/5 flex flex-col p-6">
      <div className="mb-10 px-2">
        <h2 className="text-xl font-black text-white tracking-tighter italic">LA TAVERNA</h2>
      </div>

      <div className="flex-1 space-y-2">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-bold text-sm ${
              location.pathname === item.path 
                ? 'bg-amber-600/10 text-amber-500 border border-amber-600/20' 
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <span>{item.icon}</span>
            {item.name}
          </Link>
        ))}
      </div>

      <button 
        onClick={() => authService.logout().then(() => window.location.reload())}
        className="mt-auto flex items-center gap-3 px-4 py-3 rounded-2xl text-red-500/70 hover:text-red-500 hover:bg-red-500/5 transition-all font-bold text-sm"
      >
        <span>🚪</span> Esci
      </button>
    </nav>
  );
}
