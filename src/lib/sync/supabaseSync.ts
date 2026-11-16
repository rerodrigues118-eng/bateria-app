import { localDb } from "../db/indexedDbStorage";
import type { Setlist, Song, VoiceCue } from "../types/metronome";

export interface SupabaseSyncConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  getAccessToken?: () => Promise<string | null>;
}

export interface SyncResult {
  pushedSongs: number;
  pulledSongs: number;
  pushedCues: number;
  pulledCues: number;
  pushedSetlists: number;
  pulledSetlists: number;
  errors: string[];
}

/**
 * Serviço de Sincronização Bidirecional Offline-First entre IndexedDB e Supabase
 */
export class SupabaseSyncService {
  private config: SupabaseSyncConfig;

  constructor(config: SupabaseSyncConfig) {
    this.config = config;
  }

  private async fetchSupabase(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const token = this.config.getAccessToken ? await this.config.getAccessToken() : null;
    const headers = new Headers(options.headers || {});
    headers.set("apikey", this.config.supabaseAnonKey);
    headers.set("Content-Type", "application/json");
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const url = `${this.config.supabaseUrl}/rest/v1/${endpoint}`;
    return fetch(url, { ...options, headers });
  }

  /**
   * Executa a sincronização completa (Push de dados locais e Pull de atualizações remotas)
   */
  public async syncAll(): Promise<SyncResult> {
    const result: SyncResult = {
      pushedSongs: 0,
      pulledSongs: 0,
      pushedCues: 0,
      pulledCues: 0,
      pushedSetlists: 0,
      pulledSetlists: 0,
      errors: [],
    };

    try {
      await this.syncSongs(result);
      await this.syncSetlists(result);
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : String(err));
    }

    return result;
  }

  private async syncSongs(result: SyncResult): Promise<void> {
    // 1. PUSH: Músicas locais para o Supabase (Upsert)
    const localSongs = await localDb.getAllSongs();
    if (localSongs.length > 0) {
      const payload = localSongs.map((s) => ({
        id: s.id,
        title: s.title,
        bpm: s.bpm,
        time_signature_beats: s.timeSignatureBeats,
        time_signature_value: s.timeSignatureValue,
        subdivision: s.subdivision,
        count_in_beats: s.countInBeats,
        notes: s.notes,
        updated_at: s.updatedAt,
      }));

      const res = await this.fetchSupabase("songs?on_conflict=id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        result.errors.push(`Erro ao enviar músicas para Supabase: ${res.statusText}`);
      } else {
        result.pushedSongs += localSongs.length;
      }
    }

    // 2. PULL: Baixar músicas do Supabase
    const pullRes = await this.fetchSupabase("songs?select=*");
    if (pullRes.ok) {
      const remoteSongs = (await pullRes.json()) as Array<{
        id: string;
        title: string;
        bpm: number;
        time_signature_beats: number;
        time_signature_value: number;
        subdivision: number;
        count_in_beats: number;
        notes?: string;
        updated_at: string;
      }>;

      for (const remote of remoteSongs) {
        const local = await localDb.getSong(remote.id);
        const shouldUpdate =
          !local || new Date(remote.updated_at) > new Date(local.updatedAt);

        if (shouldUpdate) {
          const song: Song = {
            id: remote.id,
            title: remote.title,
            bpm: remote.bpm,
            timeSignatureBeats: remote.time_signature_beats as Song["timeSignatureBeats"],
            timeSignatureValue: remote.time_signature_value as Song["timeSignatureValue"],
            subdivision: remote.subdivision as Song["subdivision"],
            countInBeats: remote.count_in_beats,
            notes: remote.notes,
            updatedAt: remote.updated_at,
          };
          await localDb.saveSong(song);
          result.pulledSongs += 1;
        }
      }
    }
  }

  private async syncSetlists(result: SyncResult): Promise<void> {
    const localSetlists = await localDb.getAllSetlists();
    if (localSetlists.length > 0) {
      const payload = localSetlists.map((sl) => ({
        id: sl.id,
        name: sl.name,
        song_ids: sl.songIds,
        created_at: sl.createdAt,
        updated_at: sl.updatedAt,
      }));

      const res = await this.fetchSupabase("setlists?on_conflict=id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        result.errors.push(`Erro ao enviar setlists para Supabase: ${res.statusText}`);
      } else {
        result.pushedSetlists += localSetlists.length;
      }
    }
  }
}
