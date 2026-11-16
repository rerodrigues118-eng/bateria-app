import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, Volume2, Mic, Play, ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { SongSettings, VoiceCue } from "@/lib/drum/types";
import { uid } from "@/lib/drum/types";

interface TimelineEditorProps {
  settings: SongSettings;
  updateSettings: (p: Partial<SongSettings>) => void;
  currentMeasure: number; // Compasso atual tocando no metrônomo
  currentBeat: number;    // Tempo atual dentro do compasso
  isPlaying: boolean;
  totalMeasures?: number; // Total de compassos a exibir (padrão: 48)
  onSeekMeasure?: (measure: number) => void;
}

export function TimelineEditor({
  settings,
  updateSettings,
  currentMeasure,
  currentBeat,
  isPlaying,
  totalMeasures = 48,
  onSeekMeasure,
}: TimelineEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedMeasure, setSelectedMeasure] = useState<number | null>(null);
  const [newCueText, setNewCueText] = useState("");
  const [quickPresetType, setQuickPresetType] = useState<string>("Virada em 1, 2, 3, 4");

  // Auto-scroll para acompanhar o cursor da música (Playhead) quando o metrônomo estiver tocando
  useEffect(() => {
    if (isPlaying && containerRef.current && currentMeasure > 0) {
      const measureWidth = 88; // 88px por compasso
      const scrollTarget = (currentMeasure - 2) * measureWidth;
      containerRef.current.scrollTo({
        left: Math.max(0, scrollTarget),
        behavior: "smooth",
      });
    }
  }, [currentMeasure, isPlaying]);

  const handleAddCueToMeasure = (measure: number, text: string) => {
    if (!text.trim()) return;
    const existingIndex = settings.cues.findIndex((c) => c.bar === measure);
    let updatedCues = [...settings.cues];

    if (existingIndex >= 0) {
      updatedCues[existingIndex] = {
        ...updatedCues[existingIndex]!,
        text: text.trim(),
      };
    } else {
      updatedCues.push({
        id: uid(),
        bar: measure,
        text: text.trim(),
      });
    }

    updatedCues.sort((a, b) => a.bar - b.bar);
    updateSettings({ cues: updatedCues });
    setSelectedMeasure(null);
    setNewCueText("");
  };

  const handleRemoveCue = (cueId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    updateSettings({
      cues: settings.cues.filter((c) => c.id !== cueId),
    });
  };

  const getCueForMeasure = (measure: number) => {
    return settings.cues.find((c) => c.bar === measure);
  };

  const scrollLeft = () => {
    containerRef.current?.scrollBy({ left: -260, behavior: "smooth" });
  };

  const scrollRight = () => {
    containerRef.current?.scrollBy({ left: 260, behavior: "smooth" });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      {/* Cabeçalho da Timeline */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-live animate-pulse" />
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground">
            Linha do Tempo Visual (Cue Sheet)
          </h2>
          <span className="font-mono text-xs text-muted-foreground ml-2">
            Compasso atual: <strong className="text-live">{isPlaying ? currentMeasure : "--"}</strong>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={scrollLeft}
            aria-label="Rolar esquerda"
            className="grid size-8 place-items-center rounded-lg border border-border bg-secondary hover:bg-accent text-muted-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={scrollRight}
            aria-label="Rolar direita"
            className="grid size-8 place-items-center rounded-lg border border-border bg-secondary hover:bg-accent text-muted-foreground"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* Grade Horizontal da Timeline */}
      <div
        ref={containerRef}
        className="relative overflow-x-auto rounded-xl border border-border/80 bg-background/60 p-2 scrollbar-thin select-none"
        style={{ minHeight: "140px" }}
      >
        <div className="flex gap-1.5" style={{ minWidth: `${totalMeasures * 88}px` }}>
          {Array.from({ length: totalMeasures }).map((_, idx) => {
            const measureNum = idx + 1;
            const isCurrent = isPlaying && currentMeasure === measureNum;
            const cue = getCueForMeasure(measureNum);
            const isLeadToNextCue = settings.cues.some((c) => c.bar - 1 === measureNum);

            return (
              <div
                key={measureNum}
                onClick={() => setSelectedMeasure(measureNum)}
                className={cn(
                  "relative flex flex-col justify-between rounded-lg border p-2 cursor-pointer transition-all w-[84px] h-[120px] shrink-0",
                  isCurrent
                    ? "border-live bg-live/15 shadow-[0_0_20px_rgba(34,197,94,0.25)] ring-2 ring-live/60"
                    : isLeadToNextCue
                    ? "border-amber-500/50 bg-amber-500/10"
                    : "border-border/60 bg-secondary/40 hover:bg-secondary hover:border-border",
                )}
              >
                {/* Número do Compasso e Indicador de Playhead */}
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className={cn(isCurrent ? "font-bold text-live" : "text-muted-foreground")}>
                    c.{measureNum}
                  </span>
                  {isCurrent && (
                    <motion.span
                      layoutId="playhead-indicator"
                      className="size-2 rounded-full bg-live"
                    />
                  )}
                </div>

                {/* Bloco de Comando de Voz (se houver) */}
                <div className="flex-1 my-1 flex items-center justify-center">
                  {cue ? (
                    <div
                      className={cn(
                        "w-full rounded-md p-1.5 text-center text-[10px] font-medium leading-tight relative group",
                        cue.text.toLowerCase().includes("virada")
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          : cue.text.toLowerCase().includes("prato")
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                          : cue.text.toLowerCase().includes("solo")
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "bg-purple-500/20 text-purple-300 border border-purple-500/40",
                      )}
                    >
                      <div className="truncate font-semibold">{cue.text}</div>
                      <button
                        onClick={(e) => handleRemoveCue(cue.id, e)}
                        aria-label="Excluir comando"
                        className="absolute -top-1 -right-1 size-4 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity shadow"
                      >
                        <Trash2 className="size-2.5" />
                      </button>
                    </div>
                  ) : isLeadToNextCue ? (
                    <span className="text-[9px] font-mono text-amber-400/80 uppercase tracking-tighter text-center">
                      ⚡ Preparar
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/40 group-hover:text-muted-foreground">
                      +
                    </span>
                  )}
                </div>

                {/* Beat Markers (Pontos dos tempos dentro do compasso: 1, 2, 3, 4) */}
                <div className="flex justify-between items-center px-1">
                  {Array.from({ length: settings.timeSig === "3/4" ? 3 : settings.timeSig === "6/8" ? 6 : 4 }).map((_, beatIdx) => (
                    <span
                      key={beatIdx}
                      className={cn(
                        "size-1.5 rounded-full transition-colors",
                        isCurrent && currentBeat === beatIdx
                          ? "bg-live scale-125"
                          : beatIdx === 0
                          ? "bg-muted-foreground/60"
                          : "bg-muted-foreground/20",
                      )}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Editor Rápido ao Clicar em um Compasso */}
      {selectedMeasure !== null && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-live/40 bg-secondary/80 p-3 space-y-3"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground">
              Configurar Compasso {selectedMeasure}
            </span>
            <button
              onClick={() => setSelectedMeasure(null)}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              Cancelar
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              "Virada em 1, 2, 3, 4",
              "Pratos",
              "Intro",
              "Solo",
              "Caixa e bumbo",
              "Parada",
            ].map((preset) => (
              <button
                key={preset}
                onClick={() => handleAddCueToMeasure(selectedMeasure, preset)}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-background border border-border hover:border-live hover:text-live transition-colors"
              >
                + {preset}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              placeholder="Ou digite comando customizado..."
              value={newCueText}
              onChange={(e) => setNewCueText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCueToMeasure(selectedMeasure, newCueText)}
              className="flex-1 min-h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-live"
            />
            <button
              onClick={() => handleAddCueToMeasure(selectedMeasure, newCueText)}
              className="min-h-10 px-4 rounded-lg bg-live text-live-foreground text-xs font-bold uppercase tracking-wider"
            >
              Adicionar
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
