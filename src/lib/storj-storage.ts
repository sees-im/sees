import type { StoredNote, VaultStorage } from "./storage";
import { listStorjNotes, putStorjNote, deleteStorjNote } from "./storj.functions";

// VaultStorage backed by Storj. Server only sees encrypted blobs.
// Mirrors encrypted note blobs to localStorage so reads still work offline.
export function createStorjStorage(vaultId: string): VaultStorage {
  const cacheKey = `krypta:cache:notes:${vaultId}`;

  const readCache = (): StoredNote[] => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(cacheKey);
      return raw ? (JSON.parse(raw) as StoredNote[]) : [];
    } catch {
      return [];
    }
  };
  const writeCache = (notes: StoredNote[]) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(cacheKey, JSON.stringify(notes));
    } catch {
      // quota — ignore
    }
  };

  return {
    async listFiles() {
      return [];
    },
    async putFile() {
      throw new Error("Files not supported");
    },
    async deleteFile() {
      // no-op
    },
    async getFile() {
      return null;
    },
    async listNotes() {
      try {
        const { notes } = await listStorjNotes({ data: { vaultId } });
        const sorted = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
        writeCache(sorted);
        return sorted;
      } catch (e) {
        // Offline / network failure — fall back to encrypted local mirror.
        console.warn("listNotes offline, using cache", e);
        return readCache();
      }
    },
    async putNote(n) {
      await putStorjNote({ data: { vaultId, note: n } });
      const all = readCache().filter((x) => x.id !== n.id);
      all.push(n);
      writeCache(all.sort((a, b) => b.updatedAt - a.updatedAt));
    },
    async deleteNote(id) {
      await deleteStorjNote({ data: { vaultId, noteId: id } });
      writeCache(readCache().filter((x) => x.id !== id));
    },
  };
}
