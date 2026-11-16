import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Activity,
  Clock,
  SlidersHorizontal,
  ListMusic,
  Play,
  Square,
  Radio,
  Drum,
  Volume2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ScreenFlash } from "@/components/drum/Metronome";
import { StageView } from "@/components/views/StageView";
import { StudioView } from "@/components/views/StudioView";
import { MixerView } from "@/components/views/MixerView";
import { RepertoryView } from "@/components/views/RepertoryView";
import {
  DEFAULT_MIXER,
  DEFAULT_SETTINGS,
  uid,
  type Song,
  type SongSettings,
} from "@/lib/drum/types";
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

export type AppPage = "stage" | "studio" | "mixer" | "repertory";

interface NavItem {
  id: AppPage;
  label: string;
  sublabel: string;
  icon: typeof Activity;
}

const NAV_ITEMS: NavItem[] = [
  { id: "stage", label: "Palco", sublabel: "Metrônomo & Live", icon: Activity },
  { id: "studio", label: "Estúdio", sublabel: "Timeline & Áudio", icon: Clock },
  { id: "mixer", label: "Mixer", sublabel: "Mesa de Som", icon: SlidersHorizontal },
  { id: "repertory", label: "Repertório", sublabel: "Setlists & Músicas", icon: ListMusic },
];

function Index() {
  const [currentPage, setCurrentPage] = useState<AppPage>("stage");
  const [settings, setSettings] = usePersistent<SongSettings>("sc.settings", DEFAULT_SETTINGS);
  const [mixer, setMixer] = usePersistent("sc.mixer", DEFAULT_MIXER);
  const [songs, setSongs] = usePersistent<Song[]>("sc.songs", []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [flash, setFlash] = usePersistent("sc.flash", true);
  const [keepAwake, setKeepAwake] = usePersistent("sc.wake", true);

  const currentSongId = activeId ?? "free_play";
  const metro = useMetronome(settings, mixer, currentSongId);
  const wake = useWakeLock(metro.playing && keepAwake);
  const updateSettings = (p: Partial<SongSettings>) => setSettings((s) => ({ ...s, ...p }));

  const activeSong = songs.find((s) => s.id === activeId);

  // Carrega música no metrônomo
  const loadSong = (s: Song, targetPage: AppPage = "stage") => {
    const { id, name, ...rest } = s;
    setSettings(rest);
    setActiveId(id);
    metro.resetMeasures();
    setCurrentPage(targetPage);
  };

  // Cria uma nova música
  const handleAddNewSong = () => {
    const newSong: Song = {
      ...DEFAULT_SETTINGS,
      id: uid(),
      name: `Nova Música ${songs.length + 1}`,
      cues: [],
    };
    setSongs([...songs, newSong]);
    loadSong(newSong, "studio");
  };

  // Salva alterações na música atual
  const handleSaveToRepertory = (title: string) => {
    if (activeId) {
      setSongs(
        songs.map((s) => (s.id === activeId ? { ...s, ...settings, name: title } : s))
      );
    } else {
      const newSong: Song = {
        ...settings,
        id: uid(),
        name: title,
      };
      setSongs([...songs, newSong]);
      setActiveId(newSong.id);
    }
  };

  const currentMeasure = metro.tick?.bar ?? 1;
  const currentBeat = metro.tick?.beat ?? 0;

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-foreground flex flex-col md:flex-row antialiased selection:bg-[#22C55E] selection:text-black">
      <ScreenFlash tick={metro.tick} enabled={flash} />

      {/* =========================================================================
          DESKTOP SIDEBAR FIXA (>= 768px | Largura: 240px | Fundo: #121215)
         ========================================================================= */}
      <aside className="hidden md:flex md:w-[240px] md:flex-col fixed inset-y-0 left-0 z-40 bg-[#121215] border-r border-[#2D2D35] p-4 justify-between">
        <div className="space-y-6">
          {/* Logo do App */}
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="size-10 rounded-xl bg-[#22C55E] text-black flex items-center justify-center font-black shadow-[0_0_20px_rgba(34,197,94,0.35)]">
              <Activity className="size-5" />
            </div>
            <div>
              <span className="block font-black tracking-tight text-white text-base">
                STICK CLICK
              </span>
              <span className="block text-[10px] font-mono tracking-widest text-[#8E8E93] uppercase">
                Pro Drummer DAW
              </span>
            </div>
          </div>

          {/* Links de Navegação */}
          <nav className="space-y-1.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentPage(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all relative",
                    isActive
                      ? "bg-[#22C55E]/15 text-[#22C55E] font-bold shadow-sm"
                      : "text-[#8E8E93] hover:text-white hover:bg-[#1E1E22]"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[#22C55E]"
                    />
                  )}
                  <Icon className={cn("size-5 shrink-0", isActive ? "text-[#22C55E]" : "text-[#8E8E93]")} />
                  <div className="min-w-0">
                    <span className="block text-sm leading-none">{item.label}</span>
                    <span className="block text-[10px] text-[#8E8E93] mt-1 leading-none">
                      {item.sublabel}
                    </span>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Mini Player / Transporte na Sidebar do Desktop */}
        <div className="p-3.5 rounded-2xl bg-[#1E1E22] border border-[#2D2D35] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={cn("size-2 rounded-full", metro.playing ? "bg-[#22C55E] animate-ping" : "bg-[#8E8E93]")} />
              <span className="text-[11px] font-mono uppercase text-[#8E8E93]">
                {metro.playing ? "Em Andamento" : "Parado"}
              </span>
            </div>
            <span className="font-mono text-xs font-bold text-white">
              {settings.bpm} BPM
            </span>
          </div>

          <div className="truncate text-xs font-bold text-white">
            {activeSong?.name ?? "Música Livre"}
          </div>

          <button
            onClick={metro.toggle}
            className={cn(
              "w-full h-11 rounded-xl font-mono text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all",
              metro.playing
                ? "bg-[#22C55E] text-black shadow-[0_0_20px_rgba(34,197,94,0.4)]"
                : "bg-white text-black hover:bg-neutral-200"
            )}
          >
            {metro.playing ? (
              <>
                <Square className="size-4 fill-current" />
                <span>Parar</span>
              </>
            ) : (
              <>
                <Play className="size-4 fill-current ml-0.5" />
                <span>Tocar</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* =========================================================================
          CONTEÚDO PRINCIPAL (Área Livre com Padding para Desktop & Mobile)
         ========================================================================= */}
      <main className="flex-1 md:pl-[240px] flex flex-col min-h-screen">
        {/* Header Compacto para Mobile (< 768px) */}
        <div className="flex md:hidden items-center justify-between px-4 py-3 bg-[#121215] border-b border-[#2D2D35] sticky top-0 z-30">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-[#22C55E] text-black flex items-center justify-center font-black">
              <Activity className="size-4" />
            </div>
            <span className="font-black text-sm tracking-tight text-white">STICK CLICK</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-[#22C55E] bg-[#1E1E22] px-2.5 py-1 rounded-lg border border-[#2D2D35]">
              {settings.bpm} BPM
            </span>
            <button
              onClick={metro.toggle}
              className={cn(
                "size-8 rounded-lg grid place-items-center transition-colors",
                metro.playing ? "bg-[#22C55E] text-black" : "bg-white text-black"
              )}
            >
              {metro.playing ? <Square className="size-3.5 fill-current" /> : <Play className="size-3.5 fill-current ml-0.5" />}
            </button>
          </div>
        </div>

        {/* Área das Páginas (com animação suave de transição) */}
        <div className="flex-1 p-4 sm:p-6 md:p-8 pb-28 md:pb-8 max-w-7xl w-full mx-auto">
          <AnimatePresence mode="wait">
            {currentPage === "stage" && (
              <motion.div
                key="stage"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="h-full"
              >
                <StageView
                  settings={settings}
                  updateSettings={updateSettings}
                  tick={metro.tick}
                  isPlaying={metro.playing}
                  onTogglePlay={metro.toggle}
                  songs={songs}
                  activeSongId={activeId}
                  onSelectSong={(s) => loadSong(s, "stage")}
                  flashEnabled={flash}
                  onToggleFlash={setFlash}
                  wakeLockActive={keepAwake && wake.locked}
                  onToggleWakeLock={() => setKeepAwake(!keepAwake)}
                />
              </motion.div>
            )}

            {currentPage === "studio" && (
              <motion.div
                key="studio"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <StudioView
                  settings={settings}
                  updateSettings={updateSettings}
                  currentSongId={currentSongId}
                  currentSongName={activeSong?.name}
                  onSaveToRepertory={handleSaveToRepertory}
                  currentMeasure={currentMeasure}
                  currentBeat={currentBeat}
                  isPlaying={metro.playing}
                  onVolumeChange={(vol) => setMixer((m) => ({ ...m, music: vol }))}
                />
              </motion.div>
            )}

            {currentPage === "mixer" && (
              <motion.div
                key="mixer"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <MixerView
                  mixer={mixer}
                  setMixer={setMixer}
                />
              </motion.div>
            )}

            {currentPage === "repertory" && (
              <motion.div
                key="repertory"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <RepertoryView
                  songs={songs}
                  setSongs={setSongs}
                  activeSongId={activeId}
                  onSelectSong={(s) => loadSong(s, "stage")}
                  onEditInStudio={(s) => loadSong(s, "studio")}
                  onAddNewSong={handleAddNewSong}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* =========================================================================
          MOBILE BOTTOM NAVIGATION BAR FIXA (< 768px | Fundo: #121215)
         ========================================================================= */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 bg-[#121215] border-t border-[#2D2D35] md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-4 h-16">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 transition-colors relative py-1",
                  isActive ? "text-[#22C55E]" : "text-[#8E8E93] hover:text-white"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="bottom-nav-active"
                    className="absolute top-0 inset-x-3 h-0.5 bg-[#22C55E] rounded-full"
                  />
                )}
                <Icon className={cn("size-5", isActive ? "text-[#22C55E]" : "text-[#8E8E93]")} />
                <span className="text-[10px] font-bold tracking-tight">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
