import { useEffect, useState, useRef } from "react";
import { Music, Upload, Trash2, Volume2, CheckCircle2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { localDb } from "@/lib/db/indexedDbStorage";
import { MetronomeEngine } from "@/lib/MetronomeEngine";

interface BackingTrackPanelProps {
  songId: string;
  engine?: MetronomeEngine;
  onTrackLoaded?: (trackKey: string) => void;
  onVolumeChange?: (volume: number) => void;
}

export function BackingTrackPanel({
  songId,
  engine,
  onTrackLoaded,
  onVolumeChange,
}: BackingTrackPanelProps) {
  const [trackName, setTrackName] = useState<string | null>(null);
  const [trackDuration, setTrackDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(85);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fallbackEngineRef = useRef<MetronomeEngine | null>(null);
  const activeEngine = engine ?? (fallbackEngineRef.current ??= new MetronomeEngine());

  // Carrega faixa pré-existente salva no IndexedDB
  useEffect(() => {
    let isMounted = true;

    async function loadSavedTrack() {
      try {
        const saved = await localDb.getAudioTrack(songId);
        if (saved && isMounted) {
          setLoading(true);
          const buffer = await activeEngine.loadAudioFile(songId, saved.blob);
          setTrackName(saved.fileName);
          setTrackDuration(buffer.duration);
          onTrackLoaded?.(songId);
          setLoading(false);
        }
      } catch (err) {
        console.error("Erro ao carregar backing track do IndexedDB:", err);
        if (isMounted) setLoading(false);
      }
    }

    loadSavedTrack();

    return () => {
      isMounted = false;
    };
  }, [songId, activeEngine, onTrackLoaded]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      // 1. Salva de forma permanente no IndexedDB do celular
      await localDb.saveAudioTrack(songId, file);

      // 2. Decodifica no AudioContext da engine para RAM
      const buffer = await activeEngine.loadAudioFile(songId, file);

      setTrackName(file.name);
      setTrackDuration(buffer.duration);
      onTrackLoaded?.(songId);
    } catch (err) {
      console.error("Erro ao importar áudio/vídeo:", err);
      alert("Não foi possível decodificar o arquivo selecionado.");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveTrack = async () => {
    try {
      await localDb.deleteAudioTrack(songId);
      setTrackName(null);
      setTrackDuration(0);
    } catch (err) {
      console.error("Erro ao excluir backing track:", err);
    }
  };

  const handleVolumeChange = (newVal: number) => {
    setVolume(newVal);
    activeEngine.setMusicVolume(newVal / 100);
    onVolumeChange?.(newVal / 100);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
          <Music className="size-4 text-live" />
          Música de Fundo (Backing Track)
        </h2>
        {trackName && (
          <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400">
            <CheckCircle2 className="size-3.5" /> Pronta
          </span>
        )}
      </div>

      {!trackName ? (
        <div>
          <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-xl cursor-pointer bg-secondary/50 hover:bg-secondary transition-colors">
            <Upload className="size-6 text-muted-foreground mb-2" />
            <span className="text-sm font-medium text-foreground">
              {loading ? "Decodificando áudio..." : "Importar MP3 ou MP4 do celular"}
            </span>
            <span className="text-xs text-muted-foreground mt-1 text-center">
              A faixa de áudio será sincronizada perfeitamente com o clique e as vozes
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,video/mp4"
              onChange={handleFileUpload}
              disabled={loading}
              className="hidden"
            />
          </label>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-border bg-secondary p-3">
            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{trackName}</span>
              <span className="block font-mono text-xs text-muted-foreground">
                Duração: {formatTime(trackDuration)} · Salvo offline
              </span>
            </div>
            <button
              onClick={handleRemoveTrack}
              aria-label="Excluir música"
              className="grid size-10 place-items-center text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="size-4" />
            </button>
          </div>

          <div>
            <div className="mb-2 flex justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Volume2 className="size-3.5" /> Volume da Música
              </span>
              <span className="font-mono">{volume}%</span>
            </div>
            <Slider
              value={[volume]}
              min={0}
              max={100}
              step={1}
              onValueChange={([v]) => handleVolumeChange(v ?? 80)}
            />
          </div>
        </div>
      )}
    </section>
  );
}
