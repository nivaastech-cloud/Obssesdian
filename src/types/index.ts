export type SourceType = "manual" | "import" | "voice" | "ai";

export interface LuminaFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
}

export interface LuminaNote {
  id: string;
  title: string;
  content: string;
  folderId: string | null;
  sourceType: SourceType;
  linksTo: string[]; // IDs of notes this note links to
  backlinks: string[]; // IDs of notes that link to this note
  createdAt: number;
  updatedAt: number;
  metadata?: {
    sourceUrl?: string;
    fileName?: string;
    extractedEntities?: string[];
  };
}

export interface GraphNode {
  id: string;
  title: string;
  sourceType: SourceType;
  isOrphan: boolean;
}

export interface GraphLink {
  source: string;
  target: string;
}
