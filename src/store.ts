import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { AppState, Folder, Note } from './types';

const SEED_FOLDERS: Folder[] = [
  { id: 'f1', name: 'Projects', parentId: null },
  { id: 'f2', name: 'Personal', parentId: null },
  { id: 'f3', name: 'Work', parentId: 'f1' },
];

const SEED_NOTES: Note[] = [
  {
    id: 'n1',
    title: 'Welcome to Lumina',
    content: '# Welcome\n\nThis is your new knowledge base. You can link notes using [[Wiki Links]].\n\nTry clicking on [[Second Note]] or creating a new one.',
    folderId: null,
    linksTo: ['n2'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'n2',
    title: 'Second Note',
    content: 'This note is linked from [[Welcome to Lumina]].\n\nBacklinks are automatically tracked.',
    folderId: 'f1',
    linksTo: ['n1'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      folders: SEED_FOLDERS,
      notes: SEED_NOTES,
      activeNoteId: 'n1',
      selectedNoteId: 'n1',
      isGraphView: false,
      searchQuery: '',

      addFolder: (name, parentId) => set((state) => ({
        folders: [...state.folders, { id: uuidv4(), name, parentId }]
      })),

      deleteFolder: (id) => set((state) => ({
        folders: state.folders.filter(f => f.id !== id),
        notes: state.notes.map(n => n.folderId === id ? { ...n, folderId: null } : n)
      })),

      updateFolder: (id, name) => set((state) => ({
        folders: state.folders.map(f => f.id === id ? { ...f, name } : f)
      })),

      addNote: (title, folderId) => {
        const id = uuidv4();
        const newNote: Note = {
          id,
          title,
          content: '',
          folderId,
          linksTo: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({
          notes: [...state.notes, newNote],
          activeNoteId: id,
          selectedNoteId: id,
          isGraphView: false
        }));
        return id;
      },

      deleteNote: (id) => set((state) => ({
        notes: state.notes.filter(n => n.id !== id),
        activeNoteId: state.activeNoteId === id ? null : state.activeNoteId,
        selectedNoteId: state.selectedNoteId === id ? null : state.selectedNoteId
      })),

      updateNote: (id, updates) => set((state) => {
        const updatedNotes = state.notes.map(n => {
          if (n.id === id) {
            const updated = { ...n, ...updates, updatedAt: Date.now() };
            
            // If content changed, parse links
            if (updates.content !== undefined) {
              const links = extractLinks(updates.content);
              // Map titles to IDs
              updated.linksTo = links.map(title => {
                const existing = state.notes.find(note => note.title.toLowerCase() === title.toLowerCase());
                if (existing) return existing.id;
                return null;
              }).filter((id): id is string => id !== null);
            }
            return updated;
          }
          return n;
        });
        return { notes: updatedNotes };
      }),

      setActiveNote: (id, shouldSwitchView = true) => set((state) => ({ 
        activeNoteId: id, 
        selectedNoteId: id,
        isGraphView: shouldSwitchView ? false : state.isGraphView 
      })),

      setSelectedNote: (id) => set({ selectedNoteId: id }),

      toggleGraphView: () => set((state) => ({ isGraphView: !state.isGraphView })),

      setSearchQuery: (query) => set({ searchQuery: query }),

      getNoteByTitle: (title) => {
        return get().notes.find(n => n.title.toLowerCase() === title.toLowerCase());
      },

      handleWikiLink: (title) => {
        const existing = get().getNoteByTitle(title);
        if (existing) {
          get().setActiveNote(existing.id);
          return existing.id;
        } else {
          const newId = get().addNote(title, null);
          return newId;
        }
      }
    }),
    {
      name: 'lumina-notes-storage',
    }
  )
);

function extractLinks(content: string): string[] {
  const regex = /\[\[(.*?)\]\]/g;
  const links: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (match[1]) links.push(match[1].trim());
  }
  return Array.from(new Set(links));
}
