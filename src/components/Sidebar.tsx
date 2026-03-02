"use client";

import React, { useState, useMemo } from 'react';
import { 
  Folder as FolderIcon, 
  FileText, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  FolderPlus, 
  Trash2, 
  Edit2,
  Search,
  Mic,
  Upload
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { LuminaFolder, LuminaNote } from '../types/index';
import { cn } from '../utils/cn';

export const Sidebar = () => {
  const { 
    folders, 
    notes, 
    activeNoteId, 
    addFolder, 
    addNote, 
    setActiveNote, 
    deleteFolder, 
    deleteNote, 
    updateFolder, 
    searchQuery,
    setImporting,
    setRecording
  } = useStore();
  
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['f1', 'f2', 'f3']));
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const toggleFolder = (id: string) => {
    const next = new Set(expandedFolders);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedFolders(next);
  };

  const startEditing = (folder: LuminaFolder) => {
    setEditingFolderId(folder.id);
    setEditName(folder.name);
  };

  const saveEdit = async () => {
    if (editingFolderId && editName.trim()) {
      await updateFolder(editingFolderId, editName.trim());
    }
    setEditingFolderId(null);
  };

  const filteredNotes = useMemo(() => {
    if (!searchQuery) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter(n => 
      n.title.toLowerCase().includes(q) || 
      n.content.toLowerCase().includes(q)
    );
  }, [notes, searchQuery]);

  const renderTree = (parentId: string | null = null, depth = 0) => {
    const currentFolders = folders.filter(f => f.parentId === parentId);
    const currentNotes = filteredNotes.filter(n => n.folderId === parentId);

    if (searchQuery && parentId === null) {
      return (
        <div className="flex flex-col">
          <div className="text-[10px] font-bold text-[#666666] uppercase mb-2 px-2">Search Results</div>
          {filteredNotes.map(note => (
            <div 
              key={note.id}
              onClick={() => setActiveNote(note.id)}
              className={cn(
                "group flex items-center py-1 px-2 hover:bg-[#2c2c2c] cursor-pointer rounded-md text-[#999999] hover:text-[#ffffff] transition-colors",
                activeNoteId === note.id && "bg-[#2c2c2c] text-[#ffffff]"
              )}
            >
              <FileText size={14} className="mr-2 text-[#666666]" />
              <span className="text-sm truncate flex-1">{note.title}</span>
            </div>
          ))}
          {filteredNotes.length === 0 && (
            <div className="text-xs text-[#666666] italic px-2">No matches found</div>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col">
        {currentFolders.map(folder => (
          <div key={folder.id} className="flex flex-col">
            <div 
              className={cn(
                "group flex items-center py-1 px-2 hover:bg-[#2c2c2c] cursor-pointer rounded-md text-[#999999] hover:text-[#ffffff] transition-colors",
                depth > 0 && "ml-4"
              )}
            >
              <div onClick={() => toggleFolder(folder.id)} className="flex items-center flex-1">
                {expandedFolders.has(folder.id) ? <ChevronDown size={14} className="mr-1" /> : <ChevronRight size={14} className="mr-1" />}
                <FolderIcon size={14} className="mr-2 text-[#666666]" />
                {editingFolderId === folder.id ? (
                  <input 
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={saveEdit}
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                    className="bg-[#3f3f3f] text-[#ffffff] text-sm rounded px-1 outline-none w-full"
                  />
                ) : (
                  <span className="text-sm truncate">{folder.name}</span>
                )}
              </div>
              <div className="hidden group-hover:flex items-center gap-1">
                <button onClick={() => addNote('New Note', '', folder.id)} title="New Note"><Plus size={12} /></button>
                <button onClick={() => addFolder('New Folder', folder.id)} title="New Subfolder"><FolderPlus size={12} /></button>
                <button onClick={() => startEditing(folder)} title="Rename Folder"><Edit2 size={12} /></button>
                <button onClick={() => deleteFolder(folder.id)} title="Delete Folder"><Trash2 size={12} /></button>
              </div>
            </div>
            {expandedFolders.has(folder.id) && renderTree(folder.id, depth + 1)}
          </div>
        ))}
        {currentNotes.map(note => (
          <div 
            key={note.id}
            onClick={() => setActiveNote(note.id)}
            className={cn(
              "group flex items-center py-1 px-2 hover:bg-[#2c2c2c] cursor-pointer rounded-md text-[#999999] hover:text-[#ffffff] transition-colors",
              depth > 0 && "ml-4",
              activeNoteId === note.id && "bg-[#2c2c2c] text-[#ffffff]"
            )}
          >
            <FileText size={14} className="mr-2 text-[#666666]" />
            <span className="text-sm truncate flex-1">{note.title}</span>
            <button 
              onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }} 
              className="hidden group-hover:block text-[#666666] hover:text-red-400"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="w-64 h-full bg-[#171717] border-r border-[#2c2c2c] flex flex-col overflow-hidden select-none">
      <div className="p-4 flex items-center justify-between border-b border-[#2c2c2c]">
        <h2 className="text-xs font-bold uppercase tracking-widest text-[#666666]">Explorer</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
        {renderTree(null)}
      </div>
    </div>
  );
};
