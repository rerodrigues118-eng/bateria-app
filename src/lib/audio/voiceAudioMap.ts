/**
 * Mapeamento dos arquivos de áudio externos gravados por IA
 * localizados no diretório public/audio/falas/
 */
export const DEFAULT_VOICE_AUDIO_MAP: Record<string, string> = {
  // Contagens
  "count_1": "/audio/falas/um.mp3",
  "count_2": "/audio/falas/dois.mp3",
  "count_3": "/audio/falas/tres.mp3",
  "count_4": "/audio/falas/quatro.mp3",

  // Comandos de palco & Estruturas
  "intro_em": "/audio/falas/Intro em.mp3",
  "virada_em": "/audio/falas/virada em.mp3",
  "cymbals_em": "/audio/falas/enfeites no prato em.mp3",
  "solo": "/audio/falas/solo.mp3",
  "em": "/audio/falas/em.mp3",
};

/**
 * Resolve o identificador do áudio correspondente para cada tipo de cue
 */
export function resolveAudioKeyForCue(cueType: string): string | undefined {
  switch (cueType) {
    case "fill_1234":
      return "virada_em";
    case "cymbals":
      return "cymbals_em";
    case "intro":
      return "intro_em";
    case "solo":
      return "solo";
    default:
      return undefined;
  }
}
