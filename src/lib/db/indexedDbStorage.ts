import type { AudioTrackRecord, Setlist, Song, VoiceCue } from "../types/metronome";

const DB_NAME = "stick_click_drummer_db";
const DB_VERSION = 2;

const STORES = {
  SONGS: "songs",
  VOICE_CUES: "voice_cues",
  SETLISTS: "setlists",
  AUDIO_TRACKS: "audio_tracks",
} as const;

/**
 * Camada de Persistência Offline de Alta Performance com IndexedDB nativo
 * 
 * Permite operação 100% offline no celular, garantindo leitura e gravação
 * instantâneas sem travamentos ou limites de cota do localStorage.
 */
export class IndexedDBStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === "undefined" || !window.indexedDB) {
        reject(new Error("IndexedDB não é suportado neste ambiente"));
        return;
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store de Músicas
        if (!db.objectStoreNames.contains(STORES.SONGS)) {
          const songStore = db.createObjectStore(STORES.SONGS, { keyPath: "id" });
          songStore.createIndex("updatedAt", "updatedAt", { unique: false });
        }

        // Store de Comandos de Voz da Timeline
        if (!db.objectStoreNames.contains(STORES.VOICE_CUES)) {
          const cueStore = db.createObjectStore(STORES.VOICE_CUES, { keyPath: "id" });
          cueStore.createIndex("songId", "songId", { unique: false });
          cueStore.createIndex("measureNumber", "measureNumber", { unique: false });
        }

        // Store de Setlists
        if (!db.objectStoreNames.contains(STORES.SETLISTS)) {
          db.createObjectStore(STORES.SETLISTS, { keyPath: "id" });
        }

        // Store de Faixas de Áudio de Fundo (Backing Tracks MP3 / MP4)
        if (!db.objectStoreNames.contains(STORES.AUDIO_TRACKS)) {
          db.createObjectStore(STORES.AUDIO_TRACKS, { keyPath: "songId" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  // --------------------------------------------------------------------------
  // MÚSICAS (SONGS)
  // --------------------------------------------------------------------------

  public async getAllSongs(): Promise<Song[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SONGS, "readonly");
      const store = tx.objectStore(STORES.SONGS);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result as Song[]);
      request.onerror = () => reject(request.error);
    });
  }

  public async getSong(id: string): Promise<Song | undefined> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SONGS, "readonly");
      const store = tx.objectStore(STORES.SONGS);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result as Song | undefined);
      request.onerror = () => reject(request.error);
    });
  }

  public async saveSong(song: Song): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SONGS, "readwrite");
      const store = tx.objectStore(STORES.SONGS);
      const request = store.put({ ...song, updatedAt: new Date().toISOString() });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async deleteSong(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.SONGS, STORES.VOICE_CUES], "readwrite");
      const songStore = tx.objectStore(STORES.SONGS);
      const cueStore = tx.objectStore(STORES.VOICE_CUES);

      // Remove a música
      songStore.delete(id);

      // Remove em cascata todos os cues associados à música
      const cueIndex = cueStore.index("songId");
      const cueRequest = cueIndex.openCursor(IDBKeyRange.only(id));

      cueRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --------------------------------------------------------------------------
  // COMANDOS DE VOZ (VOICE CUES)
  // --------------------------------------------------------------------------

  public async getCuesBySong(songId: string): Promise<VoiceCue[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.VOICE_CUES, "readonly");
      const store = tx.objectStore(STORES.VOICE_CUES);
      const index = store.index("songId");
      const request = index.getAll(IDBKeyRange.only(songId));

      request.onsuccess = () => {
        const results = (request.result as VoiceCue[]).sort(
          (a, b) => a.measureNumber - b.measureNumber,
        );
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  public async saveVoiceCue(cue: VoiceCue): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.VOICE_CUES, "readwrite");
      const store = tx.objectStore(STORES.VOICE_CUES);
      const request = store.put(cue);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async deleteVoiceCue(cueId: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.VOICE_CUES, "readwrite");
      const store = tx.objectStore(STORES.VOICE_CUES);
      const request = store.delete(cueId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // --------------------------------------------------------------------------
  // SETLISTS (REPERTÓRIOS)
  // --------------------------------------------------------------------------

  public async getAllSetlists(): Promise<Setlist[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SETLISTS, "readonly");
      const store = tx.objectStore(STORES.SETLISTS);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result as Setlist[]);
      request.onerror = () => reject(request.error);
    });
  }

  public async saveSetlist(setlist: Setlist): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SETLISTS, "readwrite");
      const store = tx.objectStore(STORES.SETLISTS);
      const request = store.put({
        ...setlist,
        updatedAt: new Date().toISOString(),
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async deleteSetlist(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SETLISTS, "readwrite");
      const store = tx.objectStore(STORES.SETLISTS);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // --------------------------------------------------------------------------
  // FAIXAS DE ÁUDIO DE FUNDO (BACKING TRACKS MP3 / MP4)
  // --------------------------------------------------------------------------

  public async saveAudioTrack(songId: string, file: File): Promise<AudioTrackRecord> {
    const db = await this.getDB();
    const record: AudioTrackRecord = {
      songId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || "audio/mpeg",
      blob: file,
      updatedAt: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.AUDIO_TRACKS, "readwrite");
      const store = tx.objectStore(STORES.AUDIO_TRACKS);
      const request = store.put(record);

      request.onsuccess = () => resolve(record);
      request.onerror = () => reject(request.error);
    });
  }

  public async getAudioTrack(songId: string): Promise<AudioTrackRecord | undefined> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.AUDIO_TRACKS, "readonly");
      const store = tx.objectStore(STORES.AUDIO_TRACKS);
      const request = store.get(songId);

      request.onsuccess = () => resolve(request.result as AudioTrackRecord | undefined);
      request.onerror = () => reject(request.error);
    });
  }

  public async deleteAudioTrack(songId: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.AUDIO_TRACKS, "readwrite");
      const store = tx.objectStore(STORES.AUDIO_TRACKS);
      const request = store.delete(songId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// Instância singleton pronta para uso na aplicação
export const localDb = new IndexedDBStorage();
