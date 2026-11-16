import { useState, useMemo } from "react";
import {
  ListMusic,
  Plus,
  Search,
  Trash2,
  Play,
  Edit,
  Download,
  Upload,
  Cloud,
  Loader2,
  ArrowUp,
  ArrowDown,
  Layers,
  Music,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { uid, type Song, type SongSettings } from "@/lib/drum/types";
import { exportRepertory, importRepertory } from "@/lib/sync/repertoryExport";
import { syncService } from "@/lib/sync/supabaseSync";
import { localDb } from "@/lib/db/indexedDbStorage";

interface RepertoryViewProps {
  songs: Song[];
  setSongs: (songs: Song[]) => void;
  activeSongId: string | null;
  onSelectSong: (s: Song) => void;
  onEditInStudio: (s: Song) => void;
  onAddNewSong: () => void;
}

export function RepertoryView({
  songs,
  setSongs,
  activeSongId,
  onSelectSong,
  onEditInStudio,
  onAddNewSong,
}: RepertoryViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Filtro de busca por nome ou BPM
  const filteredSongs = useMemo(() => {
    if (!searchTerm.trim()) return songs;
    const q = searchTerm.toLowerCase();
    return songs.filter(
      (s) => s.name.toLowerCase().includes(q) || String(s.bpm).includes(q)
    );
  }, [songs, searchTerm]);

  // Reordenação na lista
  const moveSong = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= songs.length) return;

    const updated = [...songs];
    const item = updated[index]!;
    updated[index] = updated[targetIndex]!;
    updated[targetIndex] = item;
    setSongs(updated);
  };

  const removeSong = (id: string) => {
    setSongs(songs.filter((s) => s.id !== id));
  };

  const handleCloudSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      // Salva músicas locais no localDb primeiro
      for (const s of songs) {
        await localDb.saveSong({
          id: s.id,
          title: s.name,
          bpm: s.bpm,
          timeSignatureBeats: 4,
          timeSignatureValue: 4,
          subdivision: 1,
          countInBeats: s.countInBars * 4,
          notes: "",
          updatedAt: new Date().toISOString(),
        });
      }

      const res = await syncService.syncAll();
      if (res.errors.length > 0) {
        setSyncMessage(`Avisos:\n${res.errors.join("\n")}`);
      } else {
        setSyncMessage(
          `Sincronizado! Enviadas: ${res.pushedSongs} | Recebidas: ${res.pulledSongs}`
        );
      }
    } catch (err) {
      setSyncMessage(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-6">
      {/* ─── 1. BARRA SUPERIOR: BUSCA & NOVA MÚSICA ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#121215] border border-[#2D2D35]">
        {/* Campo de Busca */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#8E8E93]" />
          <input
            type="text"
            placeholder="Buscar música por nome ou BPM..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#1E1E22] border border-[#2D2D35] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-[#8E8E93] focus:border-[#22C55E] outline-none transition-colors"
          />
        </div>

        {/* Botão + Nova Música */}
        <button
          onClick={onAddNewSong}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#22C55E] text-black font-mono text-xs font-bold uppercase tracking-wider hover:bg-[#22C55E]/90 transition-colors shrink-0 shadow-lg"
        >
          <Plus className="size-4" />
          <span>Nova Música</span>
        </button>
      </div>

      {/* ─── 2. LISTA ORGANIZADA DO REPERTÓRIO / SETLIST ──────────────────────────── */}
      <section className="rounded-2xl bg-[#121215] border border-[#2D2D35] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2D2D35] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListMusic className="size-4 text-[#22C55E]" />
            <h2 className="text-xs font-mono uppercase tracking-[0.2em] font-bold text-white">
              Setlist do Show & Ensaio
            </h2>
          </div>
          <span className="text-[11px] font-mono text-[#8E8E93]">
            {songs.length} {songs.length === 1 ? "música cadastrada" : "músicas cadastradas"}
          </span>
        </div>

        {/* Lista de Músicas */}
        <div className="p-4 space-y-2">
          {filteredSongs.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-[#2D2D35] rounded-xl">
              <Music className="size-10 text-[#8E8E93] mx-auto mb-3 opacity-40" />
              <p className="text-sm text-white font-medium">Nenhuma música encontrada.</p>
              <p className="text-xs text-[#8E8E93] mt-1">
                Clique no botão "+ Nova Música" acima para cadastrar a primeira música do setlist.
              </p>
            </div>
          ) : (
            filteredSongs.map((song, index) => {
              const isActive = song.id === activeSongId;

              return (
                <motion.div
                  key={song.id}
                  layout
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-xl border transition-all gap-3",
                    isActive
                      ? "bg-[#22C55E]/10 border-[#22C55E] shadow-[0_0_20px_rgba(34,197,94,0.15)]"
                      : "bg-[#1E1E22] border-[#2D2D35] hover:border-[#22C55E]/40"
                  )}
                >
                  {/* Informações da Música */}
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs font-bold text-[#8E8E93] size-7 rounded-lg bg-[#121215] border border-[#2D2D35] grid place-items-center shrink-0">
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
                          {song.name}
                        </h3>
                        {isActive && (
                          <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#22C55E] text-black shrink-0">
                            Ao Vivo
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs font-mono text-[#8E8E93] mt-0.5">
                        <span className="text-white font-semibold">{song.bpm} BPM</span>
                        <span>•</span>
                        <span>{song.timeSig}</span>
                        <span>•</span>
                        <span>{song.cues.length} {song.cues.length === 1 ? "aviso" : "avisos"}</span>
                        <span>•</span>
                        <span className="capitalize">{song.clickSound ?? "woodblock"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Ações da Música */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    {/* Botão Reordenar Cima / Baixo */}
                    <button
                      onClick={() => moveSong(index, "up")}
                      disabled={index === 0}
                      aria-label="Mover para cima"
                      className="size-9 rounded-lg bg-[#121215] border border-[#2D2D35] text-[#8E8E93] hover:text-white disabled:opacity-20 grid place-items-center transition-colors"
                    >
                      <ArrowUp className="size-3.5" />
                    </button>
                    <button
                      onClick={() => moveSong(index, "down")}
                      disabled={index === songs.length - 1}
                      aria-label="Mover para baixo"
                      className="size-9 rounded-lg bg-[#121215] border border-[#2D2D35] text-[#8E8E93] hover:text-white disabled:opacity-20 grid place-items-center transition-colors"
                    >
                      <ArrowDown className="size-3.5" />
                    </button>

                    {/* Editar no Estúdio */}
                    <button
                      onClick={() => onEditInStudio(song)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#121215] border border-[#2D2D35] text-xs font-medium text-white hover:border-white transition-colors"
                    >
                      <Edit className="size-3.5" />
                      <span className="hidden sm:inline">Editar</span>
                    </button>

                    {/* Tocar no Palco */}
                    <button
                      onClick={() => onSelectSong(song)}
                      className={cn(
                        "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold uppercase font-mono transition-colors",
                        isActive
                          ? "bg-[#22C55E] text-black"
                          : "bg-white text-black hover:bg-neutral-200"
                      )}
                    >
                      <Play className="size-3.5 fill-current" />
                      <span>{isActive ? "No Palco" : "Carregar"}</span>
                    </button>

                    {/* Excluir */}
                    <button
                      onClick={() => removeSong(song.id)}
                      aria-label="Remover música"
                      className="size-9 rounded-lg bg-[#121215] border border-[#2D2D35] text-[#8E8E93] hover:text-red-400 hover:border-red-500/40 grid place-items-center transition-colors ml-1"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </section>

      {/* ─── 3. AÇÕES DE BACKUP & NUVEM (JSON & SUPABASE) ─────────────────────────── */}
      <section className="p-4 rounded-2xl bg-[#121215] border border-[#2D2D35] space-y-3">
        <span className="block text-xs font-mono uppercase tracking-[0.2em] text-[#8E8E93]">
          Backup & Sincronização em Nuvem
        </span>

        {syncMessage && (
          <div className="p-3 rounded-xl bg-[#1E1E22] border border-[#22C55E]/40 text-xs text-white font-mono">
            {syncMessage}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Exportar JSON */}
          <button
            onClick={() => exportRepertory(songs)}
            disabled={songs.length === 0}
            className="flex items-center justify-center gap-2 h-11 rounded-xl bg-[#1E1E22] border border-[#2D2D35] text-xs font-bold text-white hover:border-[#22C55E]/50 disabled:opacity-40 transition-colors"
          >
            <Download className="size-3.5" />
            <span>Exportar Backup (.JSON)</span>
          </button>

          {/* Importar JSON */}
          <label className="flex items-center justify-center gap-2 h-11 rounded-xl bg-[#1E1E22] border border-[#2D2D35] text-xs font-bold text-white hover:border-[#22C55E]/50 cursor-pointer transition-colors">
            <Upload className="size-3.5" />
            <span>Importar Backup (.JSON)</span>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const imported = await importRepertory(file);
                  setSongs(imported.songs);
                  alert(`${imported.songs.length} músicas importadas com sucesso!`);
                } catch (err) {
                  alert(err instanceof Error ? err.message : "Erro ao importar repertório.");
                } finally {
                  e.target.value = "";
                }
              }}
            />
          </label>

          {/* Sincronizar Supabase */}
          <button
            onClick={handleCloudSync}
            disabled={syncing}
            className="flex items-center justify-center gap-2 h-11 rounded-xl bg-[#22C55E] text-black text-xs font-bold uppercase font-mono hover:bg-[#22C55E]/90 disabled:opacity-50 transition-colors shadow-sm"
          >
            {syncing ? <Loader2 className="size-3.5 animate-spin" /> : <Cloud className="size-3.5" />}
            <span>{syncing ? "Sincronizando..." : "Sincronizar Nuvem"}</span>
          </button>
        </div>
      </section>
    </div>
  );
}
