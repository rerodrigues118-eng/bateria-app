import { supabase } from "../supabaseClient";
import { localDb } from "../db/indexedDbStorage";
import type { Setlist, Song } from "../types/metronome";

export interface SyncResult {
  pushedSongs: number;
  pulledSongs: number;
  pushedSetlists: number;
  pulledSetlists: number;
  errors: string[];
}

/**
 * Sincronização Bidirecional Offline-First entre IndexedDB e Supabase
 * Usa o @supabase/supabase-js client oficial para autenticação via RLS.
 */
export class SupabaseSyncService {
  /**
   * Verifica se o Supabase está configurado (variáveis de ambiente presentes)
   */
  private isAvailable(): boolean {
    return supabase !== null;
  }

  /**
   * Executa a sincronização completa (Push + Pull)
   */
  public async syncAll(): Promise<SyncResult> {
    const result: SyncResult = {
      pushedSongs: 0,
      pulledSongs: 0,
      pushedSetlists: 0,
      pulledSetlists: 0,
      errors: [],
    };

    if (!this.isAvailable()) {
      result.errors.push("Supabase não configurado. Adicione VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env");
      return result;
    }

    try {
      await this.syncSongs(result);
      await this.syncSetlists(result);
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : String(err));
    }

    return result;
  }

  // ─── MÚSICAS ───────────────────────────────────────────────────────────────

  private async syncSongs(result: SyncResult): Promise<void> {
    const localSongs = await localDb.getAllSongs();

    // PUSH: Enviar músicas locais para o Supabase (upsert)
    if (localSongs.length > 0) {
      const payload = localSongs.map((s) => ({
        id: s.id,
        title: s.title,
        bpm: s.bpm,
        time_signature_beats: s.timeSignatureBeats,
        time_signature_value: s.timeSignatureValue,
        subdivision: s.subdivision,
        count_in_beats: s.countInBeats,
        notes: s.notes ?? null,
        updated_at: s.updatedAt,
      }));

      const { error } = await supabase!
        .from("songs")
        .upsert(payload, { onConflict: "id" });

      if (error) {
        result.errors.push(`Erro ao enviar músicas: ${error.message}`);
      } else {
        result.pushedSongs += localSongs.length;
      }
    }

    // PULL: Baixar músicas do Supabase que são mais recentes
    const { data: remoteSongs, error: pullError } = await supabase!
      .from("songs")
      .select("*");

    if (pullError) {
      result.errors.push(`Erro ao buscar músicas: ${pullError.message}`);
      return;
    }

    for (const remote of remoteSongs ?? []) {
      const local = await localDb.getSong(remote.id);
      const shouldUpdate = !local || new Date(remote.updated_at) > new Date(local.updatedAt);

      if (shouldUpdate) {
        const song: Song = {
          id: remote.id,
          title: remote.title,
          bpm: remote.bpm,
          timeSignatureBeats: remote.time_signature_beats as Song["timeSignatureBeats"],
          timeSignatureValue: remote.time_signature_value as Song["timeSignatureValue"],
          subdivision: remote.subdivision as Song["subdivision"],
          countInBeats: remote.count_in_beats,
          notes: remote.notes ?? undefined,
          updatedAt: remote.updated_at,
        };
        await localDb.saveSong(song);
        result.pulledSongs += 1;
      }
    }
  }

  // ─── SETLISTS ──────────────────────────────────────────────────────────────

  private async syncSetlists(result: SyncResult): Promise<void> {
    const localSetlists = await localDb.getAllSetlists();

    // PUSH
    if (localSetlists.length > 0) {
      const payload = localSetlists.map((sl) => ({
        id: sl.id,
        name: sl.name,
        song_ids: sl.songIds,
        created_at: sl.createdAt,
        updated_at: sl.updatedAt,
      }));

      const { error } = await supabase!
        .from("setlists")
        .upsert(payload, { onConflict: "id" });

      if (error) {
        result.errors.push(`Erro ao enviar setlists: ${error.message}`);
      } else {
        result.pushedSetlists += localSetlists.length;
      }
    }

    // PULL
    const { data: remoteSetlists, error: pullError } = await supabase!
      .from("setlists")
      .select("*");

    if (pullError) {
      result.errors.push(`Erro ao buscar setlists: ${pullError.message}`);
      return;
    }

    for (const remote of remoteSetlists ?? []) {
      const local = await localDb.getAllSetlists().then((s) => s.find((x) => x.id === remote.id));
      const shouldUpdate = !local || new Date(remote.updated_at) > new Date(local.updatedAt);

      if (shouldUpdate) {
        const setlist: Setlist = {
          id: remote.id,
          name: remote.name,
          songIds: remote.song_ids,
          createdAt: remote.created_at,
          updatedAt: remote.updated_at,
        };
        await localDb.saveSetlist(setlist);
        result.pulledSetlists += 1;
      }
    }
  }
}

// Singleton exportado para uso direto no app
export const syncService = new SupabaseSyncService();
