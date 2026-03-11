import React, { useState } from 'react';
import { uploadAsset } from '../../lib/uploadService';
import { databases, ID } from '../../api/appwrite';

export default function AdminDashboard() {
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('maps');

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      // Carichiamo su Appwrite Storage (Bucket ID va creato nella console)
      const asset = await uploadAsset(file, 'vtt_assets');
      
      // Salviamo il riferimento nel Database
      await databases.createDocument('IL_TUO_DB_ID', 'COLLECTION_MAPS_ID', ID.unique(), {
        name: file.name,
        imageUrl: asset.url,
        type: type // 'map' o 'token'
      });
      alert('Caricamento completato!');
    } catch (err) {
      alert('Errore durante l\'upload');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-white">DM CONTROL PANEL</h1>
          <p className="text-amber-500 text-xs font-bold tracking-widest uppercase">Gestione Campagna</p>
        </div>
      </header>

      {/* Selettore Tab */}
      <div className="flex gap-4 border-b border-white/10 pb-4">
        {['maps', 'tokens', 'audio'].map(t => (
          <button 
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-bold uppercase transition-all ${activeTab === t ? 'bg-amber-600 text-white' : 'text-gray-500 hover:text-white'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Area Upload */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass p-6 rounded-3xl border border-white/5 flex flex-col items-center justify-center min-h-[200px] border-dashed border-2">
          <input 
            type="file" 
            id="file-upload" 
            className="hidden" 
            onChange={(e) => handleFileUpload(e, activeTab)} 
          />
          <label htmlFor="file-upload" className="cursor-pointer text-center">
            <div className="bg-amber-900/20 p-4 rounded-full mb-4 inline-block">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <p className="text-white font-bold text-lg">{uploading ? 'Caricamento...' : `Aggiungi ${activeTab}`}</p>
            <p className="text-gray-500 text-xs mt-2">Trascina qui o clicca per sfogliare</p>
          </label>
        </div>

        {/* Preview Rapida */}
        <div className="glass p-6 rounded-3xl border border-white/5">
          <h3 className="text-white font-bold mb-4 uppercase text-xs tracking-widest text-amber-500">Asset Caricati Recentemente</h3>
          <div className="space-y-2">
             <div className="flex items-center gap-3 p-2 bg-white/5 rounded-xl border border-white/5">
                <div className="w-10 h-10 bg-black rounded-lg"></div>
                <div className="flex-1">
                   <p className="text-xs text-white font-medium">mappa_taverna_notte.png</p>
                   <p className="text-[10px] text-gray-500">1.2 MB</p>
                </div>
             </div>
             {/* Qui andrà il map() degli asset presi dal DB */}
          </div>
        </div>
      </div>
    </div>
  );
}
