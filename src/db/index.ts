import Dexie, { Table } from 'dexie';
import { LuminaFolder, LuminaNote } from '../types/index';

export class LuminaDB extends Dexie {
  folders!: Table<LuminaFolder>;
  notes!: Table<LuminaNote>;

  constructor() {
    super('LuminaDB');
    this.version(1).stores({
      folders: 'id, name, parentId, createdAt',
      notes: 'id, title, folderId, sourceType, createdAt, updatedAt, *linksTo, *backlinks'
    });
  }
}

export const db = new LuminaDB();
