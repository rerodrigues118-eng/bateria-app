import { useState, useEffect, useRef } from "react";
import {
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Headphones,
  SlidersHorizontal,
  Radio,
  Activity,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { Mixer } from "@/lib/drum/types";
import { DrumLiveMixer, type DrumChannelId } from "@/lib/audio/DrumLiveMixer";

interface MixerViewProps {
  mixer: Mixer;
  setMixer: (m: Mixer) => void;
  audioCtx?: AudioContext;
}

interface DrumChannelConfig {
  id: DrumChannelId;
  label: string;
  sublabel: string;
  filterDesc: string;
  volume: number; // 0 - 150
  muted: boolean;
}

const INITIAL_DRUM_CHANNELS: DrumChannelConfig[] = [
  { id: "kick", label: "Bumbo", sublabel: "Kick Drum", filterDesc: "Low-pass < 130Hz", volume: 100, muted: false },
  { id: "snare", label: "Caixa", sublabel: "Snare", filterDesc: "Band-pass ~650Hz", volume: 100, muted: false },
  { id: "toms", label: "Tons", sublabel: "Toms", filterDesc: "Band-pass ~320Hz", volume: 100, muted: false },
  { id: "cymbals", label: "Pratos", sublabel: "Overheads", filterDesc: "High-shelf > 3.5kHz", volume: 90, muted: false },
];

export function MixerView({ mixer, setMixer, audioCtx }: MixerViewProps) {
  // Estado dos canais de playback
  const [playbackMutes, setPlaybackMutes] = useState<Record<string, boolean>>({
    master: false,
    click: false,
    cues: false,
    music: false,
  });

  // Estado da captação de bateria ao vivo
  const drumMixerRef = useRef<DrumLiveMixer | null>(null);
  const [micActive, setMicActive] = useState(false);
  const [directMonitor, setDirectMonitor] = useState(false);
  const [drumChannels, setDrumChannels] = useState<DrumChannelConfig[]>(INITIAL_DRUM_CHANNELS);
  const [vuLevels, setVuLevels] = useState<Record<string, number>>({
    kick: 0,
    snare: 0,
    toms: 0,
    cymbals: 0,
    master: 0,
  });

  const animRef = useRef<number | null>(null);

  // Inicializa o mixer de microfone
  useEffect(() => {
    drumMixerRef.current = new DrumLiveMixer(audioCtx);
    return () => {
      drumMixerRef.current?.stop();
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [audioCtx]);

  // Loop de medição de VU em tempo real
  useEffect(() => {
    if (!micActive) return;

    const pollVU = () => {
      if (drumMixerRef.current && drumMixerRef.current.getIsConnected()) {
        setVuLevels({
          kick: drumMixerRef.current.getLevel("kick"),
          snare: drumMixerRef.current.getLevel("snare"),
          toms: drumMixerRef.current.getLevel("toms"),
          cymbals: drumMixerRef.current.getLevel("cymbals"),
          master: drumMixerRef.current.getLevel("master"),
        });
      }
      animRef.current = requestAnimationFrame(pollVU);
    };

    animRef.current = requestAnimationFrame(pollVU);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [micActive]);

  const toggleMic = async () => {
    if (!drumMixerRef.current) return;

    if (micActive) {
      drumMixerRef.current.stop();
      setMicActive(false);
      setVuLevels({ kick: 0, snare: 0, toms: 0, cymbals: 0, master: 0 });
    } else {
      const ok = await drumMixerRef.current.initializeMicrophone(directMonitor);
      if (ok) setMicActive(true);
    }
  };

  const handleMonitorToggle = (checked: boolean) => {
    setDirectMonitor(checked);
    drumMixerRef.current?.setDirectMonitor(checked);
  };

  const setDrumChannelVolume = (id: DrumChannelId, val: number) => {
    setDrumChannels((prev) =>
      prev.map((c) => (c.id === id ? { ...c, volume: val } : c))
    );
    const channel = drumChannels.find((c) => c.id === id);
    if (channel && !channel.muted) {
      drumMixerRef.current?.setChannelVolume(id, val / 100);
    }
  };

  const toggleDrumMute = (id: DrumChannelId) => {
    setDrumChannels((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const newMuted = !c.muted;
        drumMixerRef.current?.setChannelMute(id, newMuted, c.volume / 100);
        return { ...c, muted: newMuted };
      })
    );
  };

  const playbackChannels: { key: keyof Mixer; label: string; sub: string }[] = [
    { key: "master", label: "Master", sub: "Saída Geral" },
    { key: "click", label: "Metrônomo", sub: "Clique" },
    { key: "cues", label: "Vozes IA", sub: "Avisos & Contagem" },
    { key: "music", label: "Backing Track", sub: "Música MP3" },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-6">
      {/* ─── SEÇÃO 1: MESA DE PLAYBACK (METRÔNOMO, VOZES, MÚSICA, MASTER) ──────── */}
      <section className="rounded-2xl bg-[#121215] border border-[#2D2D35] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2D2D35] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal className="size-4 text-[#22C55E]" />
            <h2 className="text-xs font-mono uppercase tracking-[0.2em] font-bold text-white">
              Canais de Playback (Console de Monitoração)
            </h2>
          </div>
          <span className="text-[11px] font-mono text-[#8E8E93]">
            4 Canais Independentes
          </span>
        </div>

        <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {playbackChannels.map((c) => {
            const rawVal = mixer[c.key] ?? 0.85;
            const isMuted = playbackMutes[c.key] ?? false;
            const displayVal = isMuted ? 0 : Math.round(rawVal * 100);

            return (
              <div
                key={c.key}
                className="flex flex-col items-center justify-between p-4 rounded-xl bg-[#1E1E22] border border-[#2D2D35] gap-4"
              >
                {/* Cabeçalho do Canal */}
                <div className="text-center w-full">
                  <span className="block text-sm font-bold text-white truncate">{c.label}</span>
                  <span className="block text-[10px] text-[#8E8E93] truncate">{c.sub}</span>
                </div>

                {/* Fader Vertical do Volume */}
                <div className="h-44 flex items-center justify-center py-2">
                  <Slider
                    orientation="vertical"
                    value={[displayVal]}
                    max={100}
                    step={1}
                    disabled={isMuted}
                    onValueChange={([v]) => {
                      if (v !== undefined) {
                        setMixer({ ...mixer, [c.key]: v / 100 });
                      }
                    }}
                    className="h-40"
                  />
                </div>

                {/* Display Numérico e Botão Mute */}
                <div className="w-full flex flex-col items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#121215] border border-[#2D2D35] text-white">
                    {displayVal}%
                  </span>

                  <button
                    onClick={() =>
                      setPlaybackMutes((prev) => ({ ...prev, [c.key]: !prev[c.key] }))
                    }
                    className={cn(
                      "w-full h-8 rounded-lg text-xs font-mono font-bold uppercase transition-colors flex items-center justify-center gap-1.5",
                      isMuted
                        ? "bg-red-500/20 text-red-400 border border-red-500/40"
                        : "bg-[#121215] text-[#8E8E93] hover:text-white border border-[#2D2D35]"
                    )}
                  >
                    {isMuted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
                    <span>{isMuted ? "MUTADO" : "MUTE"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── SEÇÃO 2: CAPTAÇÃO DA BATERIA AO VIVO (MICROFONES & INTERFACE) ────────── */}
      <section className="rounded-2xl bg-[#121215] border border-[#2D2D35] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2D2D35] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Mic className={cn("size-4", micActive ? "text-[#22C55E]" : "text-[#8E8E93]")} />
            <div>
              <h2 className="text-xs font-mono uppercase tracking-[0.2em] font-bold text-white">
                Captação da Bateria ao Vivo (Microfone / Interface USB)
              </h2>
              <span className="text-[11px] text-[#8E8E93]">
                Filtros DSP para separação de frequências da bateria
              </span>
            </div>
          </div>

          {/* Ações da Captação: Ativar & Direct Monitor */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-medium text-[#8E8E93] cursor-pointer">
              <Headphones className="size-4" />
              <span>Ouvir no Fone</span>
              <Switch checked={directMonitor} onCheckedChange={handleMonitorToggle} disabled={!micActive} />
            </label>

            <button
              onClick={toggleMic}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider border transition-colors",
                micActive
                  ? "bg-[#22C55E] text-black border-[#22C55E] shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                  : "bg-[#1E1E22] text-white border-[#2D2D35] hover:border-[#22C55E]/50"
              )}
            >
              {micActive ? <Mic className="size-3.5" /> : <MicOff className="size-3.5" />}
              <span>{micActive ? "Microfone Ativo" : "Ativar Microfone"}</span>
            </button>
          </div>
        </div>

        {/* Console dos 4 Canais da Bateria */}
        <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {drumChannels.map((c) => {
            const level = vuLevels[c.id] ?? 0;

            return (
              <div
                key={c.id}
                className="flex flex-col items-center justify-between p-4 rounded-xl bg-[#1E1E22] border border-[#2D2D35] gap-4"
              >
                {/* Título do Canal */}
                <div className="text-center w-full">
                  <span className="block text-sm font-bold text-white truncate">{c.label}</span>
                  <span className="block text-[10px] text-[#22C55E] font-mono truncate">{c.filterDesc}</span>
                </div>

                {/* Medidor VU e Fader lado a lado */}
                <div className="h-44 flex items-center justify-center gap-4 py-2">
                  {/* Barra VU Vertical */}
                  <div className="w-2.5 h-40 bg-[#121215] rounded-full overflow-hidden border border-[#2D2D35] flex flex-col-reverse p-0.5">
                    <div
                      className={cn(
                        "w-full rounded-full transition-all duration-75",
                        level > 80 ? "bg-red-500" : level > 50 ? "bg-amber-400" : "bg-[#22C55E]"
                      )}
                      style={{ height: `${Math.min(100, level)}%` }}
                    />
                  </div>

                  {/* Fader do Volume */}
                  <Slider
                    orientation="vertical"
                    value={[c.muted ? 0 : c.volume]}
                    max={150}
                    step={1}
                    disabled={!micActive || c.muted}
                    onValueChange={([v]) => v !== undefined && setDrumChannelVolume(c.id, v)}
                    className="h-40"
                  />
                </div>

                {/* Display e Mute */}
                <div className="w-full flex flex-col items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#121215] border border-[#2D2D35] text-white">
                    {c.muted ? "0%" : `${c.volume}%`}
                  </span>

                  <button
                    onClick={() => toggleDrumMute(c.id)}
                    disabled={!micActive}
                    className={cn(
                      "w-full h-8 rounded-lg text-xs font-mono font-bold uppercase transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40",
                      c.muted
                        ? "bg-red-500/20 text-red-400 border border-red-500/40"
                        : "bg-[#121215] text-[#8E8E93] hover:text-white border border-[#2D2D35]"
                    )}
                  >
                    {c.muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
                    <span>{c.muted ? "MUTADO" : "MUTE"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
