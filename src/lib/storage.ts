// Storage adapter — swap localStorage for Storj later by implementing this interface.
import type { EncryptedBlob } from "./crypto";

export interface StoredFile {
  id: string;
  name: EncryptedBlob; // encrypted filename
  mime: EncryptedBlob; // encrypted mime type
  size: number; // ciphertext byte length (metadata)
  blob: EncryptedBlob; // encrypted file bytes (base64)
  createdAt: number;
}

export interface StoredNote {
  id: string;
  title: EncryptedBlob;
  body: EncryptedBlob;
  updatedAt: number;
}

export interface VaultStorage {
  listFiles(): Promise<StoredFile[]>;
  putFile(f: StoredFile): Promise<void>;
  deleteFile(id: string): Promise<void>;
  getFile(id: string): Promise<StoredFile | null>;

  listNotes(): Promise<StoredNote[]>;
  putNote(n: StoredNote): Promise<void>;
  deleteNote(id: string): Promise<void>;
}

const FILES_KEY = "krypta:files";
const NOTES_KEY = "krypta:notes";

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, items: T[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(items));
}

export const localVaultStorage: VaultStorage = {
  async listFiles() {
    return read<StoredFile>(FILES_KEY).sort((a, b) => b.createdAt - a.createdAt);
  },
  async putFile(f) {
    const all = read<StoredFile>(FILES_KEY).filter((x) => x.id !== f.id);
    all.push(f);
    write(FILES_KEY, all);
  },
  async deleteFile(id) {
    write(
      FILES_KEY,
      read<StoredFile>(FILES_KEY).filter((x) => x.id !== id),
    );
  },
  async getFile(id) {
    return read<StoredFile>(FILES_KEY).find((x) => x.id === id) ?? null;
  },
  async listNotes() {
    return read<StoredNote>(NOTES_KEY).sort((a, b) => b.updatedAt - a.updatedAt);
  },
  async putNote(n) {
    const all = read<StoredNote>(NOTES_KEY).filter((x) => x.id !== n.id);
    all.push(n);
    write(NOTES_KEY, all);
  },
  async deleteNote(id) {
    write(
      NOTES_KEY,
      read<StoredNote>(NOTES_KEY).filter((x) => x.id !== id),
    );
  },
};

export function createLocalVaultStorage(vaultId: string): VaultStorage {
  const filesKey = `krypta:local:files:${vaultId}`;
  const notesKey = `krypta:local:notes:${vaultId}`;

  return {
    async listFiles() {
      return read<StoredFile>(filesKey).sort((a, b) => b.createdAt - a.createdAt);
    },
    async putFile(file) {
      const all = read<StoredFile>(filesKey).filter((item) => item.id !== file.id);
      all.push(file);
      write(filesKey, all);
    },
    async deleteFile(id) {
      write(
        filesKey,
        read<StoredFile>(filesKey).filter((item) => item.id !== id),
      );
    },
    async getFile(id) {
      return read<StoredFile>(filesKey).find((item) => item.id === id) ?? null;
    },
    async listNotes() {
      return read<StoredNote>(notesKey).sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async putNote(note) {
      const all = read<StoredNote>(notesKey).filter((item) => item.id !== note.id);
      all.push(note);
      write(notesKey, all);
    },
    async deleteNote(id) {
      write(
        notesKey,
        read<StoredNote>(notesKey).filter((item) => item.id !== id),
      );
    },
  };
}
