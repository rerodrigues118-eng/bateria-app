import type {
  MixerGains,
  MetronomeTickInfo,
  Song,
  VoiceCue,
} from "../types/metronome";
import { DEFAULT_VOICE_AUDIO_MAP, resolveAudioKeyForCue } from "./voiceAudioMap";

/**
 * ============================================================================
 * PrecisionMetronomeEngine
 * ============================================================================
 * Engine de alta precisão temporal para metrônomo profissional de bateristas.
 * 
 * Implementa o algoritmo de "Lookahead Scheduler" para Web Audio API:
 * - O timer do JavaScript (setInterval) roda a cada 25ms apenas como coordenador.
 * - Todos os disparos de som são agendados diretamente no relógio de hardware
 *   do AudioContext (audioContext.currentTime) com 100ms (0.1s) de antecedência.
 * - Isso elimina 100% do jitter de áudio causado por reflows do DOM, garbage
 *   collection ou travamentos de thread em dispositivos móveis.
 */
export class PrecisionMetronomeEngine {
  private audioContext: AudioContext | null = null;

  // Nós de Ganho (Mesa de Mixagem)
  private masterGain: GainNode | null = null;
  private clickGain: GainNode | null = null;
  private countGain: GainNode | null = null;
  private cueGain: GainNode | null = null;

  // Parâmetros do Scheduler
  private readonly lookaheadIntervalMs = 25; // Frequência do loop de checagem
  private readonly scheduleAheadTimeSec = 0.1; // Janela de agendamento futuro no relógio de áudio
  private timerId: number | null = null;

  // Estado do Metrônomo
  private isPlaying = false;
  private currentSong: Song | null = null;
  private currentCues: VoiceCue[] = [];

  // Posição no tempo
  private nextNoteTime = 0.0; // Ponto exato em segundos no áudio clock para o próximo pulso
  private currentBeat = 0; // 0-indexed (0 a timeSignatureBeats - 1)
  private currentSubdivision = 0; // 0-indexed (0 a subdivision - 1)
  private currentMeasure = 1; // 1-based para a música
  private countInRemainingBeats = 0; // Quantidade de tempos restantes na contagem prévia

  // Cache de Amostras de Áudio Pré-carregadas (IA Voices)
  private audioBufferCache: Map<string, AudioBuffer> = new Map();

  // Callbacks de Comunicação com a UI
  public onTick?: (info: MetronomeTickInfo) => void;
  public onStateChange?: (playing: boolean) => void;
  public onError?: (error: Error) => void;

  constructor(initialGains?: Partial<MixerGains>) {
    // Inicialização sob demanda do AudioContext para conformidade com navegadores
    this.initialGains = {
      master: initialGains?.master ?? 0.9,
      click: initialGains?.click ?? 0.85,
      count: initialGains?.count ?? 0.95,
      cues: initialGains?.cues ?? 1.0,
    };
  }

  private initialGains: MixerGains;

  /**
   * Garante a criação e inicialização dos nós da Web Audio API
   */
  public async ensureAudioContext(): Promise<AudioContext> {
    if (!this.audioContext) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      this.audioContext = new AudioContextClass({
        latencyHint: "interactive",
      });

      // Criação dos canais de áudio da mesa de som
      this.masterGain = this.audioContext.createGain();
      this.clickGain = this.audioContext.createGain();
      this.countGain = this.audioContext.createGain();
      this.cueGain = this.audioContext.createGain();

      // Roteamento: canais individuais -> master -> saída de áudio
      this.clickGain.connect(this.masterGain);
      this.countGain.connect(this.masterGain);
      this.cueGain.connect(this.masterGain);
      this.masterGain.connect(this.audioContext.destination);

      // Aplica os volumes iniciais
      this.applyGains(this.initialGains);
    }

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    return this.audioContext;
  }

  /**
   * Atualiza os volumes dos 4 canais de áudio
   */
  public applyGains(gains: Partial<MixerGains>): void {
    if (!this.audioContext) {
      this.initialGains = { ...this.initialGains, ...gains };
      return;
    }

    const now = this.audioContext.currentTime;
    if (gains.master !== undefined && this.masterGain) {
      this.masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, gains.master)), now);
    }
    if (gains.click !== undefined && this.clickGain) {
      this.clickGain.gain.setValueAtTime(Math.max(0, Math.min(1, gains.click)), now);
    }
    if (gains.count !== undefined && this.countGain) {
      this.countGain.gain.setValueAtTime(Math.max(0, Math.min(1, gains.count)), now);
    }
    if (gains.cues !== undefined && this.cueGain) {
      this.cueGain.gain.setValueAtTime(Math.max(0, Math.min(1, gains.cues)), now);
    }
  }

  public setMasterVolume(val: number): void {
    this.applyGains({ master: val });
  }

  public setClickVolume(val: number): void {
    this.applyGains({ click: val });
  }

  public setCountVolume(val: number): void {
    this.applyGains({ count: val });
  }

  public setCueVolume(val: number): void {
    this.applyGains({ cues: val });
  }

  /**
   * Carrega e decodifica um arquivo de áudio (.mp3 / .wav) na memória RAM
   */
  public async loadAudioBuffer(key: string, url: string): Promise<AudioBuffer> {
    const ctx = await this.ensureAudioContext();

    if (this.audioBufferCache.has(key)) {
      return this.audioBufferCache.get(key)!;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Falha ao carregar áudio (${response.status}): ${url}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
      this.audioBufferCache.set(key, decodedBuffer);
      return decodedBuffer;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.onError?.(error);
      throw error;
    }
  }

  /**
   * Pré-carrega um dicionário completo de amostras (ex: contagens e avisos IA)
   */
  public async preloadAudioMap(map: Record<string, string> = DEFAULT_VOICE_AUDIO_MAP): Promise<void> {
    const promises = Object.entries(map).map(([key, url]) =>
      this.loadAudioBuffer(key, url).catch((err) => {
        console.warn(`Aviso: Áudio "${key}" não pôde ser carregado de ${url}:`, err);
      }),
    );
    await Promise.all(promises);
  }

  /**
   * Toca uma amostra de áudio pré-carregada no tempo exato estipulado pelo relógio
   */
  public playAudioBuffer(
    bufferKey: string,
    scheduledTime: number,
    channel: "cue" | "count" | "click" = "cue",
  ): AudioBufferSourceNode | null {
    if (!this.audioContext) return null;
    const buffer = this.audioBufferCache.get(bufferKey);
    if (!buffer) return null;

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    // Conecta ao canal correto
    const destinationNode =
      channel === "click"
        ? this.clickGain
        : channel === "count"
        ? this.countGain
        : this.cueGain;

    if (destinationNode) {
      source.connect(destinationNode);
      source.start(scheduledTime);
    }

    return source;
  }

  /**
   * Síntese procedural do som de clique (Madeira / Agudo digital / Percussivo)
   * 
   * Frequências calibradas para audição perfeita do baterista sob fones:
   * - Downbeat (Tempo 1): 1760 Hz (Lá 6) acentuado
   * - Tempo Composto Secundário: 1320 Hz (Ex: tempo 4 em 6/8)
   * - Tempos Normais (2, 3, 4): 1000 Hz
   * - Subdivisões: 750 Hz
   */
  private playSynthesizedClick(
    time: number,
    isDownbeat: boolean,
    isSecondaryAccent: boolean,
    isSubdivision: boolean,
  ): void {
    if (!this.audioContext || !this.clickGain) return;

    const osc = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    // Definição da frequência
    let freq = 1000;
    let volumeMultiplier = 0.7;

    if (isSubdivision) {
      freq = 750;
      volumeMultiplier = 0.35;
    } else if (isDownbeat) {
      freq = 1760;
      volumeMultiplier = 1.0;
    } else if (isSecondaryAccent) {
      freq = 1320;
      volumeMultiplier = 0.85;
    }

    osc.type = isDownbeat ? "square" : "triangle";
    osc.frequency.setValueAtTime(freq, time);

    // Envelope percussivo ultra rápido: ataque imediato e decaimento exponencial
    gainNode.gain.setValueAtTime(0.0001, time);
    gainNode.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, volumeMultiplier * 0.9),
      time + 0.0015,
    );
    gainNode.gain.exponentialRampToValueAtTime(
      0.0001,
      time + (isDownbeat ? 0.045 : 0.03),
    );

    osc.connect(gainNode);
    gainNode.connect(this.clickGain);

    osc.start(time);
    osc.stop(time + 0.05);
  }

  /**
   * Disparo de voz sintetizada (fallback caso não haja áudio pré-gravado)
   */
  private speakFallback(text: string, scheduledTime: number, volume = 0.9): void {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const ctx = this.audioContext;
    if (!ctx) return;

    const delayMs = Math.max(0, (scheduledTime - ctx.currentTime) * 1000);
    window.setTimeout(() => {
      if (!this.isPlaying) return;
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "pt-BR";
        utterance.rate = 1.3;
        utterance.volume = volume;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn("SpeechSynthesis error:", e);
      }
    }, delayMs);
  }

  /**
   * ==========================================================================
   * LOOKAHEAD SCHEDULER LOOP
   * ==========================================================================
   * Este método roda em background a cada 25ms. Ele olha para o futuro até
   * `currentTime + 0.1` segundos e enfileira todas as notas e vozes que caem
   * dentro dessa janela.
   */
  private scheduler(): void {
    if (!this.audioContext || !this.currentSong || !this.isPlaying) return;

    while (
      this.nextNoteTime <
      this.audioContext.currentTime + this.scheduleAheadTimeSec
    ) {
      this.scheduleCurrentPulse();
      this.advanceToNextPulse();
    }
  }

  /**
   * Agenda o evento atual (clique, voz, contagem, emissão para a UI)
   */
  private scheduleCurrentPulse(): void {
    if (!this.audioContext || !this.currentSong) return;

    const song = this.currentSong;
    const time = this.nextNoteTime;
    const isCountIn = this.countInRemainingBeats > 0;
    const isSubdivision = this.currentSubdivision !== 0;
    const isDownbeat = this.currentBeat === 0 && !isSubdivision;
    const is68Secondary =
      song.timeSignatureBeats === 6 && this.currentBeat === 3 && !isSubdivision;

    // 1. ÁUDIO: Contagem Prévia (Count-In)
    if (isCountIn) {
      if (!isSubdivision) {
        // Toca clique de contagem tipo cross-stick
        this.playSynthesizedClick(time, isDownbeat, false, false);

        // Dispara a voz do número da contagem se disponível em buffer ou fallback
        const beatNumber = this.currentBeat + 1;
        const countKey = `count_${beatNumber}`;

        if (this.audioBufferCache.has(countKey)) {
          this.playAudioBuffer(countKey, time, "count");
        } else {
          this.speakFallback(String(beatNumber), time, 0.95);
        }
      }
    } else {
      // 2. ÁUDIO: Metrônomo Normal da Música
      this.playSynthesizedClick(time, isDownbeat, is68Secondary, isSubdivision);

      // 3. AVISOS DE VOZ NA TIMELINE (Voice Cues)
      // Agendados no primeiro tempo (downbeat) do compasso correspondente
      if (isDownbeat) {
        this.processVoiceCuesForMeasure(this.currentMeasure, time);
      }
    }

    // 4. DISPARO DE SINCRONIZAÇÃO PARA A UI (PISCAR TELA, LEDS, DISPLAY)
    const tickSnapshot: MetronomeTickInfo = {
      time,
      beat: this.currentBeat,
      subdivision: this.currentSubdivision,
      measure: isCountIn ? -Math.ceil(this.countInRemainingBeats / song.timeSignatureBeats) : this.currentMeasure,
      isCountIn,
      isDownbeat,
      bpm: song.bpm,
    };

    if (this.onTick) {
      const delayMs = Math.max(0, (time - this.audioContext.currentTime) * 1000);
      window.setTimeout(() => {
        if (this.isPlaying && this.onTick) {
          this.onTick(tickSnapshot);
        }
      }, delayMs);
    }
  }

  /**
   * Avalia e agenda avisos de voz configurados para o compasso
   * 
   * Suporta Lead Time: Se leadTimeBars = 1, o aviso de virada programado
   * para o compasso 8 será falado exatamente na cabeça do compasso 7!
   */
  private processVoiceCuesForMeasure(measure: number, scheduledTime: number): void {
    if (!this.currentCues.length) return;

    for (const cue of this.currentCues) {
      const leadTime = cue.leadTimeBars ?? 1;
      const targetTriggerMeasure = cue.measureNumber - leadTime;

      if (measure === targetTriggerMeasure) {
        // Resolve a chave do arquivo de voz
        const audioKey = cue.audioKey || resolveAudioKeyForCue(cue.cueType);

        if (audioKey && this.audioBufferCache.has(audioKey)) {
          this.playAudioBuffer(audioKey, scheduledTime, "cue");
        } else if (cue.customText) {
          this.speakFallback(cue.customText, scheduledTime, 1.0);
        } else {
          // Fallback textual para tipos de comandos padrão
          const fallbackMap: Record<string, string> = {
            fill_1234: "Virada em 1, 2, 3, 4",
            cymbals: "Enfeites no prato",
            snare_kick: "Caixa e bumbo",
            intro: "Introdução",
            solo: "Solo",
          };
          const msg = fallbackMap[cue.cueType] ?? cue.cueType;
          this.speakFallback(msg, scheduledTime, 1.0);
        }
      }
    }
  }

  /**
   * Avança os ponteiros de tempo da engine matemática
   */
  private advanceToNextPulse(): void {
    if (!this.currentSong) return;

    const song = this.currentSong;
    // Cálculo do tempo em segundos para cada pulso
    // Para compassos compostos como 6/8 (onde a colcheia é a unidade de tempo básica):
    const timeMultiplier = song.timeSignatureValue === 8 ? 0.5 : 1.0;
    const secondsPerBeat = (60.0 / song.bpm) * timeMultiplier;
    const secondsPerPulse = secondsPerBeat / (this.countInRemainingBeats > 0 ? 1 : song.subdivision);

    this.nextNoteTime += secondsPerPulse;

    if (this.countInRemainingBeats > 0) {
      // Avança contagem prévia
      this.currentSubdivision = 0;
      this.currentBeat += 1;
      this.countInRemainingBeats -= 1;

      if (this.currentBeat >= song.timeSignatureBeats) {
        this.currentBeat = 0;
      }

      if (this.countInRemainingBeats === 0) {
        // Fim da contagem prévia: entra na música
        this.currentMeasure = 1;
        this.currentBeat = 0;
        this.currentSubdivision = 0;
      }
    } else {
      // Avanço na música normal
      this.currentSubdivision += 1;
      if (this.currentSubdivision >= song.subdivision) {
        this.currentSubdivision = 0;
        this.currentBeat += 1;

        if (this.currentBeat >= song.timeSignatureBeats) {
          this.currentBeat = 0;
          this.currentMeasure += 1;
        }
      }
    }
  }

  /**
   * ==========================================================================
   * MÉTODOS PÚBLICOS DE CONTROLE
   * ==========================================================================
   */

  /**
   * Inicia o metrônomo para a música e lista de comandos fornecidos
   */
  public async start(song: Song, cues: VoiceCue[] = [], startMeasure = 1): Promise<void> {
    const ctx = await this.ensureAudioContext();

    this.currentSong = { ...song };
    this.currentCues = [...cues];
    this.isPlaying = true;

    // Configura tempos de contagem inicial
    const countInBeats = song.countInBeats ?? 0;
    this.countInRemainingBeats = countInBeats;

    this.currentMeasure = startMeasure;
    this.currentBeat = 0;
    this.currentSubdivision = 0;

    // Inicia o primeiro pulso logo à frente no tempo de hardware (80ms à frente)
    this.nextNoteTime = ctx.currentTime + 0.08;

    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
    }
    this.timerId = window.setInterval(() => this.scheduler(), this.lookaheadIntervalMs);

    this.onStateChange?.(true);
  }

  /**
   * Para a reprodução imediatamente e limpa timers e falas
   */
  public stop(): void {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    this.isPlaying = false;
    this.currentBeat = 0;
    this.currentSubdivision = 0;
    this.countInRemainingBeats = 0;

    this.onStateChange?.(false);
  }

  /**
   * Alterna entre tocar e parar
   */
  public toggle(song: Song, cues: VoiceCue[] = []): void {
    if (this.isPlaying) {
      this.stop();
    } else {
      this.start(song, cues);
    }
  }

  /**
   * Atualiza a música em tempo de execução sem interromper o clique
   */
  public updateSong(newSong: Song, newCues?: VoiceCue[]): void {
    this.currentSong = { ...newSong };
    if (newCues) {
      this.currentCues = [...newCues];
    }
  }

  /**
   * Retorna o estado atual
   */
  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getCurrentMeasure(): number {
    return this.currentMeasure;
  }

  /**
   * Destrói a engine e fecha o AudioContext para liberação de memória
   */
  public destroy(): void {
    this.stop();
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.audioBufferCache.clear();
  }
}
