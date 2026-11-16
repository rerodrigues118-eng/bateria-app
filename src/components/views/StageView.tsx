import { motion } from "framer-motion";
import { useState, useRef, useMemo } from "react";
import {
  Play,
  Square,
  SkipBack,
  SkipForward,
  Sun,
  SunDim,
  Zap,
  Volume2,
  AlertCircle,
  Radio,
  Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BEATS, clampBpm, type Song, type SongSettings } from "@/lib/drum/types";
import type { Tick } from "@/lib/drum/useMetronome";

interface StageViewProps {
  settings: SongSettings;
  updateSettings: (p: Partial<SongSettings>) => void;
  tick: Tick | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  songs: Song[];
  activeSongId: string | null;
  onSelectSong: (s: Song) => void;
  flashEnabled: boolean;
  onToggleFlash: (val: boolean) => void;
  wakeLockActive: boolean;
  onToggleWakeLock: () => void;
}

export function StageView({
  settings,
  updateSettings,
  tick,
  isPlaying,
  onTogglePlay,
  songs,
  activeSongId,
  onSelectSong,
  flashEnabled,
  onToggleFlash,
  wakeLockActive,
  onToggleWakeLock,
}: StageViewProps) {
  // Tap Tempo
  const taps = useRef<number[]>([]);
  const handleTap = () => {
    const now = performance.now();
    taps.current = [...taps.current.filter((t) => now - t < 2500), now].slice(-6);
    if (taps.current.length >= 2) {
      const diffs = taps.current.slice(1).map((t, i) => t - (taps.current[i] ?? t));
      const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      updateSettings({ bpm: clampBpm(Math.round(60000 / avg)) });
    }
  };

  const stepBpm = (delta: number) => {
    updateSettings({ bpm: clampBpm(settings.bpm + delta) });
  };

  // Músicas do setlist
  const currentIndex = songs.findIndex((s) => s.id === activeSongId);
  const activeSong = songs[currentIndex];

  const handlePrevSong = () => {
    if (songs.length === 0) return;
    const prevIdx = currentIndex > 0 ? currentIndex - 1 : songs.length - 1;
    const song = songs[prevIdx];
    if (song) onSelectSong(song);
  };

  const handleNextSong = () => {
    if (songs.length === 0) return;
    const nextIdx = currentIndex < songs.length - 1 ? currentIndex + 1 : 0;
    const song = songs[nextIdx];
    if (song) onSelectSong(song);
  };

  // Cálculo do aviso atual e próximo aviso
  const currentBar = tick?.bar ?? 1;
  const numBeats = BEATS[settings.timeSig] ?? 4;

  const cueInfo = useMemo(() => {
    if (!settings.cues || settings.cues.length === 0) {
      return { active: null, next: null, barsUntilNext: null };
    }

    // Aviso acontecendo exatamente no compasso atual
    const active = settings.cues.find((c) => c.bar === currentBar);

    // Próximo aviso futuro
    const upcoming = settings.cues
      .filter((c) => c.bar > currentBar)
      .sort((a, b) => a.bar - b.bar)[0];

    return {
      active: active ?? null,
      next: upcoming ?? null,
      barsUntilNext: upcoming ? upcoming.bar - currentBar : null,
    };
  }, [settings.cues, currentBar]);

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto justify-between gap-5 select-none">
      {/* ─── 1. TOP BAR COMPACTA DO SHOW ────────────────────────────────────────── */}
      <header className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-[#121215] border border-[#2D2D35]">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={handlePrevSong}
            disabled={songs.length <= 1}
            aria-label="Música anterior"
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#1E1E22] border border-[#2D2D35] text-white hover:border-[#22C55E]/50 disabled:opacity-30 transition-colors"
          >
            <SkipBack className="size-4" />
          </button>

          <div className="min-w-0 px-2">
            <span className="block text-[10px] font-mono uppercase tracking-[0.2em] text-[#8E8E93]">
              {songs.length > 0
                ? `Música ${currentIndex >= 0 ? currentIndex + 1 : 1} de ${songs.length}`
                : "Modo Livre"}
            </span>
            <h1 className="text-sm md:text-base font-bold text-white truncate max-w-[180px] sm:max-w-xs md:max-w-md">
              {activeSong?.name ?? "Música Livre (Sem Setlist)"}
            </h1>
          </div>

          <button
            onClick={handleNextSong}
            disabled={songs.length <= 1}
            aria-label="Próxima música"
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#1E1E22] border border-[#2D2D35] text-white hover:border-[#22C55E]/50 disabled:opacity-30 transition-colors"
          >
            <SkipForward className="size-4" />
          </button>
        </div>

        {/* Toggles Rápidos de Palco (Flash e Wake Lock) */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onToggleFlash(!flashEnabled)}
            aria-label="Flash de tela"
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors",
              flashEnabled
                ? "bg-[#22C55E]/10 border-[#22C55E] text-[#22C55E]"
                : "bg-[#1E1E22] border-[#2D2D35] text-[#8E8E93] hover:text-white"
            )}
          >
            <Zap className="size-3.5" />
            <span className="hidden sm:inline">Flash</span>
          </button>

          <button
            onClick={onToggleWakeLock}
            aria-label="Manter tela acesa"
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors",
              wakeLockActive
                ? "bg-[#22C55E]/10 border-[#22C55E] text-[#22C55E]"
                : "bg-[#1E1E22] border-[#2D2D35] text-[#8E8E93] hover:text-white"
            )}
          >
            {wakeLockActive ? <Sun className="size-3.5" /> : <SunDim className="size-3.5" />}
            <span className="hidden sm:inline">Tela Acesa</span>
          </button>
        </div>
      </header>

      {/* ─── 2. DISPLAY GIGANTE DO METRÔNOMO & LEDs DE TEMPO ──────────────────────── */}
      <section className="flex flex-col items-center justify-center p-6 md:p-8 rounded-3xl bg-[#121215] border border-[#2D2D35] relative overflow-hidden shadow-2xl">
        {/* Subtítulo de Compasso */}
        <div className="flex items-center gap-3 text-xs md:text-sm font-mono uppercase tracking-[0.25em] text-[#8E8E93]">
          <span className="flex items-center gap-1.5">
            <Radio className={cn("size-3.5", isPlaying ? "text-[#22C55E] animate-pulse" : "text-[#8E8E93]")} />
            {tick ? (tick.countIn ? `Contagem (c. ${-tick.bar})` : `Compasso ${tick.bar}`) : "Pronto para tocar"}
          </span>
          <span>•</span>
          <span>{settings.timeSig}</span>
        </div>

        {/* BPM Gigante */}
        <div className="my-2 md:my-4 font-mono text-7xl sm:text-8xl md:text-9xl font-black tracking-tight text-white tabular-nums drop-shadow-md">
          {settings.bpm}
        </div>
        <div className="font-mono text-xs uppercase tracking-[0.35em] text-[#8E8E93]">
          BATIDAS POR MINUTO
        </div>

        {/* 4 LEDs Visuais de Tempo com Downbeat Destacado */}
        <div className="mt-6 flex w-full max-w-md justify-center gap-2.5 sm:gap-4 px-2">
          {Array.from({ length: numBeats }).map((_, i) => {
            const isCurrent = isPlaying && tick?.beat === i;
            const isDownbeat = i === 0;

            return (
              <motion.div
                key={i}
                animate={{
                  scale: isCurrent ? (isDownbeat ? 1.18 : 1.1) : 1,
                }}
                transition={{ duration: 0.06 }}
                className={cn(
                  "h-12 sm:h-14 flex-1 rounded-2xl border transition-all duration-75 flex items-center justify-center font-mono font-bold text-sm",
                  // Estado ativo no tempo atual
                  isCurrent && isDownbeat
                    ? "border-[#22C55E] bg-[#22C55E] text-black shadow-[0_0_30px_rgba(34,197,94,0.6)]"
                    : isCurrent && !isDownbeat
                    ? "border-white bg-white text-black shadow-[0_0_18px_rgba(255,255,255,0.4)]"
                    // Estado inativo
                    : isDownbeat
                    ? "border-[#2D2D35] bg-[#1E1E22] text-[#8E8E93]"
                    : "border-[#2D2D35] bg-[#0A0A0B] text-[#55555C]"
                )}
              >
                {i + 1}
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ─── 3. DESTAQUE: AVISO ATUAL / PRÓXIMO COMANDO DE VOZ ─────────────────────── */}
      <section
        className={cn(
          "p-4 md:p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-center",
          cueInfo.active
            ? "bg-[#22C55E]/15 border-[#22C55E] text-white shadow-[0_0_35px_rgba(34,197,94,0.3)] animate-pulse"
            : cueInfo.barsUntilNext === 1
            ? "bg-amber-500/10 border-amber-500/60 text-white"
            : "bg-[#121215] border-[#2D2D35] text-[#8E8E93]"
        )}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <Flame
              className={cn(
                "size-4",
                cueInfo.active ? "text-[#22C55E]" : cueInfo.barsUntilNext === 1 ? "text-amber-400" : "text-[#8E8E93]"
              )}
            />
            <span className="text-[11px] font-mono uppercase tracking-[0.2em] font-semibold text-white">
              {cueInfo.active
                ? "COMANDO ATIVO AGORA"
                : cueInfo.barsUntilNext === 1
                ? "PREPARAR — PRÓXIMO COMPASSO"
                : "STATUS DE COMANDOS DE VOZ"}
            </span>
          </div>

          {cueInfo.barsUntilNext !== null && (
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-[#1E1E22] border border-[#2D2D35] text-white">
              em {cueInfo.barsUntilNext} {cueInfo.barsUntilNext === 1 ? "compasso" : "compassos"}
            </span>
          )}
        </div>

        {/* Texto do Comando */}
        <div className="text-base sm:text-lg md:text-xl font-bold tracking-wide text-white">
          {cueInfo.active ? (
            <span className="text-[#22C55E] flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded bg-[#22C55E] text-black font-mono">c.{cueInfo.active.bar}</span>
              {cueInfo.active.text}
            </span>
          ) : cueInfo.next ? (
            <span className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded bg-[#2D2D35] text-white font-mono">c.{cueInfo.next.bar}</span>
              <span>{cueInfo.next.text}</span>
            </span>
          ) : (
            <span className="text-sm text-[#8E8E93] font-normal">
              Nenhum comando na timeline para esta seção da música.
            </span>
          )}
        </div>
      </section>

      {/* ─── 4. CONTROLES RÁPIDOS DE BPM & TAP TEMPO ───────────────────────────────── */}
      <section className="grid grid-cols-5 gap-2">
        {[-5, -1, 1, 5].map((delta) => (
          <motion.button
            key={delta}
            whileTap={{ scale: 0.94 }}
            onClick={() => stepBpm(delta)}
            className="h-13 rounded-2xl bg-[#121215] border border-[#2D2D35] font-mono text-lg font-bold text-white hover:bg-[#1E1E22] hover:border-[#22C55E]/40 transition-colors"
          >
            {delta > 0 ? `+${delta}` : delta}
          </motion.button>
        ))}

        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={handleTap}
          className="h-13 rounded-2xl bg-[#1E1E22] border border-[#2D2D35] font-mono text-xs font-extrabold uppercase tracking-[0.15em] text-[#22C55E] hover:border-[#22C55E] transition-colors shadow-sm"
        >
          TAP
        </motion.button>
      </section>

      {/* ─── 5. BOTÃO PLAY / STOP GIGANTE ─────────────────────────────────────────── */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={onTogglePlay}
        aria-label={isPlaying ? "Parar Metrônomo" : "Iniciar Metrônomo"}
        className={cn(
          "w-full h-18 sm:h-20 rounded-2xl font-mono text-lg sm:text-xl font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all shadow-xl",
          isPlaying
            ? "bg-[#22C55E] text-black shadow-[0_0_40px_rgba(34,197,94,0.45)] hover:bg-[#22C55E]/90"
            : "bg-white text-black hover:bg-neutral-200"
        )}
      >
        {isPlaying ? (
          <>
            <Square className="size-6 fill-current" />
            <span>PARAR (STOP)</span>
          </>
        ) : (
          <>
            <Play className="size-6 fill-current ml-1" />
            <span>INICIAR (PLAY)</span>
          </>
        )}
      </motion.button>
    </div>
  );
}
