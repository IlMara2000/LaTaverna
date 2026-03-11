import React from 'react';
import Sidebar from './sidebar';

export default function Layout({ children }) {
  return (
    <div className="flex h-screen bg-[#0a0a0a] overflow-hidden">
      {/* Sidebar fissa a sinistra */}
      <Sidebar />
      
      {/* Area Contenuto Principale */}
      <main className="flex-1 relative flex flex-col min-w-0 bg-[radial-gradient(ellipse_at_top,_#1a1a1a_0%,_#0a0a0a_100%)]">
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
