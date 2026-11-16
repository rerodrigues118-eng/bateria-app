export type TimeSig = "4/4" | "3/4" | "6/8";
export type Subdivision = 1 | 2 | 3 | 4;
export type CountInVoice = "voice" | "stick";
export type ClickSoundType = "woodblock" | "beep" | "cowbell" | "mechanical";

export interface VoiceCue {
  id: string;
  bar: number;
  text: string;
}

export interface SongSettings {
  bpm: number;
  timeSig: TimeSig;
  subdivision: Subdivision;
  countInBars: 0 | 1 | 2;
  countInVoice: CountInVoice;
  clickSound?: ClickSoundType;
  cues: VoiceCue[];
}

export interface Song extends SongSettings {
  id: string;
  name: string;
}

export interface Mixer {
  master: number;
  click: number;
  countIn: number;
  cues: number;
  music?: number;
}

export const BEATS: Record<TimeSig, number> = { "4/4": 4, "3/4": 3, "6/8": 6 };
export const SUBDIVISIONS: { value: Subdivision; label: string; symbol: string }[] = [
  { value: 1, label: "Semínima", symbol: "♩" },
  { value: 2, label: "Colcheia", symbol: "♪♪" },
  { value: 3, label: "Tercina", symbol: "3" },
  { value: 4, label: "Semicolcheia", symbol: "♬♬" },
];

export const CLICK_SOUNDS: { value: ClickSoundType; label: string }[] = [
  { value: "woodblock", label: "Madeira" },
  { value: "beep", label: "Beep" },
  { value: "cowbell", label: "Cowbell" },
  { value: "mechanical", label: "Mecânico" },
];

export const clampBpm = (n: number) => Math.min(300, Math.max(30, Math.round(n)));

/** Strong accent on bar downbeat; in 6/8 a secondary accent on beat 4. */
export function accentFor(timeSig: TimeSig, beat: number): "strong" | "medium" | "weak" {
  if (beat === 0) return "strong";
  if (timeSig === "6/8" && beat === 3) return "medium";
  return "weak";
}

export const DEFAULT_SETTINGS: SongSettings = {
  bpm: 120,
  timeSig: "4/4",
  subdivision: 1,
  countInBars: 1,
  countInVoice: "voice",
  clickSound: "woodblock",
  cues: [
    { id: "c1", bar: 8, text: "Virada em 1, 2, 3, 4" },
    { id: "c2", bar: 16, text: "Pratos" },
    { id: "c3", bar: 24, text: "Caixa e bumbo" },
  ],
};

export const DEFAULT_MIXER: Mixer = { master: 0.9, click: 0.8, countIn: 0.9, cues: 1, music: 0.85 };

export const uid = () => Math.random().toString(36).slice(2, 10);
