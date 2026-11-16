import { useCallback, useEffect, useRef, useState } from "react";
import { accentFor, BEATS, type Mixer, type SongSettings } from "./types";

const NUMBERS = ["Um", "Dois", "Três", "Quatro", "Cinco", "Seis"];

const AUDIO_FILES: Record<string, string> = {
  "1": "/audio/falas/um.mp3",
  "2": "/audio/falas/dois.mp3",
  "3": "/audio/falas/tres.mp3",
  "4": "/audio/falas/quatro.mp3",
  "virada": "/audio/falas/virada em.mp3",
  "intro": "/audio/falas/Intro em.mp3",
  "pratos": "/audio/falas/enfeites no prato em.mp3",
  "prato": "/audio/falas/enfeites no prato em.mp3",
  "solo": "/audio/falas/solo.mp3",
};

// Cache global de áudios decodificados em memória RAM
const globalAudioBufferCache = new Map<string, AudioBuffer>();

async function loadAudioBuffer(ctx: AudioContext, key: string, url: string): Promise<AudioBuffer | null> {
  if (globalAudioBufferCache.has(key)) return globalAudioBufferCache.get(key)!;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    globalAudioBufferCache.set(key, decoded);
    return decoded;
  } catch {
    return null;
  }
}

function resolveVoiceKey(text: string): string | null {
  const normalized = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (normalized.includes("virada")) return "virada";
  if (normalized.includes("intro")) return "intro";
  if (normalized.includes("prato")) return "pratos";
  if (normalized.includes("solo")) return "solo";
  return null;
}

function speak(text: string, volume: number) {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || volume <= 0) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "pt-BR";
  u.rate = 1.25;
  u.volume = Math.min(1, volume);
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

export interface Tick {
  beat: number;
  bar: number; // 1-based, negative/zero during count-in
  countIn: boolean;
}

export async function loadCustomAudioTrack(ctx: AudioContext, key: string, blob: Blob | File): Promise<AudioBuffer> {
  const arrayBuffer = await blob.arrayBuffer();
  const buffer = await ctx.decodeAudioData(arrayBuffer);
  globalAudioBufferCache.set(key, buffer);
  return buffer;
}

export function useMetronome(settings: SongSettings, mixer: Mixer, backingTrackKey?: string | null) {
  const [playing, setPlaying] = useState(false);
  const [tick, setTick] = useState<Tick | null>(null);
  const settingsRef = useRef(settings);
  const mixerRef = useRef(mixer);
  const backingTrackKeyRef = useRef(backingTrackKey);
  settingsRef.current = settings;
  mixerRef.current = mixer;
  backingTrackKeyRef.current = backingTrackKey;

  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const musicSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const state = useRef({ next: 0, sub: 0, beat: 0, bar: 1, countInLeft: 0 });

  const click = (time: number, kind: "strong" | "medium" | "weak" | "sub" | "stick", gain: number) => {
    const ctx = ctxRef.current!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const soundType = settingsRef.current.clickSound ?? "woodblock";

    if (kind === "stick") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(2400, time);
      g.gain.setValueAtTime(0.0001, time);
      g.gain.exponentialRampToValueAtTime(Math.max(gain * 0.5, 0.0002), time + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);
    } else {
      switch (soundType) {
        case "beep":
          osc.type = "sine";
          osc.frequency.setValueAtTime(kind === "strong" ? 1200 : kind === "medium" ? 1000 : 800, time);
          g.gain.setValueAtTime(0.0001, time);
          g.gain.exponentialRampToValueAtTime(Math.max(gain * 0.5, 0.0002), time + 0.001);
          g.gain.exponentialRampToValueAtTime(0.0001, time + (kind === "sub" ? 0.03 : 0.05));
          break;
        case "cowbell":
          osc.type = "square";
          osc.frequency.setValueAtTime(kind === "strong" ? 800 : kind === "medium" ? 680 : 580, time);
          g.gain.setValueAtTime(0.0001, time);
          g.gain.exponentialRampToValueAtTime(Math.max(gain * 0.4, 0.0002), time + 0.001);
          g.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);
          break;
        case "mechanical":
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(kind === "strong" ? 2400 : kind === "medium" ? 2000 : 1600, time);
          g.gain.setValueAtTime(0.0001, time);
          g.gain.exponentialRampToValueAtTime(Math.max(gain * 0.35, 0.0002), time + 0.001);
          g.gain.exponentialRampToValueAtTime(0.0001, time + 0.02);
          break;
        case "woodblock":
        default:
          osc.type = "triangle";
          osc.frequency.setValueAtTime(kind === "strong" ? 1800 : kind === "medium" ? 1400 : 1100, time);
          g.gain.setValueAtTime(0.0001, time);
          g.gain.exponentialRampToValueAtTime(Math.max(gain * 0.6, 0.0002), time + 0.001);
          g.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);
          break;
      }
    }

    osc.connect(g).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.09);
  };

  const playSample = (time: number, bufferKey: string, gain: number) => {
    const ctx = ctxRef.current;
    if (!ctx) return false;
    const buffer = globalAudioBufferCache.get(bufferKey);
    if (!buffer) return false;

    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const g = ctx.createGain();
      g.gain.setValueAtTime(Math.min(1, Math.max(0, gain)), time);
      source.connect(g).connect(ctx.destination);
      source.start(time);
      return true;
    } catch {
      return false;
    }
  };

  const at = (time: number, fn: () => void) => {
    const ctx = ctxRef.current!;
    window.setTimeout(fn, Math.max(0, (time - ctx.currentTime) * 1000));
  };

  const scheduler = useCallback(() => {
    const ctx = ctxRef.current!;
    const s = state.current;
    while (s.next < ctx.currentTime + 0.12) {
      const cfg = settingsRef.current;
      const mx = mixerRef.current;
      const beats = BEATS[cfg.timeSig];
      const subs = cfg.subdivision;
      const time = s.next;
      const counting = s.countInLeft > 0;

      if (s.sub === 0) {
        const beat = s.beat;
        const bar = s.bar;
        if (counting) {
          if (cfg.countInVoice === "voice") {
            click(time, "stick", mx.master * mx.countIn * 0.4);
            const countKey = String(beat + 1);
            const played = playSample(time, countKey, mx.master * mx.countIn);
            if (!played) {
              at(time, () => speak(NUMBERS[beat] ?? String(beat + 1), mx.master * mx.countIn));
            }
          } else click(time, "stick", mx.master * mx.countIn);
        } else {
          click(time, accentFor(cfg.timeSig, beat), mx.master * mx.click);
          if (beat === 0) {
            const cue = cfg.cues.find((c) => c.bar === bar);
            if (cue) {
              const voiceKey = resolveVoiceKey(cue.text);
              const played = voiceKey ? playSample(time, voiceKey, mx.master * mx.cues) : false;
              if (!played) {
                at(time, () => speak(cue.text, mx.master * mx.cues));
              }
            }
          }
        }
        at(time, () => setTick({ beat, bar: counting ? -s.countInLeft : bar, countIn: counting }));
      } else if (!counting) {
        click(time, "sub", mx.master * mx.click);
      }

      // advance
      const beatLen = (60 / cfg.bpm) * (cfg.timeSig === "6/8" ? 0.5 : 1);
      s.next += beatLen / (counting ? 1 : subs);
      s.sub = counting ? 0 : (s.sub + 1) % subs;
      if (s.sub === 0) {
        s.beat += 1;
        if (s.beat >= beats) {
          s.beat = 0;
          if (counting) s.countInLeft -= 1;
          else s.bar += 1;
        }
      }
    }
  }, []);

  const start = useCallback(async () => {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    await ctxRef.current.resume();

    // Pré-carrega buffers das vozes reais em segundo plano
    Object.entries(AUDIO_FILES).forEach(([k, url]) => {
      loadAudioBuffer(ctxRef.current!, k, url);
    });

    const startTime = ctxRef.current.currentTime + 0.08;

    // Dispara a música de fundo sincronizada no tempo exato de hardware
    const trackKey = backingTrackKeyRef.current;
    if (trackKey && globalAudioBufferCache.has(trackKey)) {
      try {
        if (musicSourceRef.current) {
          musicSourceRef.current.stop();
          musicSourceRef.current.disconnect();
        }
        const buffer = globalAudioBufferCache.get(trackKey)!;
        const source = ctxRef.current.createBufferSource();
        source.buffer = buffer;
        const gainNode = ctxRef.current.createGain();
        const musicVol = (mixerRef.current.master || 1) * (mixerRef.current.music ?? 0.85);
        gainNode.gain.setValueAtTime(musicVol, startTime);
        source.connect(gainNode).connect(ctxRef.current.destination);
        source.start(startTime);
        musicSourceRef.current = source;
      } catch (err) {
        console.warn("Erro ao iniciar backing track:", err);
      }
    }

    state.current = {
      next: startTime,
      sub: 0,
      beat: 0,
      bar: 1,
      countInLeft: settingsRef.current.countInBars,
    };
    timerRef.current = window.setInterval(scheduler, 25);
    setPlaying(true);
  }, [scheduler]);

  const stop = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();

    if (musicSourceRef.current) {
      try {
        musicSourceRef.current.stop();
        musicSourceRef.current.disconnect();
      } catch {}
      musicSourceRef.current = null;
    }

    setPlaying(false);
    setTick(null);
  }, []);

  const resetMeasures = useCallback(() => {
    state.current.bar = 1;
    state.current.beat = 0;
    state.current.sub = 0;
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { playing, tick, start, stop, resetMeasures, toggle: () => (playing ? stop() : start()) };
}

export function useWakeLock(active: boolean) {
  const [supported, setSupported] = useState(false);
  const [locked, setLocked] = useState(false);
  useEffect(() => setSupported(typeof navigator !== "undefined" && "wakeLock" in navigator), []);
  useEffect(() => {
    if (!active || !supported) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) return sentinel.release();
        setLocked(true);
        sentinel.addEventListener("release", () => setLocked(false));
      } catch {
        setLocked(false);
      }
    };
    acquire();
    const onVis = () => document.visibilityState === "visible" && acquire();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      sentinel?.release();
      setLocked(false);
    };
  }, [active, supported]);
  return { supported, locked };
}

export function usePersistent<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setValue(JSON.parse(raw));
    } catch {}
    loaded.current = true;
  }, [key]);
  useEffect(() => {
    if (loaded.current) localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue] as const;
}
