import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { LuminaFolder, LuminaNote, SourceType } from '../types/index';
import { db } from '../db';
import { ImportResult } from '../services/import';

interface LuminaState {
  folders: LuminaFolder[];
  notes: LuminaNote[];
  activeNoteId: string | null;
  selectedNoteId: string | null;
  isGraphView: boolean;
  searchQuery: string;
  isImporting: boolean;
  isRecording: boolean;
  
  // Initialization
  initialize: () => Promise<void>;
  
  // Folder Actions
  addFolder: (name: string, parentId?: string | null) => Promise<string>;
  deleteFolder: (id: string) => Promise<void>;
  updateFolder: (id: string, name: string) => Promise<void>;
  
  // Note Actions
  addNote: (title: string, content: string, folderId?: string | null, sourceType?: SourceType) => Promise<string>;
  deleteNote: (id: string) => Promise<void>;
  updateNote: (id: string, updates: Partial<LuminaNote>) => Promise<void>;
  setActiveNote: (id: string | null) => void;
  setSelectedNote: (id: string | null) => void;
  
  // UI Actions
  toggleGraphView: () => void;
  setSearchQuery: (query: string) => void;
  setImporting: (status: boolean) => void;
  setRecording: (status: boolean) => void;
  
  // Knowledge logic
  handleWikiLink: (title: string) => Promise<string>;
  processImportResult: (result: ImportResult) => Promise<string[]>;
}

export const useStore = create<LuminaState>((set, get) => ({
  folders: [],
  notes: [],
  activeNoteId: null,
  selectedNoteId: null,
  isGraphView: false,
  searchQuery: '',
  isImporting: false,
  isRecording: false,

  initialize: async () => {
    const folders = await db.folders.toArray();
    const notes = await db.notes.toArray();
    
    // Create default folders if none exist
    if (folders.length === 0) {
      const defaultFolders: LuminaFolder[] = [
        { id: 'f1', name: 'General', parentId: null, createdAt: Date.now() },
        { id: 'f2', name: 'Imports', parentId: null, createdAt: Date.now() },
        { id: 'f3', name: 'Voice Notes', parentId: null, createdAt: Date.now() },
      ];
      await db.folders.bulkAdd(defaultFolders);
      set({ folders: defaultFolders, notes });
    } else {
      set({ folders, notes });
    }
  },

  addFolder: async (name, parentId = null) => {
    const newFolder: LuminaFolder = {
      id: uuidv4(),
      name,
      parentId,
      createdAt: Date.now(),
    };
    await db.folders.add(newFolder);
    set((state) => ({ folders: [...state.folders, newFolder] }));
    return newFolder.id;
  },

  deleteFolder: async (id) => {
    await db.folders.delete(id);
    // Move notes to root
    await db.notes.where('folderId').equals(id).modify({ folderId: null });
    const folders = await db.folders.toArray();
    const notes = await db.notes.toArray();
    set({ folders, notes });
  },

  updateFolder: async (id, name) => {
    await db.folders.update(id, { name });
    const folders = await db.folders.toArray();
    set({ folders });
  },

  addNote: async (title, content, folderId = null, sourceType = 'manual') => {
    const id = uuidv4();
    const newNote: LuminaNote = {
      id,
      title,
      content,
      folderId,
      sourceType,
      linksTo: [],
      backlinks: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.notes.add(newNote);
    set((state) => ({ 
      notes: [...state.notes, newNote],
      activeNoteId: id,
      selectedNoteId: id
    }));
    return id;
  },

  deleteNote: async (id) => {
    await db.notes.delete(id);
    // Remove backlinks from other notes
    await db.notes.where('linksTo').equals(id).modify(note => {
      note.linksTo = note.linksTo.filter(l => l !== id);
    });
    const notes = await db.notes.toArray();
    set((state) => ({ 
      notes,
      activeNoteId: state.activeNoteId === id ? null : state.activeNoteId,
      selectedNoteId: state.selectedNoteId === id ? null : state.selectedNoteId
    }));
  },

  updateNote: async (id, updates) => {
    const currentNotes = get().notes;
    const note = currentNotes.find(n => n.id === id);
    if (!note) return;

    const updatedNote = { ...note, ...updates, updatedAt: Date.now() };
    
    // If content changed, parse wiki links
    if (updates.content !== undefined) {
      const wikiLinkRegex = /\[\[(.*?)\]\]/g;
      const matches = [...updates.content.matchAll(wikiLinkRegex)];
      const linkedTitles = matches.map(m => m[1].toLowerCase());
      
      const linkedNoteIds = currentNotes
        .filter(n => linkedTitles.includes(n.title.toLowerCase()))
        .map(n => n.id);
      
      updatedNote.linksTo = linkedNoteIds;
    }

    await db.notes.update(id, updatedNote);
    
    // Update backlinks for all notes
    const allNotes = await db.notes.toArray();
    for (const n of allNotes) {
      const backlinks = allNotes
        .filter(other => other.linksTo.includes(n.id))
        .map(other => other.id);
      
      if (JSON.stringify(n.backlinks) !== JSON.stringify(backlinks)) {
        await db.notes.update(n.id, { backlinks });
      }
    }

    const finalNotes = await db.notes.toArray();
    set({ notes: finalNotes });
  },

  setActiveNote: (id) => set({ activeNoteId: id, selectedNoteId: id, isGraphView: false }),
  setSelectedNote: (id) => set({ selectedNoteId: id }),
  toggleGraphView: () => set((state) => ({ isGraphView: !state.isGraphView })),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setImporting: (status) => set({ isImporting: status }),
  setRecording: (status) => set({ isRecording: status }),

  processImportResult: async (result: ImportResult) => {
    const { analysis, sourceType, metadata } = result;
    const folderId = sourceType === 'import' ? 'f2' : (sourceType === 'voice' ? 'f3' : null);
    
    if (analysis && analysis.notes.length > 0) {
      const createdNoteIds: string[] = [];
      for (const atomicNote of analysis.notes) {
        const id = await get().addNote(
          atomicNote.title,
          atomicNote.content,
          folderId,
          sourceType
        );
        createdNoteIds.push(id);
        
        // Add metadata
        await db.notes.update(id, { metadata });
      }
      
      // After creating all notes, trigger a global update to refresh links
      // (The updateNote logic already handles bidirectional linking if we call it, 
      // but here we are adding new notes. We might need a global link refresh.)
      const allNotes = await db.notes.toArray();
      set({ notes: allNotes });
      
      return createdNoteIds;
    } else {
      const id = await get().addNote(result.title, result.content, folderId, sourceType);
      await db.notes.update(id, { metadata });
      return [id];
    }
  },

  handleWikiLink: async (title) => {
    const existing = get().notes.find(n => n.title.toLowerCase() === title.toLowerCase());
    if (existing) {
      get().setActiveNote(existing.id);
      return existing.id;
    } else {
      const newId = await get().addNote(title, '', null, 'manual');
      return newId;
    }
  }
}));
