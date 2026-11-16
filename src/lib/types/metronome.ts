import { z } from "zod";

/**
 * Fórmulas de compasso e divisões rítmicas suportadas
 */
export type TimeSignatureBeats = 2 | 3 | 4 | 5 | 6 | 7 | 12;
export type TimeSignatureValue = 4 | 8;
export type SubdivisionType = 1 | 2 | 3 | 4; // 1 = semínima, 2 = colcheia, 3 = tercina, 4 = semicolcheia

/**
 * Tipos de avisos de voz suportados pela engine
 */
export type CueType =
  | "count"
  | "fill_1234"
  | "cymbals"
  | "snare_kick"
  | "intro"
  | "solo"
  | "custom";

/**
 * Interface principal para a Música (Song)
 */
export interface Song {
  id: string;
  title: string;
  bpm: number;
  timeSignatureBeats: TimeSignatureBeats;
  timeSignatureValue: TimeSignatureValue;
  subdivision: SubdivisionType;
  countInBeats: number;
  notes?: string;
  updatedAt: string; // ISO 8601
}

/**
 * Interface para os comandos e avisos de voz na timeline (VoiceCue)
 */
export interface VoiceCue {
  id: string;
  songId: string;
  measureNumber: number; // Compasso alvo onde a virada/evento acontece
  cueType: CueType;
  customText?: string;
  leadTimeBars: number; // Quantos compassos antes o aviso é falado (padrão: 1)
  audioKey?: string; // ID ou chave do AudioBuffer pré-carregado
}

/**
 * Interface para o Setlist (Agrupamento de músicas para o show)
 */
export interface Setlist {
  id: string;
  name: string;
  songIds: string[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/**
 * Interface para a faixa de áudio de fundo (Backing Track) importada
 */
export interface AudioTrackRecord {
  songId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  blob: Blob;
  updatedAt: string;
}

/**
 * Configuração de volumes da mesa/mixer da engine
 */
export interface MixerGains {
  master: number; // 0.0 a 1.0
  click: number;  // 0.0 a 1.0
  count: number;  // 0.0 a 1.0
  cues: number;   // 0.0 a 1.0
  music: number;  // 0.0 a 1.0 (Backing Track de fundo)
}

/**
 * Informação de telemetria emitida a cada pulso da engine
 */
export interface MetronomeTickInfo {
  time: number;
  beat: number; // 0-indexed dentro do compasso
  subdivision: number; // 0-indexed dentro do tempo
  measure: number; // Compasso atual (negativo durante o count-in, 1-based na música)
  isCountIn: boolean;
  isDownbeat: boolean; // Primeiro tempo do compasso
  bpm: number;
  activeCue?: VoiceCue;
}

// -------------------------------------------------------------
// Validações com ZOD para garantir integridade em runtime
// -------------------------------------------------------------

export const SongSchema = z.object({
  id: z.string().uuid().or(z.string().min(1)),
  title: z.string().min(1, "O título da música é obrigatório"),
  bpm: z.number().int().min(30).max(320),
  timeSignatureBeats: z.union([
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
    z.literal(7),
    z.literal(12),
  ]),
  timeSignatureValue: z.union([z.literal(4), z.literal(8)]),
  subdivision: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  countInBeats: z.number().int().min(0).max(16),
  notes: z.string().optional(),
  updatedAt: z.string().datetime().or(z.string().min(1)),
});

export const VoiceCueSchema = z.object({
  id: z.string().uuid().or(z.string().min(1)),
  songId: z.string().min(1),
  measureNumber: z.number().int().min(1),
  cueType: z.enum([
    "count",
    "fill_1234",
    "cymbals",
    "snare_kick",
    "intro",
    "solo",
    "custom",
  ]),
  customText: z.string().optional(),
  leadTimeBars: z.number().int().min(0).max(4).default(1),
  audioKey: z.string().optional(),
});

export const SetlistSchema = z.object({
  id: z.string().uuid().or(z.string().min(1)),
  name: z.string().min(1, "Nome do setlist obrigatório"),
  songIds: z.array(z.string()),
  createdAt: z.string().datetime().or(z.string().min(1)),
  updatedAt: z.string().datetime().or(z.string().min(1)),
});
