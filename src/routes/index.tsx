import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import {
  ListMusic,
  SlidersHorizontal,
  Play,
  Square,
  Sun,
  SunDim,
  SkipForward,
  Activity,
  Layers,
  Radio,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BpmControls, MetronomeDisplay, ScreenFlash } from "@/components/drum/Metronome";
import { MixerSheet, SetlistSheet, VoicePanel } from "@/components/drum/Panels";
import { BackingTrackPanel } from "@/components/drum/BackingTrackPanel";
import { TimelineEditor } from "@/components/drum/TimelineEditor";
import { DrumMixerPanel } from "@/components/drum/DrumMixerPanel";
import { DEFAULT_MIXER, DEFAULT_SETTINGS, type Song, type SongSettings } from "@/lib/drum/types";
import { useMetronome, usePersistent, useWakeLock } from "@/lib/drum/useMetronome";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Stick Click — DAW & Metrônomo de Palco para Bateristas" },
      {
        name: "description",
        content:
          "Suíte profissional para bateristas com metrônomo de alta precisão, linha do tempo de voz por IA, backing track e mixer de microfones ao vivo.",
      },
      { property: "og:title", content: "Stick Click — Suíte Profissional para Bateristas" },
      {
        property: "og:description",
        content: "Timeline multitrack, comandos de voz por IA e mixer de bateria ao vivo.",
      },
    ],
  }),
  component: Index,
});

type MobileTab = "metronome" | "timeline" | "mixer" | "cues";

function Index() {
  const [settings, setSettings] = usePersistent<SongSettings>("sc.settings", DEFAULT_SETTINGS);
  const [mixer, setMixer] = usePersistent("sc.mixer", DEFAULT_MIXER);
  const [songs, setSongs] = usePersistent<Song[]>("sc.songs", []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [flash, setFlash] = usePersistent("sc.flash", true);
  const [keepAwake, setKeepAwake] = usePersistent("sc.wake", true);
  const [mixerOpen, setMixerOpen] = useState(false);
  const [setlistOpen, setSetlistOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("metronome");

  const currentSongId = activeId ?? "free_play";
  const metro = useMetronome(settings, mixer, currentSongId);
  const wake = useWakeLock(metro.playing && keepAwake);
  const update = (p: Partial<SongSettings>) => setSettings((s) => ({ ...s, ...p }));
  const active = songs.find((s) => s.id === activeId);

  const load = (s: Song) => {
    const { id, name, ...rest } = s;
    setSettings(rest);
    setActiveId(id);
    metro.resetMeasures();
  };

  const next = () => {
    const i = songs.findIndex((s) => s.id === activeId);
    const n = songs[i + 1] ?? songs[0];
    if (n) load(n);
  };

  const currentMeasure = metro.tick?.bar ?? 1;
  const currentBeat = metro.tick?.beat ?? 0;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col pb-28 md:pb-20">
      <ScreenFlash tick={metro.tick} enabled={flash} />

      {/* =========================================================================
          HEADER PRINCIPAL (RESPONSIVO)
         ========================================================================= */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 px-4 py-2.5 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          {/* Logo e Botão Setlist */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSetlistOpen(true)}
              className="flex min-h-11 items-center gap-2.5 rounded-xl border border-border bg-card px-3 text-left hover:border-live/60 transition-colors"
            >
              <ListMusic className="size-4 shrink-0 text-live" />
              <div className="min-w-0">
                <span className="block text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                  Setlist
                </span>
                <span className="block truncate text-xs font-semibold max-w-[140px] md:max-w-[200px]">
                  {active?.name ?? "Música Livre"}
                </span>
              </div>
            </button>

            {songs.length > 1 && (
              <button
                aria-label="Próxima música"
                onClick={next}
                className="grid size-11 place-items-center rounded-xl border border-border bg-card hover:bg-secondary text-foreground transition-colors"
              >
                <SkipForward className="size-4" />
              </button>
            )}
          </div>

          {/* Abas de Navegação no Mobile (< 768px) */}
          <div className="flex md:hidden items-center gap-1 bg-secondary/80 p-1 rounded-xl border border-border">
            <button
              onClick={() => setMobileTab("metronome")}
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors",
                mobileTab === "metronome" ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground",
              )}
            >
              Metrônomo
            </button>
            <button
              onClick={() => setMobileTab("timeline")}
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors",
                mobileTab === "timeline" ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground",
              )}
            >
              Timeline
            </button>
            <button
              onClick={() => setMobileTab("mixer")}
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors",
                mobileTab === "mixer" ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground",
              )}
            >
              Mixer
            </button>
            <button
              onClick={() => setMobileTab("cues")}
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors",
                mobileTab === "cues" ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground",
              )}
            >
              Vozes
            </button>
          </div>

          {/* Botões do Topo Direito (Desktop & Mobile) */}
          <div className="flex items-center gap-2">
            <button
              aria-label="Mixer Geral"
              onClick={() => setMixerOpen(true)}
              className="grid size-11 place-items-center rounded-xl border border-border bg-card hover:bg-secondary transition-colors"
            >
              <SlidersHorizontal className="size-4" />
            </button>
          </div>
        </div>
      </header>

      {/* =========================================================================
          CONTEÚDO PRINCIPAL (LAYOUT DUAL: MOBILE FIRST vs. WORKSPACE DAW)
         ========================================================================= */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6">
        {/* --- VISÃO MOBILE (< 768px) CONTROLADA POR ABAS --- */}
        <div className="block md:hidden space-y-4">
          {mobileTab === "metronome" && (
            <div className="space-y-4">
              <MetronomeDisplay
                settings={settings}
                tick={metro.tick}
                playing={metro.playing}
                flash={flash}
                onFlash={setFlash}
              />
              <BpmControls settings={settings} update={update} />
              <BackingTrackPanel
                songId={currentSongId}
                onVolumeChange={(musicVol) => setMixer((m) => ({ ...m, music: musicVol }))}
              />
            </div>
          )}

          {mobileTab === "timeline" && (
            <TimelineEditor
              settings={settings}
              updateSettings={update}
              currentMeasure={currentMeasure}
              currentBeat={currentBeat}
              isPlaying={metro.playing}
            />
          )}

          {mobileTab === "mixer" && (
            <DrumMixerPanel />
          )}

          {mobileTab === "cues" && (
            <VoicePanel settings={settings} update={update} />
          )}
        </div>

        {/* --- VISÃO DESKTOP (>= 768px) ESTILO WORKSPACE DAW --- */}
        <div className="hidden md:grid md:grid-cols-12 gap-5">
          {/* Topo da DAW: Linha do Tempo Visual Multitrack (Full Width) */}
          <div className="col-span-12">
            <TimelineEditor
              settings={settings}
              updateSettings={update}
              currentMeasure={currentMeasure}
              currentBeat={currentBeat}
              isPlaying={metro.playing}
              totalMeasures={64}
            />
          </div>

          {/* Coluna Esquerda: Display Gigante do Metrônomo + Andamento (5 Colunas) */}
          <div className="col-span-12 lg:col-span-5 space-y-4">
            <MetronomeDisplay
              settings={settings}
              tick={metro.tick}
              playing={metro.playing}
              flash={flash}
              onFlash={setFlash}
            />
            <BpmControls settings={settings} update={update} />
          </div>

          {/* Coluna Direita: Backing Track + Mixer Multicanal ao Vivo (7 Colunas) */}
          <div className="col-span-12 lg:col-span-7 space-y-4">
            <BackingTrackPanel
              songId={currentSongId}
              onVolumeChange={(musicVol) => setMixer((m) => ({ ...m, music: musicVol }))}
            />
            <DrumMixerPanel />
            <VoicePanel settings={settings} update={update} />
          </div>
        </div>
      </div>

      {/* =========================================================================
          BARRA DE TRANSPORTE FIXA NA PARTE INFERIOR
         ========================================================================= */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2.5">
          {/* Botão Wake Lock / Tela Acesa */}
          <button
            onClick={() => setKeepAwake(!keepAwake)}
            className={cn(
              "flex size-12 flex-col items-center justify-center rounded-xl text-[10px] transition-colors",
              keepAwake ? "text-foreground bg-secondary/80" : "text-muted-foreground",
            )}
          >
            {keepAwake ? <Sun className="size-4 text-live" /> : <SunDim className="size-4" />}
            {keepAwake ? (wake.locked ? "Tela On" : "Acesa") : "Auto"}
          </button>

          {/* Botão Central de Play / Stop Gigante */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={metro.toggle}
            aria-label={metro.playing ? "Parar" : "Tocar"}
            className={cn(
              "-mt-8 grid size-20 md:size-24 place-items-center rounded-full border-4 border-background transition-all shadow-xl",
              metro.playing
                ? "bg-live text-live-foreground shadow-[0_0_40px_rgba(34,197,94,0.4)]"
                : "bg-primary text-primary-foreground hover:scale-105",
            )}
          >
            {metro.playing ? (
              <Square className="size-7 md:size-8 fill-current" />
            ) : (
              <Play className="ml-1 size-8 md:size-9 fill-current" />
            )}
          </motion.button>

          {/* Indicador de BPM e Compasso */}
          <div className="flex size-12 flex-col items-center justify-center font-mono text-[10px] text-muted-foreground">
            <span className="text-sm md:text-base font-bold text-foreground">{settings.bpm}</span>
            <span>BPM · c.{metro.tick?.bar ?? 1}</span>
          </div>
        </div>
      </nav>

      {/* Modais e Gavetas Laterais */}
      <MixerSheet open={mixerOpen} onOpenChange={setMixerOpen} mixer={mixer} setMixer={setMixer} />
      <SetlistSheet
        open={setlistOpen}
        onOpenChange={setSetlistOpen}
        songs={songs}
        setSongs={setSongs}
        current={settings}
        activeId={activeId}
        onLoad={load}
      />
    </div>
  );
}
