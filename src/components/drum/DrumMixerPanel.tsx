import { useEffect, useState, useRef } from "react";
import { Mic, MicOff, Volume2, VolumeX, Headphones, Radio } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { DrumLiveMixer, type DrumChannelId } from "@/lib/audio/DrumLiveMixer";

interface DrumMixerPanelProps {
  className?: string;
  audioCtx?: AudioContext;
}

interface ChannelState {
  id: DrumChannelId;
  label: string;
  sublabel: string;
  color: string;
  volume: number; // 0 a 150%
  muted: boolean;
}

const INITIAL_CHANNELS: ChannelState[] = [
  { id: "kick", label: "Bumbo", sublabel: "< 130Hz", color: "from-amber-500 to-red-500", volume: 100, muted: false },
  { id: "snare", label: "Caixa", sublabel: "~650Hz", color: "from-blue-500 to-cyan-400", volume: 100, muted: false },
  { id: "toms", label: "Tons", sublabel: "~320Hz", color: "from-emerald-500 to-teal-400", volume: 100, muted: false },
  { id: "cymbals", label: "Pratos", sublabel: "> 3.5kHz", color: "from-yellow-400 to-amber-300", volume: 90, muted: false },
  { id: "master", label: "Master Mic", sublabel: "Geral", color: "from-live to-emerald-400", volume: 100, muted: false },
];

export function DrumMixerPanel({ className, audioCtx }: DrumMixerPanelProps) {
  const mixerRef = useRef<DrumLiveMixer | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [directMonitor, setDirectMonitor] = useState(false);
  const [channels, setChannels] = useState<ChannelState[]>(INITIAL_CHANNELS);
  const [levels, setLevels] = useState<Record<string, number>>({
    kick: 0,
    snare: 0,
    toms: 0,
    cymbals: 0,
    master: 0,
  });

  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    mixerRef.current = new DrumLiveMixer(audioCtx);
    return () => {
      mixerRef.current?.stop();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [audioCtx]);

  // Loop de alta performance para alimentar os medidores de pico (VU Meters)
  useEffect(() => {
    if (!isActive) return;

    const updateVUMeters = () => {
      if (mixerRef.current && mixerRef.current.getIsConnected()) {
        setLevels({
          kick: mixerRef.current.getLevel("kick"),
          snare: mixerRef.current.getLevel("snare"),
          toms: mixerRef.current.getLevel("toms"),
          cymbals: mixerRef.current.getLevel("cymbals"),
          master: mixerRef.current.getLevel("master"),
        });
      }
      animFrameRef.current = requestAnimationFrame(updateVUMeters);
    };

    animFrameRef.current = requestAnimationFrame(updateVUMeters);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isActive]);

  const handleToggleMic = async () => {
    if (!mixerRef.current) return;

    if (isActive) {
      mixerRef.current.stop();
      setIsActive(false);
    } else {
      const connected = await mixerRef.current.initializeMicrophone(directMonitor);
      setIsActive(connected);
      if (!connected) {
        alert("Não foi possível acessar a entrada de áudio. Permita o microfone no navegador.");
      }
    }
  };

  const handleMonitorToggle = (checked: boolean) => {
    setDirectMonitor(checked);
    mixerRef.current?.setDirectMonitor(checked);
  };

  const handleVolumeChange = (id: DrumChannelId, val: number) => {
    setChannels((prev) =>
      prev.map((ch) => (ch.id === id ? { ...ch, volume: val } : ch)),
    );
    mixerRef.current?.setChannelVolume(id, val / 100);
  };

  const handleMuteToggle = (id: DrumChannelId) => {
    setChannels((prev) =>
      prev.map((ch) => {
        if (ch.id === id) {
          const nextMuted = !ch.muted;
          mixerRef.current?.setChannelMute(id, nextMuted, ch.volume / 100);
          return { ...ch, muted: nextMuted };
        }
        return ch;
      }),
    );
  };

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4 space-y-4", className)}>
      {/* Topo do Mixer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Radio className={cn("size-4", isActive ? "text-live animate-pulse" : "text-muted-foreground")} />
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground">
            Mixer Multicanal de Bateria ao Vivo
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Headphones className="size-3.5" />
            Direct Monitor
            <Switch checked={directMonitor} onCheckedChange={handleMonitorToggle} disabled={!isActive} />
          </label>

          <button
            onClick={handleToggleMic}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
              isActive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-live text-live-foreground hover:bg-live/90",
            )}
          >
            {isActive ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
            {isActive ? "Desconectar Mic" : "Ativar Microfones"}
          </button>
        </div>
      </div>

      {/* Grade de Faders Verticais estilo DAW */}
      <div className="grid grid-cols-5 gap-2 pt-1">
        {channels.map((ch) => {
          const level = levels[ch.id] ?? 0;
          const isClipping = level > 0.88;

          return (
            <div
              key={ch.id}
              className={cn(
                "flex flex-col items-center justify-between rounded-xl border p-2 bg-secondary/50 transition-colors",
                ch.id === "master" ? "border-live/40 bg-live/5" : "border-border/70",
                ch.muted && "opacity-50",
              )}
            >
              {/* Título do Canal */}
              <div className="text-center w-full">
                <span className="block truncate text-xs font-semibold">{ch.label}</span>
                <span className="block font-mono text-[9px] text-muted-foreground">{ch.sublabel}</span>
              </div>

              {/* Fader Vertical + VU Meter */}
              <div className="flex items-center justify-center gap-2 my-3 h-36 w-full">
                {/* VU Meter em Barra Gradiente */}
                <div className="relative w-2.5 h-full rounded-full bg-background overflow-hidden border border-border/50">
                  <div
                    className={cn(
                      "absolute bottom-0 inset-x-0 transition-all duration-75 rounded-full",
                      isClipping
                        ? "bg-gradient-to-t from-emerald-500 via-amber-400 to-red-500"
                        : "bg-gradient-to-t from-emerald-500 to-live",
                    )}
                    style={{ height: `${Math.round(level * 100)}%` }}
                  />
                </div>

                {/* Slider / Fader */}
                <div className="h-full flex items-center">
                  <Slider
                    orientation="vertical"
                    value={[ch.muted ? 0 : ch.volume]}
                    min={0}
                    max={150}
                    step={1}
                    onValueChange={([v]) => handleVolumeChange(ch.id, v ?? 100)}
                    disabled={!isActive || ch.muted}
                    className="h-full"
                  />
                </div>
              </div>

              {/* Porcentagem e Botão Mute */}
              <div className="w-full text-center space-y-1">
                <span className="block font-mono text-[10px] text-muted-foreground">
                  {ch.muted ? "MUTED" : `${ch.volume}%`}
                </span>
                <button
                  onClick={() => handleMuteToggle(ch.id)}
                  disabled={!isActive}
                  className={cn(
                    "w-full py-1 rounded text-[10px] font-bold uppercase transition-colors",
                    ch.muted
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-background hover:bg-accent text-foreground border border-border",
                  )}
                >
                  {ch.muted ? <VolumeX className="size-3 mx-auto" /> : "Mute"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
