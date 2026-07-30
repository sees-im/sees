import { createFileRoute, useNavigate } from "@tanstack/react-router";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVault } from "@/lib/vault-context";
import { encryptString, decryptString } from "@/lib/crypto";
import { buildShareUrl, EXPIRY_OPTIONS } from "@/lib/share";
import { createTotpUri, formatTotpSecret, generateTotpSecret } from "@/lib/totp";
import { registerShare, revokeShare } from "@/lib/storj.functions";
import type { StoredNote } from "@/lib/storage";
import { createLocalVaultStorage } from "@/lib/storage";
import { createStorjStorage } from "@/lib/storj-storage";
import { BrandMark } from "@/components/BrandMark";
import { PasswordInput } from "@/components/PasswordInput";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/vault")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex,nofollow" }],
  }),
  component: VaultPage,
});

interface DecryptedNote {
  id: string;
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
  folder?: string;
  updatedAt: number;
  deletedAt?: number;
}

type SortMode = "updated" | "title" | "pinned";
type ViewMode = "notes" | "trash";

const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const UNCATEGORIZED = "__none__";

function uuid() {
  return crypto.randomUUID();
}

function formatTime(t: number) {
  const diff = Date.now() - t;
  if (diff < 60_000) return "JUST NOW";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}M AGO`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}H AGO`;
  return new Date(t).toLocaleDateString();
}

// Encrypted body envelope: stores body + tags + pinned + folder + deletedAt together so
// metadata stays zero-knowledge. Falls back to plain text for legacy notes.
function encodeBody(
  body: string,
  tags: string[],
  pinned: boolean,
  folder?: string,
  deletedAt?: number,
) {
  const o: Record<string, unknown> = { v: 1, body, tags, pinned };
  if (folder) o.folder = folder;
  if (typeof deletedAt === "number") o.deletedAt = deletedAt;
  return JSON.stringify(o);
}
function decodeBody(raw: string): {
  body: string;
  tags: string[];
  pinned: boolean;
  folder?: string;
  deletedAt?: number;
} {
  try {
    const o = JSON.parse(raw);
    if (o && typeof o === "object" && o.v === 1 && typeof o.body === "string") {
      return {
        body: o.body,
        tags: Array.isArray(o.tags) ? o.tags.filter((t: unknown) => typeof t === "string") : [],
        pinned: Boolean(o.pinned),
        folder: typeof o.folder === "string" && o.folder ? o.folder : undefined,
        deletedAt: typeof o.deletedAt === "number" ? o.deletedAt : undefined,
      };
    }
  } catch {
    // legacy plain
  }
  return { body: raw, tags: [], pinned: false };
}

// Local folder registry (per vault). Lets empty folders persist on this device.
// Folder *membership* on a note is encrypted in the body envelope and syncs across devices.
function foldersKey(vaultId: string) {
  return `kn.folders.${vaultId}`;
}
function loadFolderList(vaultId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(foldersKey(vaultId));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function saveFolderList(vaultId: string, folders: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(foldersKey(vaultId), JSON.stringify(folders));
  } catch {
    // ignore quota
  }
}


function VaultPage() {
  const { isLocked, key, lock, fingerprint, vaultName, storageMode } = useVault();
  const navigate = useNavigate();
  const storage = useMemo(() => {
    if (storageMode === "local" && vaultName) return createLocalVaultStorage(vaultName);
    return fingerprint ? createStorjStorage(fingerprint) : null;
  }, [fingerprint, storageMode, vaultName]);
  const [showSettings, setShowSettings] = useState(false);
  const [notes, setNotes] = useState<DecryptedNote[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [draftPinned, setDraftPinned] = useState(false);
  const [draftFolder, setDraftFolder] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [folders, setFolders] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("updated");
  const [view, setView] = useState<ViewMode>("notes");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<null | { count: number; onConfirm: () => void }>(null);

  useEffect(() => {
    if (isLocked) navigate({ to: "/" });
  }, [isLocked, navigate]);

  useEffect(() => {
    if (!fingerprint) return;
    setFolders(loadFolderList(fingerprint));
  }, [fingerprint]);

  const persistFolders = useCallback(
    (next: string[]) => {
      const uniq = Array.from(new Set(next.map((f) => f.trim()).filter(Boolean))).sort();
      setFolders(uniq);
      if (fingerprint) saveFolderList(fingerprint, uniq);
    },
    [fingerprint],
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2500);
  }, []);

  const refresh = useCallback(async () => {
    if (!key || !storage) return;
    setLoading(true);
    const raw = await storage.listNotes();
    const dec: DecryptedNote[] = [];
    const now = Date.now();
    for (const n of raw) {
      try {
        const title = await decryptString(key, n.title);
        const bodyRaw = await decryptString(key, n.body);
        const { body, tags, pinned, folder, deletedAt } = decodeBody(bodyRaw);
        if (typeof deletedAt === "number" && now - deletedAt > TRASH_RETENTION_MS) {
          try {
            await storage.deleteNote(n.id);
          } catch {
            // ignore — try again next refresh
          }
          continue;
        }
        dec.push({ id: n.id, title, body, tags, pinned, folder, updatedAt: n.updatedAt, deletedAt });
      } catch {
        // skip undecryptable
      }
    }
    setNotes(dec);
    setLoading(false);
  }, [key, storage]);


  useEffect(() => {
    if (key) void refresh();
  }, [key, refresh]);

  // Active vs trashed (zero-knowledge `deletedAt` lives in the encrypted body).
  const activeNotes = useMemo(() => notes.filter((n) => !n.deletedAt), [notes]);
  const trashedNotes = useMemo(() => notes.filter((n) => !!n.deletedAt), [notes]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const n of activeNotes) for (const t of n.tags) s.add(t);
    return Array.from(s).sort();
  }, [activeNotes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = view === "trash" ? trashedNotes : activeNotes;
    if (view === "notes" && tagFilter) out = out.filter((n) => n.tags.includes(tagFilter));
    if (view === "notes" && folderFilter) {
      if (folderFilter === UNCATEGORIZED) out = out.filter((n) => !n.folder);
      else out = out.filter((n) => n.folder === folderFilter);
    }
    if (q) {
      out = out.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.body.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    const sorted = [...out];
    if (view === "trash") {
      sorted.sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
    } else if (sortMode === "title") {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      sorted.sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || (b.updatedAt - a.updatedAt));
    }
    return sorted;
  }, [activeNotes, trashedNotes, view, search, tagFilter, folderFilter, sortMode]);

  // Folder list: union of registered (local) + folders referenced by existing notes.
  const allFolders = useMemo(() => {
    const s = new Set<string>(folders);
    for (const n of activeNotes) if (n.folder) s.add(n.folder);
    return Array.from(s).sort();
  }, [folders, activeNotes]);
  const folderCounts = useMemo(() => {
    const m: Record<string, number> = {};
    let uncat = 0;
    for (const n of activeNotes) {
      if (n.folder) m[n.folder] = (m[n.folder] || 0) + 1;
      else uncat++;
    }
    return { map: m, uncategorized: uncat };
  }, [activeNotes]);


  // Drop selections that no longer exist in the current view
  useEffect(() => {
    setSelectedIds((prev) => {
      const visible = new Set(filtered.map((n) => n.id));
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (visible.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [filtered]);

  const activeNote = useMemo(
    () => (activeId ? notes.find((n) => n.id === activeId) ?? null : null),
    [activeId, notes],
  );

  const isDirty = activeNote
    ? draftTitle !== activeNote.title ||
      draftBody !== activeNote.body ||
      draftPinned !== activeNote.pinned ||
      (draftFolder ?? "") !== (activeNote.folder ?? "") ||
      JSON.stringify(draftTags) !== JSON.stringify(activeNote.tags)
    : isNew && (draftTitle.length > 0 || draftBody.length > 0 || draftTags.length > 0 || !!draftFolder);

  const [pendingAction, setPendingAction] = useState<null | (() => void)>(null);

  const _openNote = (n: DecryptedNote) => {
    setIsNew(false);
    setActiveId(n.id);
    setDraftTitle(n.title);
    setDraftBody(n.body);
    setDraftTags([...n.tags]);
    setDraftPinned(n.pinned);
    setDraftFolder(n.folder);
  };

  const _newNote = () => {
    setIsNew(true);
    setActiveId(null);
    setDraftTitle("");
    setDraftBody("");
    setDraftTags([]);
    setDraftPinned(false);
    // Default new note into the currently filtered folder, if any.
    setDraftFolder(
      folderFilter && folderFilter !== UNCATEGORIZED ? folderFilter : undefined,
    );
  };

  const _closeEditor = () => {
    setIsNew(false);
    setActiveId(null);
    setDraftTitle("");
    setDraftBody("");
    setDraftTags([]);
    setDraftPinned(false);
    setDraftFolder(undefined);
  };

  const guard = (fn: () => void) => () => {
    if (isDirty) setPendingAction(() => fn);
    else fn();
  };

  const openNote = (n: DecryptedNote) => guard(() => _openNote(n))();
  const newNote = guard(_newNote);
  const closeEditor = guard(_closeEditor);

  const syncedRevRef = useRef<{ id: string; updatedAt: number } | null>(null);
  useEffect(() => {
    if (!activeNote) {
      syncedRevRef.current = null;
      return;
    }
    const last = syncedRevRef.current;
    const sameNote = last && last.id === activeNote.id;
    if (!sameNote) {
      syncedRevRef.current = { id: activeNote.id, updatedAt: activeNote.updatedAt };
      return;
    }
    if (activeNote.updatedAt !== last!.updatedAt) {
      syncedRevRef.current = { id: activeNote.id, updatedAt: activeNote.updatedAt };
      setDraftTitle(activeNote.title);
      setDraftBody(activeNote.body);
      setDraftTags([...activeNote.tags]);
      setDraftPinned(activeNote.pinned);
      setDraftFolder(activeNote.folder);
    }
  }, [activeNote]);

  const save = useCallback(async () => {
    if (!key || !storage) return;
    if (!draftTitle.trim() && !draftBody.trim()) return;
    const id = activeId || uuid();
    const stored: StoredNote = {
      id,
      title: await encryptString(key, draftTitle.trim() || "Untitled"),
      body: await encryptString(
        key,
        encodeBody(draftBody, draftTags, draftPinned, draftFolder),
      ),
      updatedAt: Date.now(),
    };
    await storage.putNote(stored);
    // Auto-register any new folder name into the local registry.
    if (draftFolder && !folders.includes(draftFolder)) {
      persistFolders([...folders, draftFolder]);
    }
    setIsNew(false);
    setActiveId(id);
    await refresh();
    showToast("Sealed.");
  }, [
    key, storage, draftTitle, draftBody, draftTags, draftPinned, draftFolder,
    activeId, refresh, showToast, folders, persistFolders,
  ]);

  const trashNoteById = useCallback(
    async (id: string) => {
      if (!key || !storage) return;
      const n = notes.find((x) => x.id === id);
      if (!n) return;
      const stored: StoredNote = {
        id: n.id,
        title: await encryptString(key, n.title),
        body: await encryptString(
          key,
          encodeBody(n.body, n.tags, n.pinned, n.folder, Date.now()),
        ),
        updatedAt: n.updatedAt,
      };
      await storage.putNote(stored);
    },
    [key, storage, notes],
  );

  const restoreNoteById = useCallback(
    async (id: string) => {
      if (!key || !storage) return;
      const n = notes.find((x) => x.id === id);
      if (!n) return;
      const stored: StoredNote = {
        id: n.id,
        title: await encryptString(key, n.title),
        body: await encryptString(key, encodeBody(n.body, n.tags, n.pinned, n.folder)),
        updatedAt: n.updatedAt,
      };
      await storage.putNote(stored);
    },
    [key, storage, notes],
  );

  // Re-encrypt one note with a new folder assignment (used for bulk move).
  const moveNoteToFolder = useCallback(
    async (id: string, folder: string | undefined) => {
      if (!key || !storage) return;
      const n = notes.find((x) => x.id === id);
      if (!n) return;
      const stored: StoredNote = {
        id: n.id,
        title: await encryptString(key, n.title),
        body: await encryptString(
          key,
          encodeBody(n.body, n.tags, n.pinned, folder, n.deletedAt),
        ),
        updatedAt: Date.now(),
      };
      await storage.putNote(stored);
    },
    [key, storage, notes],
  );

  const remove = async () => {
    if (!activeId || !storage) return;
    const inTrash = !!activeNote?.deletedAt;
    if (inTrash) {
      setConfirmDelete({
        count: 1,
        onConfirm: async () => {
          await storage.deleteNote(activeId);
          _closeEditor();
          await refresh();
          showToast("Permanently deleted");
        },
      });
    } else {
      await trashNoteById(activeId);
      _closeEditor();
      await refresh();
      showToast("Moved to Trash · 30d to restore");
    }
  };

  // Bulk actions over the current selection.
  const bulkTrash = async (ids: string[]) => {
    for (const id of ids) await trashNoteById(id);
    setSelectedIds(new Set());
    await refresh();
    showToast(`${ids.length} moved to Trash`);
  };
  const bulkRestore = async (ids: string[]) => {
    for (const id of ids) await restoreNoteById(id);
    setSelectedIds(new Set());
    await refresh();
    showToast(`${ids.length} restored`);
  };
  const bulkMoveToFolder = async (ids: string[], folder: string | undefined) => {
    for (const id of ids) await moveNoteToFolder(id, folder);
    if (folder && !folders.includes(folder)) persistFolders([...folders, folder]);
    setSelectedIds(new Set());
    await refresh();
    showToast(folder ? `${ids.length} moved to ${folder}` : `${ids.length} uncategorized`);
  };
  const bulkDeleteForever = async (ids: string[]) => {

    if (!storage || ids.length === 0) return;
    setConfirmDelete({
      count: ids.length,
      onConfirm: async () => {
        for (const id of ids) {
          try { await storage.deleteNote(id); } catch { /* ignore */ }
        }
        setSelectedIds(new Set());
        await refresh();
        showToast(`${ids.length} purged`);
      },
    });
  };

  // ── Folder management ───────────────────────────────────────────────
  const createFolder = useCallback(
    (raw: string) => {
      const name = raw.trim();
      if (!name) return;
      if (folders.includes(name)) {
        showToast("Folder already exists");
        return;
      }
      persistFolders([...folders, name]);
      setFolderFilter(name);
      showToast(`Folder “${name}” created`);
    },
    [folders, persistFolders, showToast],
  );

  const renameFolder = useCallback(
    async (oldName: string, raw: string) => {
      const next = raw.trim();
      if (!next || next === oldName) return;
      if (folders.includes(next)) {
        showToast("Name already in use");
        return;
      }
      // Re-encrypt every note that lived in oldName under the new name.
      const affected = notes.filter((n) => n.folder === oldName);
      for (const n of affected) {
        await moveNoteToFolder(n.id, next);
      }
      persistFolders([...folders.filter((f) => f !== oldName), next]);
      if (folderFilter === oldName) setFolderFilter(next);
      await refresh();
      showToast(`Renamed to “${next}”`);
    },
    [folders, notes, moveNoteToFolder, persistFolders, folderFilter, refresh, showToast],
  );

  const deleteFolder = useCallback(
    async (name: string) => {
      // Notes inside lose their folder assignment (become uncategorized).
      const affected = notes.filter((n) => n.folder === name);
      for (const n of affected) {
        await moveNoteToFolder(n.id, undefined);
      }
      persistFolders(folders.filter((f) => f !== name));
      if (folderFilter === name) setFolderFilter(null);
      await refresh();
      showToast(`Folder “${name}” removed`);
    },
    [folders, notes, moveNoteToFolder, persistFolders, folderFilter, refresh, showToast],
  );


  // Cmd/Ctrl+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (isNew || activeId) void save();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isNew, activeId, save]);

  // Warn on tab close / refresh when there are unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  if (!key) return null;

  return (
    <TooltipProvider delayDuration={150}>
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <nav className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border bg-surface/40">
        <div className="flex items-center gap-3">
          <BrandMark variant="wordmark" />
          <span className="hidden sm:inline-block ml-3 px-2 py-0.5 bg-accent/10 border border-accent/30 text-accent font-mono text-[10px] uppercase tracking-widest">
            {storageMode === "local" ? "Local demo · no sync" : "Decrypted session"}
          </span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          {fingerprint && (
            <span className="hidden md:inline font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
              Key: <span className="text-foreground">{fingerprint}</span>
            </span>
          )}
          <Tip label="Open vault settings (Esc to close)">
            <button
              onClick={() => setShowSettings(true)}
              className="font-mono text-[10px] uppercase tracking-widest border border-border px-3 py-1.5 hover:border-accent hover:text-accent transition-colors"
            >
              Settings
            </button>
          </Tip>
          <Tip label="Log out & wipe key from memory">
            <button
              onClick={lock}
              className="font-mono text-[10px] uppercase tracking-widest border border-border px-3 py-1.5 hover:border-accent hover:text-accent transition-colors"
            >
              Log out
            </button>
          </Tip>
        </div>
      </nav>

      <main className="flex-1 min-w-0 overflow-hidden flex flex-col">
        <NotesPanel
          notes={filtered}
          activeCount={activeNotes.length}
          trashCount={trashedNotes.length}
          loading={loading}
          search={search}
          setSearch={setSearch}
          tagFilter={tagFilter}
          setTagFilter={setTagFilter}
          allTags={allTags}
          allFolders={allFolders}
          folderCounts={folderCounts}
          folderFilter={folderFilter}
          setFolderFilter={setFolderFilter}
          onCreateFolder={createFolder}
          onRenameFolder={renameFolder}
          onDeleteFolder={deleteFolder}
          sortMode={sortMode}
          setSortMode={setSortMode}
          view={view}
          setView={(v) => {
            if (isDirty) {
              setPendingAction(() => () => {
                _closeEditor();
                setSelectedIds(new Set());
                setView(v);
              });
            } else {
              _closeEditor();
              setSelectedIds(new Set());
              setView(v);
            }
          }}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          onBulkTrash={() => bulkTrash(Array.from(selectedIds))}
          onBulkRestore={() => bulkRestore(Array.from(selectedIds))}
          onBulkDeleteForever={() => bulkDeleteForever(Array.from(selectedIds))}
          onBulkMoveToFolder={(folder) => bulkMoveToFolder(Array.from(selectedIds), folder)}
          activeNote={activeNote}
          isNew={isNew}
          draftTitle={draftTitle}
          draftBody={draftBody}
          draftTags={draftTags}
          draftPinned={draftPinned}
          draftFolder={draftFolder}
          setDraftTitle={setDraftTitle}
          setDraftBody={setDraftBody}
          setDraftTags={setDraftTags}
          setDraftPinned={setDraftPinned}
          setDraftFolder={setDraftFolder}

          isDirty={isDirty}
          onOpen={openNote}
          onNew={newNote}
          onClose={closeEditor}
          onRefresh={refresh}
          onSave={save}
          onDelete={remove}
          showToast={showToast}
        />
      </main>

      {showSettings && (
        <SettingsOverlay noteCount={activeNotes.length} onClose={() => setShowSettings(false)} />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-surface border border-accent/40 text-accent px-4 py-2 font-mono text-xs uppercase tracking-widest shadow-glow">
          {toast}
        </div>
      )}

      <AlertDialog open={!!pendingAction} onOpenChange={(o) => !o && setPendingAction(null)}>
        <AlertDialogContent className="border-accent/40 bg-surface font-mono">
          <AlertDialogHeader>
            <AlertDialogTitle className="uppercase tracking-widest text-accent text-sm">
              Unsaved changes
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              You have unsaved edits in this note. Continue and discard them, or go back and save first?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-mono text-xs uppercase tracking-widest">
              Keep editing
            </AlertDialogCancel>
            <AlertDialogAction
              className="font-mono text-xs uppercase tracking-widest bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const fn = pendingAction;
                setPendingAction(null);
                fn?.();
              }}
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent className="border-destructive/40 bg-surface font-mono">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <span className="size-9 flex items-center justify-center border border-destructive/40 text-destructive bg-destructive/10 text-base">
                ⚠
              </span>
              <AlertDialogTitle className="uppercase tracking-widest text-destructive text-sm">
                {confirmDelete?.count === 1
                  ? "Permanently delete note"
                  : `Permanently delete ${confirmDelete?.count ?? 0} notes`}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-muted-foreground leading-relaxed">
              This action is irreversible. The encrypted ciphertext will be removed from{" "}
              {storageMode === "local" ? "this browser" : "decentralized storage"} and cannot be
              recovered — even with your passphrase.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-mono text-xs uppercase tracking-widest">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="font-mono text-xs uppercase tracking-widest bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const fn = confirmDelete?.onConfirm;
                setConfirmDelete(null);
                void fn?.();
              }}
            >
              {confirmDelete && confirmDelete.count > 1
                ? `Delete ${confirmDelete.count} forever`
                : "Delete forever"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </TooltipProvider>
  );
}

function SettingsOverlay({ noteCount, onClose }: { noteCount: number; onClose: () => void }) {
  const {
    fingerprint,
    vaultName,
    storageMode,
    sessionTimeoutMinutes,
    twoFactorEnabled,
    setSessionTimeoutMinutes,
    enableTwoFactor,
    disableTwoFactor,
    lock,
    destroyVault,
    changePassphrase,
    loadAudit,
  } = useVault();
  const [tab, setTab] = useState<"info" | "session" | "twoFactor" | "passphrase" | "audit">("info");
  const [audit, setAudit] = useState<import("@/lib/vault-context").AuditEntry[] | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [destroyOpen, setDestroyOpen] = useState(false);
  const [destroying, setDestroying] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (tab === "audit" && audit === null && !auditLoading) {
      setAuditLoading(true);
      loadAudit()
        .then((entries) => setAudit(entries.reverse()))
        .finally(() => setAuditLoading(false));
    }
  }, [tab, audit, auditLoading, loadAudit]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close settings"
        onClick={onClose}
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
      />
      <aside className="relative h-full w-full max-w-md bg-surface border-l border-border flex flex-col shadow-2xl shadow-black/60 animate-in slide-in-from-right duration-200">
        <header className="flex items-center justify-between border-b border-border px-6 py-5">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent mb-1">
              Vault Configuration
            </div>
            <h2 className="text-xl font-semibold tracking-tight">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-xs text-muted-foreground hover:text-accent border border-border size-8 flex items-center justify-center"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="flex border-b border-border font-mono text-[10px] uppercase tracking-widest">
          {(["info", "session", "twoFactor", "passphrase", "audit"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 transition-colors ${
                tab === t
                  ? "text-accent border-b border-accent bg-accent/5"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "info"
                ? "Info"
                : t === "session"
                  ? "Session"
                  : t === "twoFactor"
                    ? "2FA"
                    : t === "passphrase"
                      ? "Passphrase"
                      : "Activity"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-3">
          {tab === "info" && (
            <>
              <Field label="Vault ID">
                <code className="font-mono text-sm text-accent">{vaultName ?? "—"}</code>
              </Field>
              <Field label="Key Fingerprint">
                <code className="font-mono text-sm text-accent">{fingerprint ?? "—"}</code>
              </Field>
              <Field label="Encryption">
                <code className="font-mono text-sm">AES-256-GCM</code>
              </Field>
              <Field label="Key Derivation">
                <code className="font-mono text-sm">
                  PBKDF2-SHA256 · 250,000 iterations
                </code>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  SEES keeps this setting stable so the same vault unlocks across deployments.
                </p>
              </Field>
              <Field label="Notes in Vault">
                <code className="font-mono text-sm">{noteCount}</code>
              </Field>
              <Field label="Storage Backend">
                <code className="font-mono text-sm text-muted-foreground">
                  {storageMode === "local" ? "Local browser · demo only" : "Decentralized Storj · live"}
                </code>
              </Field>
            </>
          )}

          {tab === "session" && (
            <SessionTimeoutForm
              value={sessionTimeoutMinutes}
              onChange={setSessionTimeoutMinutes}
            />
          )}

          {tab === "twoFactor" && (
            <TwoFactorForm
              enabled={twoFactorEnabled}
              vaultName={vaultName ?? "vault"}
              enable={enableTwoFactor}
              disable={disableTwoFactor}
            />
          )}

          {tab === "passphrase" && (
            <ChangePassphraseForm onDone={() => setTab("info")} change={changePassphrase} />
          )}

          {tab === "audit" && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Recent unlocks of this vault. If you see a session you don&apos;t recognize, change
                your passphrase immediately.
              </p>
              {auditLoading && (
                <div className="text-xs font-mono text-muted-foreground">Loading…</div>
              )}
              {!auditLoading && audit && audit.length === 0 && (
                <div className="text-xs font-mono text-muted-foreground">No activity recorded yet.</div>
              )}
              {!auditLoading &&
                audit?.map((e, i) => (
                  <div key={i} className="border border-border p-3 font-mono text-[11px] space-y-1">
                    <div className="flex justify-between text-accent uppercase tracking-widest text-[10px]">
                      <span>{e.event}</span>
                      <span>{new Date(e.ts).toLocaleString()}</span>
                    </div>
                    <div className="text-muted-foreground truncate" title={e.ua}>
                      {e.ua}
                    </div>
                    <div className="text-muted-foreground">
                      IP: <span className="text-foreground">{e.ip}</span>
                      {e.country ? <span className="ml-2">· {e.country}</span> : null}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="border-t border-border p-6 space-y-3">
          <button
            onClick={() => { onClose(); lock(); }}
            className="w-full py-3 border border-border font-mono text-xs uppercase tracking-widest hover:border-accent hover:text-accent transition-colors"
          >
            Log Out
          </button>
          <button
            onClick={() => setDestroyOpen(true)}
            className="w-full py-3 border border-destructive/40 text-destructive font-mono text-xs uppercase tracking-widest hover:bg-destructive/10 transition-colors"
          >
            Destroy Vault
          </button>
        </div>
      </aside>

      <AlertDialog open={destroyOpen} onOpenChange={(o) => !destroying && setDestroyOpen(o)}>
        <AlertDialogContent className="border-destructive/40 bg-surface font-mono">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <span className="size-9 flex items-center justify-center border border-destructive/40 text-destructive bg-destructive/10 text-base">
                ☠
              </span>
              <AlertDialogTitle className="uppercase tracking-widest text-destructive text-sm">
                Destroy entire vault
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-muted-foreground leading-relaxed">
              This permanently wipes <span className="text-foreground">{vaultName ?? "this vault"}</span>{" "}
              from {storageMode === "local" ? "this browser" : "decentralized Storj storage"}.
              {storageMode === "storj"
                ? " Every note, the audit log, and the Vault ID claim will be removed and the ID released."
                : " No remote data or Vault ID claim exists for this demo."}{" "}
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={destroying}
              className="font-mono text-xs uppercase tracking-widest"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={destroying}
              className="font-mono text-xs uppercase tracking-widest bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                setDestroying(true);
                try {
                  await destroyVault();
                  setDestroyOpen(false);
                  onClose();
                } finally {
                  setDestroying(false);
                }
              }}
            >
              {destroying ? "Destroying…" : "Destroy forever"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SessionTimeoutForm({
  value,
  onChange,
}: {
  value: number | "never";
  onChange: (value: number | "never") => void;
}) {
  const options: { value: number | "never"; label: string; hint: string }[] = [
    { value: 5, label: "5 min", hint: "Strict" },
    { value: 15, label: "15 min", hint: "Default" },
    { value: 30, label: "30 min", hint: "Balanced" },
    { value: 60, label: "1 hour", hint: "Relaxed" },
    { value: 120, label: "2 hours", hint: "Long work" },
    { value: "never", label: "Never", hint: "Manual lock" },
  ];

  return (
    <div className="space-y-4">
      <div className="border border-border bg-background/35 p-4">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-accent">
          Auto-lock timeout
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Choose how long SEES keeps this decrypted session open after inactivity. This preference
          is saved only in this browser.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => onChange(option.value)}
              className={`border p-4 text-left transition-colors ${
                active
                  ? "border-accent bg-accent/10 text-foreground"
                  : "border-border bg-background/30 text-muted-foreground hover:border-accent/50 hover:text-foreground"
              }`}
            >
              <span className="block font-mono text-[10px] uppercase tracking-widest">
                {option.label}
              </span>
              <span className="mt-1 block text-[11px] text-muted-foreground">{option.hint}</span>
            </button>
          );
        })}
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Security note: "Never" keeps the vault unlocked until you click Log Out or close the tab.
      </p>
    </div>
  );
}

function TwoFactorForm({
  enabled,
  vaultName,
  enable,
  disable,
}: {
  enabled: boolean;
  vaultName: string;
  enable: (secret: string, code: string) => Promise<void>;
  disable: (code: string) => Promise<void>;
}) {
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const secret = setupSecret ?? "";
  const setupUri = secret ? createTotpUri(secret, vaultName) : "";

  useEffect(() => {
    if (!setupUri) {
      setQrDataUrl(null);
      return;
    }

    let cancelled = false;
    QRCode.toDataURL(setupUri, {
      margin: 1,
      width: 192,
      color: {
        dark: "#ff7a2f",
        light: "#090604",
      },
    }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    }).catch(() => {
      if (!cancelled) setQrDataUrl(null);
    });

    return () => {
      cancelled = true;
    };
  }, [setupUri]);

  const startSetup = () => {
    setSetupSecret(generateTotpSecret());
    setCode("");
    setError(null);
    setDone(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setDone(null);
    setBusy(true);
    try {
      if (enabled) {
        await disable(code);
        setDone("2FA disabled.");
      } else {
        if (!setupSecret) throw new Error("Create a setup key first.");
        await enable(setupSecret, code);
        setSetupSecret(null);
        setDone("2FA enabled.");
      }
      setCode("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="border border-border bg-background/35 p-4">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-accent">
          Authenticator 2FA
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Add a 6-digit code from your authenticator app when opening your vault.
        </p>
      </div>

      <div className="border border-border bg-background/30 p-4">
        <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Current status
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-sm text-foreground">
            {enabled ? "2FA is active" : "2FA is off"}
          </span>
          <span className={`font-mono text-[10px] uppercase tracking-widest ${enabled ? "text-accent" : "text-muted-foreground"}`}>
            {enabled ? "Protected" : "Optional"}
          </span>
        </div>
      </div>

      {!enabled && !setupSecret && (
        <button
          type="button"
          onClick={startSetup}
          className="w-full py-3 border border-accent/50 text-accent font-mono text-xs uppercase tracking-widest hover:bg-accent/10 transition-colors"
        >
          Generate setup key
        </button>
      )}

      {!enabled && setupSecret && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="flex size-52 items-center justify-center border border-accent/35 bg-background p-3">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="2FA setup QR code" className="size-full object-contain" />
              ) : (
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  QR loading…
                </span>
              )}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Scan this QR code with your authenticator app, then enter the 6-digit code below.
            </p>
          </div>
          <div className="border border-accent/35 bg-accent/10 p-4">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-accent">
              Manual setup key
            </div>
            <code className="block break-all font-mono text-sm text-foreground">
              {formatTotpSecret(setupSecret)}
            </code>
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase text-muted-foreground mb-2 tracking-widest">
              Authenticator app URI
            </label>
            <input
              readOnly
              value={setupUri}
              onFocus={(event) => event.currentTarget.select()}
              className="w-full bg-background border border-border p-3 font-mono text-[11px] text-muted-foreground focus:outline-none focus:border-accent"
            />
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            You can also copy the manual key if your app cannot scan the QR code.
          </p>
        </div>
      )}

      {(enabled || setupSecret) && (
        <div>
          <label className="block font-mono text-[10px] uppercase text-muted-foreground mb-2 tracking-widest">
            6-digit code
          </label>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            className="w-full bg-background border border-border p-3 font-mono text-accent focus:outline-none focus:border-accent"
          />
        </div>
      )}

      {error && (
        <p className="text-xs font-mono text-destructive border border-destructive/40 bg-destructive/10 p-3">
          ! {error}
        </p>
      )}
      {done && (
        <p className="text-xs font-mono text-accent border border-accent/40 bg-accent/10 p-3">
          ✓ {done}
        </p>
      )}

      {(enabled || setupSecret) && (
        <button
          type="submit"
          disabled={busy || code.length !== 6}
          className="w-full py-3 bg-accent text-accent-foreground font-mono text-xs uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110"
        >
          {busy ? "Verifying…" : enabled ? "Disable 2FA" : "Enable 2FA"}
        </button>
      )}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Keep your authenticator app safe. You will need it together with your passphrase to open
        this vault.
      </p>
    </form>
  );
}

function ChangePassphraseForm({
  change,
  onDone,
}: {
  change: (oldP: string, newP: string) => Promise<void>;
  onDone: () => void;
}) {
  const [oldP, setOldP] = useState("");
  const [newP, setNewP] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newP !== confirm) {
      setError("New passphrases do not match.");
      return;
    }
    if (newP.length < 3) {
      setError("New passphrase must be at least 3 characters.");
      return;
    }
    if (newP === oldP) {
      setError("New passphrase must differ from the current one.");
      return;
    }
    setBusy(true);
    try {
      await change(oldP, newP);
      setDone(true);
      setOldP("");
      setNewP("");
      setConfirm("");
      window.setTimeout(onDone, 1500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-xs text-muted-foreground leading-relaxed">
        Re-encrypts every note under a new key. Your Vault ID and notes are preserved. The old
        passphrase stops working immediately on every device.
      </p>
      <div>
        <label className="block font-mono text-[10px] uppercase text-muted-foreground mb-2 tracking-widest">
          Current Passphrase
        </label>
        <PasswordInput
          value={oldP}
          onChange={(e) => setOldP(e.target.value)}
          className="w-full bg-background border border-border p-3 font-mono text-accent focus:outline-none focus:border-accent"
        />
      </div>
      <div>
        <label className="block font-mono text-[10px] uppercase text-muted-foreground mb-2 tracking-widest">
          New Passphrase
        </label>
        <PasswordInput
          value={newP}
          onChange={(e) => setNewP(e.target.value)}
          className="w-full bg-background border border-border p-3 font-mono text-accent focus:outline-none focus:border-accent"
        />
      </div>
      <div>
        <label className="block font-mono text-[10px] uppercase text-muted-foreground mb-2 tracking-widest">
          Confirm New Passphrase
        </label>
        <PasswordInput
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full bg-background border border-border p-3 font-mono text-accent focus:outline-none focus:border-accent"
        />
      </div>
      {error && (
        <p className="text-xs font-mono text-destructive border border-destructive/40 bg-destructive/10 p-3">
          ! {error}
        </p>
      )}
      {done && (
        <p className="text-xs font-mono text-accent border border-accent/40 bg-accent/10 p-3">
          ✓ Passphrase rotated. Vault re-sealed.
        </p>
      )}
      <button
        type="submit"
        disabled={busy || !oldP || !newP || !confirm}
        className="w-full py-3 bg-accent text-accent-foreground font-mono text-xs uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110"
      >
        {busy ? "Re-encrypting…" : "Rotate Passphrase"}
      </button>
    </form>
  );
}

interface NotesPanelProps {
  notes: DecryptedNote[];
  activeCount: number;
  trashCount: number;
  loading: boolean;
  search: string;
  setSearch: (v: string) => void;
  tagFilter: string | null;
  setTagFilter: (v: string | null) => void;
  allTags: string[];
  allFolders: string[];
  folderCounts: { map: Record<string, number>; uncategorized: number };
  folderFilter: string | null;
  setFolderFilter: (v: string | null) => void;
  onCreateFolder: (name: string) => void;
  onRenameFolder: (oldName: string, next: string) => void | Promise<void>;
  onDeleteFolder: (name: string) => void | Promise<void>;
  sortMode: SortMode;
  setSortMode: (v: SortMode) => void;
  view: ViewMode;
  setView: (v: ViewMode) => void;
  selectedIds: Set<string>;
  setSelectedIds: (s: Set<string>) => void;
  onBulkTrash: () => void;
  onBulkRestore: () => void;
  onBulkDeleteForever: () => void;
  onBulkMoveToFolder: (folder: string | undefined) => void;
  activeNote: DecryptedNote | null;
  isNew: boolean;
  draftTitle: string;
  draftBody: string;
  draftTags: string[];
  draftPinned: boolean;
  draftFolder: string | undefined;
  setDraftTitle: (v: string) => void;
  setDraftBody: (v: string) => void;
  setDraftTags: (v: string[]) => void;
  setDraftPinned: (v: boolean) => void;
  setDraftFolder: (v: string | undefined) => void;
  isDirty: boolean;
  onOpen: (n: DecryptedNote) => void;
  onNew: () => void;
  onClose: () => void;
  onRefresh: () => void | Promise<void>;
  onSave: () => void;
  onDelete: () => void;
  showToast: (msg: string) => void;
}

function NotesPanel(props: NotesPanelProps) {
  const {
    notes, activeCount, trashCount, loading, search, setSearch, tagFilter, setTagFilter, allTags,
    allFolders, folderCounts, folderFilter, setFolderFilter,
    onCreateFolder, onRenameFolder, onDeleteFolder,
    sortMode, setSortMode, view, setView, selectedIds, setSelectedIds,
    onBulkTrash, onBulkRestore, onBulkDeleteForever, onBulkMoveToFolder,
    activeNote, isNew, draftTitle, draftBody, draftTags, draftPinned, draftFolder,
    setDraftTitle, setDraftBody, setDraftTags, setDraftPinned, setDraftFolder,
    isDirty, onOpen, onNew, onClose, onRefresh, onSave, onDelete, showToast,
  } = props;

  const editing = isNew || activeNote !== null;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  
  const bodyMatchCount =
    activeNote && search.trim() ? countMatches(activeNote.body, search) : 0;

  const selectedCount = selectedIds.size;
  const inTrash = view === "trash";
  const totalCount = inTrash ? trashCount : activeCount;
  const allVisibleSelected = notes.length > 0 && notes.every((n) => selectedIds.has(n.id));

  const toggleId = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };
  const toggleAll = () => {
    if (allVisibleSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(notes.map((n) => n.id)));
  };
  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  return (
    <>
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border px-6 sm:px-8 py-5">
        <div className="flex items-center gap-3">
          <Tip label={sidebarOpen ? "Hide notes list" : "Show notes list"}>
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label={sidebarOpen ? "Hide notes list" : "Show notes list"}
              className="hidden lg:flex font-mono text-[10px] uppercase tracking-widest border border-border size-8 items-center justify-center hover:border-accent hover:text-accent transition-colors"
            >
              {sidebarOpen ? "‹" : "›"}
            </button>
          </Tip>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent mb-1">
              {inTrash ? "Trash · 30d retention" : "Encrypted Notes"}
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">
              {inTrash ? "Recently Deleted." : "Plaintext, Sealed."}
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start flex-wrap">
          <div className="flex border border-border font-mono text-[10px] uppercase tracking-widest">
            <button
              onClick={() => setView("notes")}
              className={`px-3 py-2 transition-colors ${
                !inTrash ? "bg-accent/10 text-accent" : "text-muted-foreground hover:text-accent"
              }`}
            >
              Notes <span className="opacity-60">({activeCount})</span>
            </button>
            <button
              onClick={() => setView("trash")}
              className={`px-3 py-2 border-l border-border transition-colors ${
                inTrash ? "bg-accent/10 text-accent" : "text-muted-foreground hover:text-accent"
              }`}
            >
              Trash <span className="opacity-60">({trashCount})</span>
            </button>
          </div>
          <Tip label={selectMode ? "Exit selection mode" : "Select multiple notes"}>
            <button
              onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
              className={`font-mono text-[10px] uppercase tracking-widest border px-3 py-2 transition-colors ${
                selectMode
                  ? "border-accent text-accent bg-accent/10"
                  : "border-border text-muted-foreground hover:border-accent hover:text-accent"
              }`}
            >
              {selectMode ? "Done" : "Select"}
            </button>
          </Tip>
          <Tip label="Sync">
            <button
              onClick={() => {
                void Promise.resolve(onRefresh()).then(() => showToast("Refreshed."));
              }}
              disabled={loading}
              aria-label="Refresh notes"
              className="font-mono text-[10px] uppercase tracking-widest border border-border size-9 flex items-center justify-center hover:border-accent hover:text-accent transition-colors disabled:opacity-40"
            >
              <span className={loading ? "inline-block animate-spin" : "inline-block"}>↻</span>
            </button>
          </Tip>
          {!inTrash && (
            <button
              onClick={onNew}
              className="px-4 py-2 bg-accent text-accent-foreground font-mono text-xs uppercase tracking-widest font-bold hover:brightness-110 transition-all shadow-glow"
            >
              + New Note
            </button>
          )}
        </div>
      </header>

      {selectMode && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface/50 px-6 sm:px-8 py-3 font-mono text-[10px] uppercase tracking-widest">
          <button
            onClick={toggleAll}
            className="border border-border px-2 py-1 hover:border-accent hover:text-accent"
          >
            {allVisibleSelected ? "Clear all" : "Select all"}
          </button>
          <span className="text-muted-foreground">{selectedCount} selected</span>
          <div className="ml-auto flex flex-wrap gap-2">
            {inTrash ? (
              <>
                <button
                  onClick={onBulkRestore}
                  disabled={!selectedCount}
                  className="border border-border px-3 py-1 hover:border-accent hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Restore
                </button>
                <button
                  onClick={onBulkDeleteForever}
                  disabled={!selectedCount}
                  className="border border-destructive/60 text-destructive px-3 py-1 hover:bg-destructive/10 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Delete forever
                </button>
              </>
            ) : (
              <>
                <MoveToFolderMenu
                  folders={allFolders}
                  disabled={!selectedCount}
                  onMove={(folder) => onBulkMoveToFolder(folder)}
                />
                <button
                  onClick={onBulkTrash}
                  disabled={!selectedCount}
                  className="border border-destructive/60 text-destructive px-3 py-1 hover:bg-destructive/10 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      )}


      <div
        className={`grid grid-cols-1 ${sidebarOpen ? "lg:grid-cols-[300px_1fr]" : "lg:grid-cols-[1fr]"} flex-1 min-h-0`}
      >
        {(sidebarOpen || !editing) && (
          <div className={`border-b lg:border-b-0 lg:border-r border-border flex flex-col min-h-0 ${editing ? "hidden lg:flex" : "flex"}`}>
            <div className="p-3 border-b border-border bg-surface/30 space-y-2">
              <div className="relative">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search notes..."
                  className="w-full bg-background border border-border pl-8 pr-8 py-2 font-mono text-xs focus:outline-none focus:border-accent transition-colors placeholder:text-muted-foreground/50"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
                  /
                </span>
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground hover:text-accent"
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <SortDropdown value={sortMode} onChange={setSortMode} />
              </div>
            </div>

            {!inTrash && (
              <FolderList
                folders={allFolders}
                counts={folderCounts}
                activeFilter={folderFilter}
                onSelect={setFolderFilter}
                onCreate={onCreateFolder}
                onRename={onRenameFolder}
                onDelete={onDeleteFolder}
              />
            )}

            <div className="p-3 border-b border-border bg-surface/20 space-y-2">


              {allTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tagFilter && (
                    <button
                      onClick={() => setTagFilter(null)}
                      className="font-mono text-[10px] uppercase tracking-widest border border-accent text-accent px-1.5 py-0.5 hover:bg-accent/10"
                    >
                      × {tagFilter}
                    </button>
                  )}
                  {!tagFilter &&
                    allTags.slice(0, 8).map((t) => (
                      <button
                        key={t}
                        onClick={() => setTagFilter(t)}
                        className="font-mono text-[10px] uppercase tracking-widest border border-border text-muted-foreground px-1.5 py-0.5 hover:border-accent hover:text-accent"
                      >
                        #{t}
                      </button>
                    ))}
                </div>
              )}

              {(search || tagFilter) && (
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {notes.length} / {totalCount} match
                </div>
              )}
            </div>

            <div className="overflow-auto flex-1">
              {loading ? (
                <Empty label="Decrypting..." />
              ) : notes.length === 0 ? (
                <Empty label={search || tagFilter ? "No matches." : "No notes yet."} />
              ) : (
                <ul>
                  {notes.map((n) => {
                    const snip = search.trim() ? snippet(n.body, search) : null;
                    const checked = selectedIds.has(n.id);
                    const daysLeft =
                      n.deletedAt
                        ? Math.max(0, Math.ceil((n.deletedAt + TRASH_RETENTION_MS - Date.now()) / 86_400_000))
                        : null;
                    return (
                      <li key={n.id} className="flex items-stretch border-b border-border">
                        {selectMode && (
                          <label className="flex items-center pl-4 pr-1 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleId(n.id)}
                              className="size-4 accent-accent cursor-pointer"
                              aria-label={`Select ${n.title}`}
                            />
                          </label>
                        )}
                        <button
                          onClick={() => (selectMode ? toggleId(n.id) : onOpen(n))}
                          className={`flex-1 text-left px-5 py-4 hover:bg-surface transition-colors ${
                            activeNote?.id === n.id ? "bg-surface border-l-2 border-l-accent" : ""
                          } ${checked ? "bg-accent/5" : ""}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {n.pinned && <span className="text-accent font-mono text-xs">●</span>}
                            <div className="font-mono text-sm truncate flex-1">
                              {highlight(n.title, search)}
                            </div>
                          </div>
                          {snip && (
                            <div className="font-mono text-[11px] text-muted-foreground/80 mb-1 line-clamp-2 whitespace-pre-wrap break-words">
                              {highlight(snip, search)}
                            </div>
                          )}
                          {n.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-1">
                              {n.tags.slice(0, 4).map((t) => (
                                <span
                                  key={t}
                                  className="font-mono text-[9px] uppercase tracking-widest text-accent/80 border border-accent/30 px-1"
                                >
                                  #{t}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="font-mono text-[10px] text-muted-foreground/70 uppercase tracking-widest flex items-center gap-2">
                            <span>{formatTime(n.updatedAt)}</span>
                            {n.folder && !n.deletedAt && (
                              <span className="text-accent/80">· ▣ {n.folder}</span>
                            )}
                            {daysLeft !== null && (
                              <span className="text-destructive/80">
                                · purges in {daysLeft}d
                              </span>
                            )}
                          </div>

                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}

        <div className={`overflow-auto p-6 sm:p-8 ${!editing ? "hidden lg:block" : "block"}`}>
          {editing ? (
            <Editor
              isNew={isNew}
              activeNote={activeNote}
              draftTitle={draftTitle}
              draftBody={draftBody}
              draftTags={draftTags}
              draftPinned={draftPinned}
              draftFolder={draftFolder}
              allFolders={allFolders}
              onCreateFolder={onCreateFolder}
              setDraftTitle={setDraftTitle}
              setDraftBody={setDraftBody}
              setDraftTags={setDraftTags}
              setDraftPinned={setDraftPinned}
              setDraftFolder={setDraftFolder}
              isDirty={isDirty}
              bodyMatchCount={bodyMatchCount}
              onSave={onSave}
              onClose={onClose}
              onDelete={onDelete}
              showToast={showToast}
            />

          ) : (
            <Empty label="Select a note or create a new one." />
          )}
        </div>
      </div>
    </>
  );
}

interface EditorProps {
  isNew: boolean;
  activeNote: DecryptedNote | null;
  draftTitle: string;
  draftBody: string;
  draftTags: string[];
  draftPinned: boolean;
  draftFolder: string | undefined;
  allFolders: string[];
  onCreateFolder: (name: string) => void;
  setDraftTitle: (v: string) => void;
  setDraftBody: (v: string) => void;
  setDraftTags: (v: string[]) => void;
  setDraftPinned: (v: boolean) => void;
  setDraftFolder: (v: string | undefined) => void;
  isDirty: boolean;
  bodyMatchCount: number;
  onSave: () => void;
  onClose: () => void;
  onDelete: () => void;
  showToast: (msg: string) => void;
}

function Editor(props: EditorProps) {
  const {
    isNew, activeNote, draftTitle, draftBody, draftTags, draftPinned, draftFolder,
    allFolders, onCreateFolder,
    setDraftTitle, setDraftBody, setDraftTags, setDraftPinned, setDraftFolder,
    isDirty, bodyMatchCount, onSave, onClose, onDelete, showToast,
  } = props;


  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [findTerm, setFindTerm] = useState("");

  const [tagInput, setTagInput] = useState("");
  
  const [shareOpen, setShareOpen] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [fullscreen, setFullscreen] = useState(false);

  // Esc exits fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [fullscreen]);

  // Ctrl/Cmd+F → toggle find bar
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setFindOpen((v) => !v);
      } else if (e.key === "Escape" && findOpen) {
        setFindOpen(false);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [findOpen]);

  const stats = useMemo(() => {
    const text = draftBody;
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const minutes = Math.max(1, Math.round(words / 200));
    return { chars, words, minutes };
  }, [draftBody]);

  const findCount = useMemo(
    () => (findTerm ? countMatches(draftBody, findTerm) : 0),
    [findTerm, draftBody],
  );

  const findNext = () => {
    const ta = textareaRef.current;
    if (!ta || !findTerm) return;
    const lower = draftBody.toLowerCase();
    const term = findTerm.toLowerCase();
    const from = ta.selectionEnd;
    let idx = lower.indexOf(term, from);
    if (idx < 0) idx = lower.indexOf(term, 0);
    if (idx >= 0) {
      ta.focus();
      ta.setSelectionRange(idx, idx + findTerm.length);
    }
  };

  const addTag = (raw: string) => {
    const t = raw.trim().toLowerCase().replace(/\s+/g, "-").replace(/^#+/, "");
    if (!t) return;
    if (draftTags.includes(t)) return;
    setDraftTags([...draftTags, t]);
    setTagInput("");
  };
  const removeTag = (t: string) => setDraftTags(draftTags.filter((x) => x !== t));

  const copyBody = async () => {
    try {
      await navigator.clipboard.writeText(draftBody);
      showToast("Copied · auto-clears in 30s");
      window.setTimeout(() => {
        navigator.clipboard.writeText("").catch(() => {});
      }, 30_000);
    } catch {
      showToast("Copy failed");
    }
  };


  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-50 bg-background overflow-auto p-6 sm:p-8"
          : "max-w-5xl"
      }
    >
      <button
        type="button"
        onClick={onClose}
        className="lg:hidden mb-3 flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-accent transition-colors"
      >
        ← Back
      </button>
      <input
        value={draftTitle}
        onChange={(e) => setDraftTitle(e.target.value)}
        placeholder="Title..."
        className="w-full bg-transparent text-2xl sm:text-3xl font-semibold tracking-tight focus:outline-none mb-2 placeholder:text-muted-foreground/40"
      />

      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-3 flex-wrap">
        <span>
          {isNew
            ? "NEW NOTE"
            : `EDITING · ${activeNote ? formatTime(activeNote.updatedAt) : ""}`}
        </span>
        {isDirty && <span className="text-accent">● UNSAVED</span>}
        {bodyMatchCount > 0 && (
          <span className="text-accent">
            {bodyMatchCount} MATCH{bodyMatchCount === 1 ? "" : "ES"} IN BODY
          </span>
        )}
        <span className="ml-auto flex items-center gap-3">
          <span>{stats.words} W</span>
          <span>{stats.chars} C</span>
          <span>~{stats.minutes} MIN</span>
        </span>
      </div>

      {/* Tags row */}
      <div className="flex items-center flex-wrap gap-2 mb-4">
        <Tip label={draftPinned ? "Unpin from top" : "Pin to top of list"}>
          <button
            onClick={() => setDraftPinned(!draftPinned)}
            className={`font-mono text-[10px] uppercase tracking-widest border px-2 py-1 transition-colors ${
              draftPinned
                ? "border-accent text-accent bg-accent/10"
                : "border-border text-muted-foreground hover:border-accent hover:text-accent"
            }`}
          >
            {draftPinned ? "● PINNED" : "○ PIN"}
          </button>
        </Tip>
        <FolderPicker
          value={draftFolder}
          folders={allFolders}
          onChange={setDraftFolder}
          onCreate={onCreateFolder}
        />

        {draftTags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest border border-accent/40 text-accent px-2 py-1"
          >
            #{t}
            <button
              onClick={() => removeTag(t)}
              aria-label={`Remove ${t}`}
              className="hover:text-destructive"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTag(tagInput);
            } else if (e.key === "Backspace" && !tagInput && draftTags.length) {
              removeTag(draftTags[draftTags.length - 1]);
            }
          }}
          onBlur={() => tagInput && addTag(tagInput)}
          placeholder="add tag…"
          className="bg-transparent border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-widest w-28 focus:outline-none focus:border-accent placeholder:text-muted-foreground/50"
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border border-border bg-surface/40 p-1 mb-0">
        <ToolBtn
          label="Find"
          title="Find & replace (Ctrl/Cmd+F)"
          onClick={() => setFindOpen((v) => !v)}
          active={findOpen}
        />
        <ToolBtn label="Copy" title="Copy body (auto-clears 30s)" onClick={copyBody} />
        <ToolBtn
          label="Share"
          title="Generate a shareable link"
          onClick={() => setShareOpen(true)}
        />
        <ToolBtn
          label="A+"
          title="Zoom in"
          onClick={() => setFontSize((s) => Math.min(28, s + 1))}
        />
        <ToolBtn
          label="A−"
          title="Zoom out"
          onClick={() => setFontSize((s) => Math.max(10, s - 1))}
        />
        <ToolBtn
          label={fullscreen ? "Shrink" : "Expand"}
          title={fullscreen ? "Exit fullscreen (Esc)" : "Expand editor"}
          onClick={() => setFullscreen((v) => !v)}
          active={fullscreen}
        />
      </div>

      {findOpen && (
        <div className="flex flex-wrap items-center gap-2 border-x border-b border-border bg-surface/30 p-2">
          <input
            autoFocus
            value={findTerm}
            onChange={(e) => setFindTerm(e.target.value)}
            placeholder="Find..."
            className="bg-background border border-border px-2 py-1 font-mono text-xs focus:outline-none focus:border-accent"
          />
          <button
            onClick={findNext}
            className="font-mono text-[10px] uppercase tracking-widest border border-border px-2 py-1 hover:border-accent hover:text-accent"
          >
            Next
          </button>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground ml-auto">
            {findCount} match{findCount === 1 ? "" : "es"}
          </span>
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={draftBody}
        onChange={(e) => setDraftBody(e.target.value)}
        placeholder="Type your secret. It encrypts on save. (⌘/Ctrl+S to save, ⌘/Ctrl+F to find)"
        rows={fullscreen ? 32 : 18}
        style={{ fontSize: `${fontSize}px` }}
        className="w-full bg-transparent font-mono leading-relaxed focus:outline-none resize-none placeholder:text-muted-foreground/40 p-4 border-x border-b border-border"
      />
      <div className="flex flex-wrap gap-3 mt-6">
        <button
          onClick={onSave}
          disabled={!isDirty || (!draftTitle.trim() && !draftBody.trim())}
          className="px-5 py-2 bg-accent text-accent-foreground font-mono text-xs uppercase tracking-widest font-bold hover:brightness-110 transition-all shadow-glow disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
        >
          Encrypt &amp; Save
        </button>
        <button
          onClick={onClose}
          className="px-5 py-2 border border-border font-mono text-xs uppercase tracking-widest text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
        >
          Close
        </button>
        {!isNew && activeNote && (
          <button
            onClick={onDelete}
            className="px-5 py-2 border border-border font-mono text-xs uppercase tracking-widest text-muted-foreground hover:border-destructive hover:text-destructive transition-colors ml-auto"
          >
            {activeNote.deletedAt ? "Delete forever" : "Delete"}
          </button>
        )}
      </div>
      {shareOpen && (
        <ShareDialog
          title={draftTitle}
          body={draftBody}
          tags={draftTags}
          onClose={() => setShareOpen(false)}
          showToast={showToast}
        />
      )}
    </div>
  );
}

function ShareDialog({
  title,
  body,
  tags,
  onClose,
  showToast,
}: {
  title: string;
  body: string;
  tags: string[];
  onClose: () => void;
  showToast: (msg: string) => void;
}) {
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [expiryIdx, setExpiryIdx] = useState(2); // default 24h
  const [link, setLink] = useState("");
  const [currentShareId, setCurrentShareId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [activeShares, setActiveShares] = useState<OwnedShare[]>(() => loadOwnedShares());
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const generate = async () => {
    setErr(null);
    if (!body.trim() && !title.trim()) {
      setErr("Nothing to share — note is empty.");
      return;
    }
    if (usePassword && password.length < 4) {
      setErr("Password must be at least 4 characters.");
      return;
    }
    setBusy(true);
    try {
      const result = await buildShareUrl(
        window.location.origin,
        { title, body, tags },
        {
          password: usePassword ? password : undefined,
          expiresInMs: EXPIRY_OPTIONS[expiryIdx].ms,
        },
      );
      // Register revoke record server-side BEFORE handing the link to the user
      // so revocation is guaranteed to work later.
      try {
        await registerShare({
          data: { shareId: result.shareId, revokeHash: result.revokeHash },
        });
      } catch {
        // Non-fatal: link still works, but revoke won't. Warn the user.
        showToast("Share created (revoke registry offline)");
      }
      const owned: OwnedShare = {
        shareId: result.shareId,
        revokeSecret: result.revokeSecret,
        label: title.trim() || "Untitled",
        createdAt: Date.now(),
        expiresAt: EXPIRY_OPTIONS[expiryIdx].ms
          ? Date.now() + EXPIRY_OPTIONS[expiryIdx].ms!
          : null,
        password: usePassword,
      };
      const next = [owned, ...activeShares].slice(0, 50);
      saveOwnedShares(next);
      setActiveShares(next);
      setCurrentShareId(result.shareId);
      setLink(result.url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to build link");
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      showToast("Link copied");
    } catch {
      showToast("Copy failed");
    }
  };

  const doRevoke = async (s: OwnedShare) => {
    setRevokingId(s.shareId);
    try {
      const res = await revokeShare({
        data: { shareId: s.shareId, revokeSecret: s.revokeSecret },
      });
      if (res.ok) {
        const next = activeShares.filter((x) => x.shareId !== s.shareId);
        saveOwnedShares(next);
        setActiveShares(next);
        if (currentShareId === s.shareId) {
          setLink("");
          setCurrentShareId(null);
        }
        showToast(res.alreadyRevoked ? "Already revoked" : "Share revoked");
      } else {
        showToast(`Revoke failed: ${res.reason}`);
      }
    } catch {
      showToast("Revoke failed");
    } finally {
      setRevokingId(null);
    }
  };

  const forget = (s: OwnedShare) => {
    const next = activeShares.filter((x) => x.shareId !== s.shareId);
    saveOwnedShares(next);
    setActiveShares(next);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-surface border border-border shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="border-b border-border px-5 py-3 flex items-center justify-between">
          <div className="font-mono text-[10px] uppercase tracking-widest text-accent">
            Share securely
          </div>
          <button
            onClick={onClose}
            className="font-mono text-xs text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-5 space-y-5">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
              Protection
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setUsePassword(false)}
                className={`px-3 py-2 border font-mono text-[10px] uppercase tracking-widest transition-colors ${
                  !usePassword
                    ? "border-accent text-accent bg-accent/10"
                    : "border-border text-muted-foreground hover:border-accent hover:text-accent"
                }`}
              >
                No password
              </button>
              <button
                onClick={() => setUsePassword(true)}
                className={`px-3 py-2 border font-mono text-[10px] uppercase tracking-widest transition-colors ${
                  usePassword
                    ? "border-accent text-accent bg-accent/10"
                    : "border-border text-muted-foreground hover:border-accent hover:text-accent"
                }`}
              >
                Custom password
              </button>
            </div>
            {usePassword && (
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Set a password..."
                className="mt-3 w-full bg-background border border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-accent"
              />
            )}
            <p className="font-mono text-[10px] tracking-wide text-muted-foreground mt-2 leading-relaxed">
              {usePassword
                ? "Recipient must enter this password to decrypt. Share it through a separate channel."
                : "Anyone with the link can read the note. The key lives only in the URL fragment — never sent to a server."}
            </p>
          </div>

          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
              Expires after
            </div>
            <div className="flex flex-wrap gap-2">
              {EXPIRY_OPTIONS.map((opt, i) => (
                <button
                  key={opt.label}
                  onClick={() => setExpiryIdx(i)}
                  className={`px-3 py-1.5 border font-mono text-[10px] uppercase tracking-widest transition-colors ${
                    expiryIdx === i
                      ? "border-accent text-accent bg-accent/10"
                      : "border-border text-muted-foreground hover:border-accent hover:text-accent"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {err && (
            <div className="font-mono text-[10px] uppercase tracking-widest text-destructive border border-destructive/40 bg-destructive/10 p-2">
              {err}
            </div>
          )}

          {link ? (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                Your link
              </div>
              <textarea
                readOnly
                value={link}
                rows={3}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full bg-background border border-accent/40 px-3 py-2 font-mono text-xs break-all focus:outline-none resize-none"
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={copyLink}
                  className="flex-1 px-4 py-2 bg-accent text-accent-foreground font-mono text-xs uppercase tracking-widest font-bold hover:brightness-110"
                >
                  Copy link
                </button>
                {currentShareId && (
                  <button
                    onClick={() => {
                      const s = activeShares.find((x) => x.shareId === currentShareId);
                      if (s) doRevoke(s);
                    }}
                    disabled={revokingId === currentShareId}
                    className="px-4 py-2 border border-destructive/50 text-destructive font-mono text-xs uppercase tracking-widest hover:bg-destructive/10 disabled:opacity-40"
                  >
                    {revokingId === currentShareId ? "Revoking..." : "Revoke"}
                  </button>
                )}
                <button
                  onClick={() => {
                    setLink("");
                    setCurrentShareId(null);
                  }}
                  className="px-4 py-2 border border-border font-mono text-xs uppercase tracking-widest text-muted-foreground hover:border-foreground hover:text-foreground"
                >
                  New
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={generate}
              disabled={busy}
              className="w-full px-4 py-2 bg-accent text-accent-foreground font-mono text-xs uppercase tracking-widest font-bold hover:brightness-110 disabled:opacity-40"
            >
              {busy ? "Encrypting..." : "Generate link"}
            </button>
          )}

          {activeShares.length > 0 && (
            <div className="border-t border-border pt-4">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center justify-between">
                <span>Active shares ({activeShares.length})</span>
                <span className="text-muted-foreground/60 normal-case tracking-normal">
                  on this device
                </span>
              </div>
              <ul className="space-y-2 max-h-56 overflow-y-auto">
                {activeShares.map((s) => {
                  const expired = s.expiresAt !== null && s.expiresAt < Date.now();
                  return (
                    <li
                      key={s.shareId}
                      className="border border-border bg-background/40 p-2 flex items-center gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-xs truncate">{s.label}</div>
                        <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mt-0.5">
                          {new Date(s.createdAt).toLocaleString()} ·{" "}
                          {s.password ? "password" : "open"} ·{" "}
                          <span className={expired ? "text-destructive" : "text-accent"}>
                            {s.expiresAt === null
                              ? "no expiry"
                              : expired
                                ? "expired"
                                : `expires ${new Date(s.expiresAt).toLocaleString()}`}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => doRevoke(s)}
                        disabled={revokingId === s.shareId}
                        className="px-2 py-1 border border-destructive/50 text-destructive font-mono text-[10px] uppercase tracking-widest hover:bg-destructive/10 disabled:opacity-40"
                      >
                        {revokingId === s.shareId ? "..." : "Revoke"}
                      </button>
                      <button
                        onClick={() => forget(s)}
                        title="Forget locally without revoking"
                        className="px-2 py-1 border border-border text-muted-foreground font-mono text-[10px] uppercase tracking-widest hover:border-foreground hover:text-foreground"
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="font-mono text-[9px] tracking-wide text-muted-foreground mt-2 leading-relaxed">
                Revoke secrets are stored only in this browser. Clearing site data
                will lose the ability to revoke from this device.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Owned share registry (localStorage, per device) -----------------------
interface OwnedShare {
  shareId: string;
  revokeSecret: string;
  label: string;
  createdAt: number;
  expiresAt: number | null;
  password: boolean;
}

const OWNED_SHARES_KEY = "kn.ownedShares.v1";

function loadOwnedShares(): OwnedShare[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(OWNED_SHARES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is OwnedShare =>
        s &&
        typeof s.shareId === "string" &&
        /^[a-f0-9]{32}$/.test(s.shareId) &&
        typeof s.revokeSecret === "string" &&
        /^[a-f0-9]{32}$/.test(s.revokeSecret),
    );
  } catch {
    return [];
  }
}

function saveOwnedShares(list: OwnedShare[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(OWNED_SHARES_KEY, JSON.stringify(list));
  } catch {
    // quota — ignore
  }
}


function ToolBtn({
  label,
  title,
  onClick,
  active,
  bold,
  italic,
}: {
  label: string;
  title: string;
  onClick: () => void;
  active?: boolean;
  bold?: boolean;
  italic?: boolean;
}) {
  return (
    <Tip label={title}>
      <button
        type="button"
        onClick={onClick}
        className={`font-mono text-xs px-2 py-1 border border-transparent hover:border-accent hover:text-accent transition-colors ${
          active ? "text-accent border-accent bg-accent/10" : "text-muted-foreground"
        } ${bold ? "font-bold" : ""} ${italic ? "italic" : ""}`}
      >
        {label}
      </button>
    </Tip>
  );
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlight(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;
  const re = new RegExp(`(${escapeRegExp(q)})`, "gi");
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="bg-accent/30 text-accent px-0.5 rounded-sm">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function countMatches(text: string, query: string) {
  const q = query.trim();
  if (!q) return 0;
  const re = new RegExp(escapeRegExp(q), "gi");
  return (text.match(re) || []).length;
}

function snippet(text: string, query: string, radius = 60) {
  const q = query.trim();
  if (!q) return null;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return null;
  const start = Math.max(0, i - radius);
  const end = Math.min(text.length, i + q.length + radius);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-border bg-surface p-4 sm:p-5">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
        {label}
      </div>
      {children}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-muted-foreground font-mono text-xs uppercase tracking-widest text-center px-6">
      {label}
    </div>
  );
}

function Tip({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="bottom"
        className="font-mono text-[10px] uppercase tracking-widest bg-surface border border-accent/40 text-accent shadow-glow"
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

const SORT_LABELS: Record<SortMode, string> = {
  updated: "Updated",
  title: "Title A-Z",
  pinned: "Pinned First",
};

function SortDropdown({
  value,
  onChange,
}: {
  value: SortMode;
  onChange: (v: SortMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative flex-1">
      <Tip label="Change sort order">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`w-full flex items-center justify-between bg-background border px-2 py-1.5 font-mono text-[10px] uppercase tracking-widest transition-colors ${
            open
              ? "border-accent text-accent"
              : "border-border hover:border-accent hover:text-accent"
          }`}
        >
          <span>
            <span className="text-muted-foreground">Sort:</span> {SORT_LABELS[value]}
          </span>
          <span className={`ml-2 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
        </button>
      </Tip>
      {open && (
        <div className="absolute z-30 mt-1 left-0 right-0 bg-surface border border-border shadow-2xl shadow-black/60">
          {(Object.keys(SORT_LABELS) as SortMode[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                onChange(k);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 font-mono text-[10px] uppercase tracking-widest border-b border-border last:border-b-0 transition-colors ${
                k === value
                  ? "text-accent bg-accent/10"
                  : "text-muted-foreground hover:bg-accent/5 hover:text-accent"
              }`}
            >
              <span className="inline-block w-3">{k === value ? "▸" : ""}</span>
              {SORT_LABELS[k]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Folder UI components ─────────────────────────────────────────────────────

function FolderList({
  folders,
  counts,
  activeFilter,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: {
  folders: string[];
  counts: { map: Record<string, number>; uncategorized: number };
  activeFilter: string | null;
  onSelect: (v: string | null) => void;
  onCreate: (name: string) => void;
  onRename: (oldName: string, next: string) => void | Promise<void>;
  onDelete: (name: string) => void | Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const submitCreate = () => {
    if (draft.trim()) onCreate(draft.trim());
    setDraft("");
    setCreating(false);
  };
  const submitRename = (old: string) => {
    if (editDraft.trim() && editDraft.trim() !== old) void onRename(old, editDraft.trim());
    setEditing(null);
    setEditDraft("");
  };

  return (
    <div className="p-3 border-b border-border bg-surface/30 space-y-1">
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Folders
        </span>
        <button
          onClick={() => setCreating((v) => !v)}
          className="font-mono text-[10px] uppercase tracking-widest border border-border px-2 py-0.5 hover:border-accent hover:text-accent"
        >
          + New
        </button>
      </div>
      {creating && (
        <div className="flex gap-1 mb-1">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitCreate();
              else if (e.key === "Escape") {
                setCreating(false);
                setDraft("");
              }
            }}
            onBlur={submitCreate}
            placeholder="folder name"
            className="flex-1 bg-background border border-accent/40 px-2 py-1 font-mono text-xs focus:outline-none focus:border-accent"
          />
        </div>
      )}
      <button
        onClick={() => onSelect(null)}
        className={`w-full text-left px-2 py-1 font-mono text-[11px] uppercase tracking-widest flex items-center justify-between transition-colors ${
          activeFilter === null
            ? "text-accent bg-accent/10"
            : "text-muted-foreground hover:text-accent hover:bg-accent/5"
        }`}
      >
        <span>All notes</span>
      </button>
      <button
        onClick={() => onSelect(UNCATEGORIZED)}
        className={`w-full text-left px-2 py-1 font-mono text-[11px] uppercase tracking-widest flex items-center justify-between transition-colors ${
          activeFilter === UNCATEGORIZED
            ? "text-accent bg-accent/10"
            : "text-muted-foreground hover:text-accent hover:bg-accent/5"
        }`}
      >
        <span>Uncategorized</span>
        <span className="opacity-60">{counts.uncategorized}</span>
      </button>
      {folders.map((f) => {
        const active = activeFilter === f;
        const isEditing = editing === f;
        return (
          <div
            key={f}
            className={`group flex items-center gap-1 px-2 py-1 ${
              active ? "bg-accent/10" : "hover:bg-accent/5"
            }`}
          >
            {isEditing ? (
              <input
                autoFocus
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitRename(f);
                  else if (e.key === "Escape") {
                    setEditing(null);
                    setEditDraft("");
                  }
                }}
                onBlur={() => submitRename(f)}
                className="flex-1 bg-background border border-accent/40 px-1 py-0.5 font-mono text-[11px] focus:outline-none focus:border-accent"
              />
            ) : (
              <button
                onClick={() => onSelect(f)}
                className={`flex-1 text-left font-mono text-[11px] uppercase tracking-widest flex items-center justify-between truncate ${
                  active ? "text-accent" : "text-muted-foreground hover:text-accent"
                }`}
              >
                <span className="truncate">▣ {f}</span>
                <span className="opacity-60 ml-2">{counts.map[f] ?? 0}</span>
              </button>
            )}
            {!isEditing && (
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    setEditing(f);
                    setEditDraft(f);
                  }}
                  className="font-mono text-[10px] text-muted-foreground hover:text-accent px-1"
                  aria-label={`Rename ${f}`}
                >
                  ✎
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Delete folder "${f}"? Notes inside become uncategorized.`)) {
                      void onDelete(f);
                    }
                  }}
                  className="font-mono text-[10px] text-muted-foreground hover:text-destructive px-1"
                  aria-label={`Delete ${f}`}
                >
                  ×
                </button>
              </div>
            )}
          </div>
        );
      })}
      {folders.length === 0 && !creating && (
        <p className="font-mono text-[10px] text-muted-foreground/60 px-2 py-1">
          No folders yet
        </p>
      )}
    </div>
  );
}

function FolderPicker({
  value,
  folders,
  onChange,
  onCreate,
}: {
  value: string | undefined;
  folders: string[];
  onChange: (v: string | undefined) => void;
  onCreate: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`font-mono text-[10px] uppercase tracking-widest border px-2 py-1 transition-colors ${
          value
            ? "border-accent text-accent bg-accent/10"
            : "border-border text-muted-foreground hover:border-accent hover:text-accent"
        }`}
      >
        ▣ {value || "No folder"}
      </button>
      {open && (
        <div className="absolute z-30 mt-1 left-0 w-56 bg-surface border border-border shadow-2xl shadow-black/60 max-h-72 overflow-auto">
          <button
            onClick={() => {
              onChange(undefined);
              setOpen(false);
            }}
            className={`w-full text-left px-3 py-2 font-mono text-[10px] uppercase tracking-widest border-b border-border ${
              !value ? "text-accent bg-accent/10" : "text-muted-foreground hover:bg-accent/5 hover:text-accent"
            }`}
          >
            — No folder
          </button>
          {folders.map((f) => (
            <button
              key={f}
              onClick={() => {
                onChange(f);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 font-mono text-[10px] uppercase tracking-widest border-b border-border last:border-b-0 ${
                f === value ? "text-accent bg-accent/10" : "text-muted-foreground hover:bg-accent/5 hover:text-accent"
              }`}
            >
              ▣ {f}
            </button>
          ))}
          {creating ? (
            <div className="p-2 border-t border-border">
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const v = draft.trim();
                    if (v) {
                      onCreate(v);
                      onChange(v);
                    }
                    setDraft("");
                    setCreating(false);
                    setOpen(false);
                  } else if (e.key === "Escape") {
                    setCreating(false);
                    setDraft("");
                  }
                }}
                placeholder="new folder"
                className="w-full bg-background border border-accent/40 px-2 py-1 font-mono text-xs focus:outline-none focus:border-accent"
              />
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="w-full text-left px-3 py-2 font-mono text-[10px] uppercase tracking-widest border-t border-border text-accent hover:bg-accent/10"
            >
              + New folder
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MoveToFolderMenu({
  folders,
  disabled,
  onMove,
}: {
  folders: string[];
  disabled?: boolean;
  onMove: (folder: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="border border-border px-3 py-1 hover:border-accent hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Move to ▾
      </button>
      {open && (
        <div className="absolute z-30 mt-1 right-0 w-56 bg-surface border border-border shadow-2xl shadow-black/60 max-h-72 overflow-auto">
          <button
            onClick={() => {
              onMove(undefined);
              setOpen(false);
            }}
            className="w-full text-left px-3 py-2 font-mono text-[10px] uppercase tracking-widest border-b border-border text-muted-foreground hover:bg-accent/5 hover:text-accent"
          >
            — Uncategorized
          </button>
          {folders.length === 0 ? (
            <p className="px-3 py-2 font-mono text-[10px] text-muted-foreground/60">
              No folders yet
            </p>
          ) : (
            folders.map((f) => (
              <button
                key={f}
                onClick={() => {
                  onMove(f);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 font-mono text-[10px] uppercase tracking-widest border-b border-border last:border-b-0 text-muted-foreground hover:bg-accent/5 hover:text-accent"
              >
                ▣ {f}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
