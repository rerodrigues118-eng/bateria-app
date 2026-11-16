import { useState } from "react";
import {
  Music,
  Clock,
  Layers,
  Save,
  Plus,
  Trash2,
  Mic,
  Radio,
  Sliders,
  Volume2,
} from "lucide-react";
import { motion } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  BEATS,
  CLICK_SOUNDS,
  SUBDIVISIONS,
  type ClickSoundType,
  type Song,
  type SongSettings,
  type TimeSig,
  type Subdivision,
  uid,
} from "@/lib/drum/types";
import { BackingTrackPanel } from "@/components/drum/BackingTrackPanel";
import { TimelineEditor } from "@/components/drum/TimelineEditor";

interface StudioViewProps {
  settings: SongSettings;
  updateSettings: (p: Partial<SongSettings>) => void;
  currentSongId: string;
  currentSongName?: string | undefined;
  onUpdateSongName?: (name: string) => void;
  onSaveToRepertory?: (name: string) => void;
  currentMeasure: number;
  currentBeat: number;
  isPlaying: boolean;
  onVolumeChange?: (vol: number) => void;
}

export function StudioView({
  settings,
  updateSettings,
  currentSongId,
  currentSongName = "Música Sem Nome",
  onUpdateSongName,
  onSaveToRepertory,
  currentMeasure,
  currentBeat,
  isPlaying,
  onVolumeChange,
}: StudioViewProps) {
  const [songTitle, setSongTitle] = useState(currentSongName);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = () => {
    if (onSaveToRepertory && songTitle.trim()) {
      onSaveToRepertory(songTitle.trim());
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-6">
      {/* ─── 1. CABEÇALHO DO ESTÚDIO: NOME DA MÚSICA & SALVAMENTO ───────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#121215] border border-[#2D2D35]">
        <div className="flex-1 min-w-0">
          <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-[#8E8E93] mb-1">
            Nome da Música no Estúdio
          </label>
          <input
            type="text"
            value={songTitle}
            onChange={(e) => {
              setSongTitle(e.target.value);
              onUpdateSongName?.(e.target.value);
            }}
            placeholder="Digite o título da música..."
            className="w-full bg-[#1E1E22] border border-[#2D2D35] rounded-xl px-3 py-2 text-white font-bold text-base focus:border-[#22C55E] outline-none transition-colors"
          />
        </div>

        {onSaveToRepertory && (
          <button
            onClick={handleSave}
            className={cn(
              "flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-mono text-xs font-bold uppercase tracking-wider transition-colors shrink-0",
              saveSuccess
                ? "bg-[#22C55E] text-black"
                : "bg-white text-black hover:bg-neutral-200"
            )}
          >
            <Save className="size-4" />
            <span>{saveSuccess ? "Salvo com Sucesso!" : "Salvar no Repertório"}</span>
          </button>
        )}
      </div>

      {/* ─── 2. ÁREA SUPERIOR: BACKING TRACK (MP3 / WAV / MP4) ────────────────────── */}
      <section className="rounded-2xl bg-[#121215] border border-[#2D2D35] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#2D2D35] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="size-4 text-[#22C55E]" />
            <h2 className="text-xs font-mono uppercase tracking-[0.2em] font-bold text-white">
              Backing Track (Música de Fundo)
            </h2>
          </div>
          <span className="text-[11px] text-[#8E8E93]">
            Sincronização por hardware via Web Audio API
          </span>
        </div>
        <div className="p-4">
          <BackingTrackPanel
            songId={currentSongId}
            onVolumeChange={(vol) => onVolumeChange?.(vol)}
          />
        </div>
      </section>

      {/* ─── 3. ÁREA CENTRAL: EDITOR DE LINHA DO TEMPO (CUE SHEET) ───────────────── */}
      <section className="rounded-2xl bg-[#121215] border border-[#2D2D35] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#2D2D35] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-[#22C55E]" />
            <h2 className="text-xs font-mono uppercase tracking-[0.2em] font-bold text-white">
              Linha do Tempo Visual de Voz (Cue Sheet)
            </h2>
          </div>
          <span className="text-[11px] font-mono text-[#8E8E93]">
            {settings.cues.length} {settings.cues.length === 1 ? "comando agendado" : "comandos agendados"}
          </span>
        </div>
        <div className="p-4">
          <TimelineEditor
            settings={settings}
            updateSettings={updateSettings}
            currentMeasure={currentMeasure}
            currentBeat={currentBeat}
            isPlaying={isPlaying}
            totalMeasures={64}
          />
        </div>
      </section>

      {/* ─── 4. ÁREA INFERIOR: CONFIGURAÇÕES DA MÚSICA & CLIQUE ───────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Painel Esquerdo: Andamento & Compassos */}
        <div className="p-5 rounded-2xl bg-[#121215] border border-[#2D2D35] flex flex-col justify-between space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-mono uppercase tracking-[0.2em] text-[#8E8E93]">
                Andamento da Música
              </span>
              <span className="font-mono text-2xl font-black text-white">
                {settings.bpm} <span className="text-xs text-[#8E8E93]">BPM</span>
              </span>
            </div>
            <Slider
              value={[settings.bpm]}
              min={30}
              max={300}
              step={1}
              onValueChange={([v]) => v && updateSettings({ bpm: v })}
              className="py-2"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-[0.2em] text-[#8E8E93] mb-2">
              Fórmula de Compasso
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["4/4", "3/4", "6/8"] as TimeSig[]).map((sig) => (
                <button
                  key={sig}
                  onClick={() => updateSettings({ timeSig: sig })}
                  className={cn(
                    "h-11 rounded-xl font-mono text-sm font-bold border transition-colors",
                    settings.timeSig === sig
                      ? "bg-[#22C55E] text-black border-[#22C55E]"
                      : "bg-[#1E1E22] text-white border-[#2D2D35] hover:border-[#22C55E]/50"
                  )}
                >
                  {sig}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-[0.2em] text-[#8E8E93] mb-2">
              Subdivisão do Metrônomo
            </label>
            <div className="grid grid-cols-4 gap-2">
              {SUBDIVISIONS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => updateSettings({ subdivision: s.value })}
                  className={cn(
                    "h-12 rounded-xl flex flex-col items-center justify-center border transition-colors",
                    settings.subdivision === s.value
                      ? "bg-white text-black border-white"
                      : "bg-[#1E1E22] text-[#8E8E93] border-[#2D2D35] hover:text-white"
                  )}
                >
                  <span className="text-sm font-bold">{s.symbol}</span>
                  <span className="text-[9px] uppercase tracking-wider">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Painel Direito: Timbre de Clique & Contagem Inicial */}
        <div className="p-5 rounded-2xl bg-[#121215] border border-[#2D2D35] space-y-5">
          <div>
            <label className="block text-xs font-mono uppercase tracking-[0.2em] text-[#8E8E93] mb-2">
              Timbre do Clique
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CLICK_SOUNDS.map((cs) => {
                const isSelected = (settings.clickSound ?? "woodblock") === cs.value;
                return (
                  <button
                    key={cs.value}
                    onClick={() => updateSettings({ clickSound: cs.value })}
                    className={cn(
                      "h-12 rounded-xl text-xs font-bold border transition-colors text-left px-3 flex items-center justify-between",
                      isSelected
                        ? "bg-[#22C55E]/15 border-[#22C55E] text-white"
                        : "bg-[#1E1E22] border-[#2D2D35] text-[#8E8E93] hover:text-white"
                    )}
                  >
                    <span>{cs.label}</span>
                    {isSelected && <span className="size-2 rounded-full bg-[#22C55E]" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-[0.2em] text-[#8E8E93] mb-2">
              Pré-Contagem (Lead-In)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: 0 as const, label: "Desligado" },
                { val: 1 as const, label: "1 Compasso" },
                { val: 2 as const, label: "2 Compassos" },
              ].map((opt) => (
                <button
                  key={opt.val}
                  onClick={() => updateSettings({ countInBars: opt.val })}
                  className={cn(
                    "h-11 rounded-xl text-xs font-semibold border transition-colors",
                    settings.countInBars === opt.val
                      ? "bg-[#22C55E] text-black border-[#22C55E]"
                      : "bg-[#1E1E22] text-[#8E8E93] border-[#2D2D35] hover:text-white"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-[0.2em] text-[#8E8E93] mb-2">
              Som da Pré-Contagem
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => updateSettings({ countInVoice: "voice" })}
                className={cn(
                  "h-11 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 transition-colors",
                  settings.countInVoice === "voice"
                    ? "bg-white text-black border-white"
                    : "bg-[#1E1E22] text-[#8E8E93] border-[#2D2D35] hover:text-white"
                )}
              >
                <Mic className="size-3.5" />
                <span>Voz IA (1, 2, 3, 4)</span>
              </button>

              <button
                onClick={() => updateSettings({ countInVoice: "stick" })}
                className={cn(
                  "h-11 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 transition-colors",
                  settings.countInVoice === "stick"
                    ? "bg-white text-black border-white"
                    : "bg-[#1E1E22] text-[#8E8E93] border-[#2D2D35] hover:text-white"
                )}
              >
                <Radio className="size-3.5" />
                <span>Cross-stick / Baqueta</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
