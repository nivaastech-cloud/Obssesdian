export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  folderId: string | null;
  linksTo: string[]; // array of note IDs
  createdAt: number;
  updatedAt: number;
}

export interface GraphNode {
  id: string;
  title: string;
  isOrphan: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface AppState {
  folders: Folder[];
  notes: Note[];
  activeNoteId: string | null;
  selectedNoteId: string | null; // For graph highlighting
  isGraphView: boolean;
  searchQuery: string;
  
  // Actions
  addFolder: (name: string, parentId: string | null) => void;
  deleteFolder: (id: string) => void;
  updateFolder: (id: string, name: string) => void;
  
  addNote: (title: string, folderId: string | null) => string;
  deleteNote: (id: string) => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
  setActiveNote: (id: string | null, shouldSwitchView?: boolean) => void;
  setSelectedNote: (id: string | null) => void;
  
  toggleGraphView: () => void;
  setSearchQuery: (query: string) => void;
  
  // Wiki-link logic
  getNoteByTitle: (title: string) => Note | undefined;
  handleWikiLink: (title: string) => string; // returns note ID
}
