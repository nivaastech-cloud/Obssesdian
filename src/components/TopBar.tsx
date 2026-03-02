"use client";

import React from 'react';
import { 
  Search, 
  Network, 
  Settings, 
  Mic, 
  Upload, 
  Share2,
  Plus,
  FilePlus,
  FolderPlus
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../utils/cn';

export const TopBar = () => {
  const { 
    searchQuery, 
    setSearchQuery, 
    isGraphView, 
    toggleGraphView, 
    setImporting, 
    setRecording,
    addNote,
    addFolder
  } = useStore();

  return (
    <div className="h-14 border-b border-[#2c2c2c] bg-[#171717] flex items-center justify-between px-6 select-none z-40">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-[#999999] group cursor-pointer">
          <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all">
            <Share2 size={18} />
          </div>
          <span className="text-sm font-bold tracking-tight text-white">Lumina AI</span>
        </div>
        
        <div className="h-6 w-[1px] bg-[#2c2c2c]"></div>
        
        <div className="flex items-center gap-1">
          <button 
            onClick={() => addNote('New Note', '', null)}
            className="p-2 text-[#666666] hover:text-white hover:bg-[#2c2c2c] rounded-lg transition-all"
            title="New Note"
          >
            <FilePlus size={18} />
          </button>
          <button 
            onClick={() => addFolder('New Folder', null)}
            className="p-2 text-[#666666] hover:text-white hover:bg-[#2c2c2c] rounded-lg transition-all"
            title="New Folder"
          >
            <FolderPlus size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 max-w-xl mx-8">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666666] group-focus-within:text-indigo-400 transition-colors" size={16} />
          <input 
            type="text"
            placeholder="Search knowledge... (Ctrl+K)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#2c2c2c] border border-[#3f3f3f] rounded-xl py-2 pl-10 pr-4 text-sm text-[#d4d4d4] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all placeholder-[#666666]"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 bg-[#2c2c2c]/50 p-1 rounded-xl border border-[#2c2c2c]">
          <button 
            onClick={() => setImporting(true)}
            className="p-2 text-[#999999] hover:text-white hover:bg-[#2c2c2c] rounded-lg transition-all"
            title="Import Center"
          >
            <Upload size={18} />
          </button>
          <button 
            onClick={() => setRecording(true)}
            className="p-2 text-[#999999] hover:text-white hover:bg-[#2c2c2c] rounded-lg transition-all"
            title="Voice Capture"
          >
            <Mic size={18} />
          </button>
        </div>

        <div className="h-6 w-[1px] bg-[#2c2c2c]"></div>

        <button 
          onClick={toggleGraphView}
          className={cn(
            "p-2 rounded-xl transition-all border",
            isGraphView 
              ? "bg-indigo-600/20 text-indigo-400 border-indigo-500/30 shadow-lg shadow-indigo-600/10" 
              : "text-[#999999] hover:text-white hover:bg-[#2c2c2c] border-transparent"
          )}
          title="Toggle Graph View"
        >
          <Network size={20} />
        </button>
        
        <button className="p-2 text-[#999999] hover:bg-[#2c2c2c] hover:text-white rounded-xl transition-all">
          <Settings size={20} />
        </button>
      </div>
    </div>
  );
};
