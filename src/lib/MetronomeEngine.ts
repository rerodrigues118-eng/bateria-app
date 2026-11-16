/**
 * ============================================================================
 * MetronomeEngine — Engine Unificada com Backing Track e Sincronização de Vozes
 * ============================================================================
 * Baseada no relógio interno de hardware da Web Audio API (audioCtx.currentTime).
 * Suporta:
 * 1. Clique do metrônomo com acentos configuráveis
 * 2. Comandos de voz da IA com latência zero (áudio em RAM)
 * 3. Música de fundo (MP3 / WAV / MP4) sincronizada no mesmo instante de hardware
 * 4. Mixer de 4 canais independentes (Master, Clique, Voz e Música)
 */

export type CueMapping = {
  measure: number; // Compasso alvo (1-based, ex: Compasso 8)
  beat: number;    // Tempo dentro do compasso (0-based, ex: 0 para o tempo 1)
  cueKey: string;  // Chave do áudio pré-carregado (ex: 'virada_em', 'count_1')
};

export interface MetronomeTickEvent {
  measure: number;
  beat: number;
  time: number;
  isAccent: boolean;
  bpm: number;
  cueKey?: string | undefined;
}

export interface MetronomeVolumes {
  master: number; // 0.0 a 1.0
  click: number;  // 0.0 a 1.0
  voice: number;  // 0.0 a 1.0
  music: number;  // 0.0 a 1.0 (Backing Track de fundo)
}

export type ClickSoundType = "woodblock" | "beep" | "cowbell" | "mechanical";

export class MetronomeEngine {
  private audioCtx: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();

  // Timbre de clique selecionado
  private clickType: ClickSoundType = "woodblock";

  // Nós de Ganho (Mixer Independente)
  private masterGain: GainNode | null = null;
  private clickGain: GainNode | null = null;
  private voiceGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  // Controle de reprodução da música de fundo (Backing Track)
  private musicSourceNode: AudioBufferSourceNode | null = null;
  private musicStartTime: number = 0;
  private activeMusicKey: string | null = null;

  private isRunning: boolean = false;
  private timerID: number | null = null;

  private bpm: number = 120;
  private beatsPerMeasure: number = 4; // Ex: 4 para 4/4, 3 para 3/4, 6 para 6/8

  // Controle de tempo do relógio
  private currentBeatIndex: number = 0;
  private nextNoteTime: number = 0.0;
  private lookahead: number = 25.0;        // Frequência de checagem do scheduler (25ms)
  private scheduleAheadTime: number = 0.1; // Janela de agendamento adiantado (100ms)

  // Lista de comandos de voz da música atual
  private songCues: CueMapping[] = [];

  // Volumes da mesa de mixagem
  private volumes: MetronomeVolumes = {
    master: 0.9,
    click: 0.8,
    voice: 1.0,
    music: 0.85,
  };

  // Callbacks para sincronizar a interface do usuário (UI)
  public onTick?: (event: MetronomeTickEvent) => void;
  public onStateChange?: (playing: boolean) => void;

  constructor(initialVolumes?: Partial<MetronomeVolumes>) {
    if (initialVolumes) {
      this.volumes = { ...this.volumes, ...initialVolumes };
    }
  }

  // 1. Inicializa o AudioContext e o grafo de nós de áudio
  public initContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      this.audioCtx = new AudioCtxClass({ latencyHint: "interactive" });

      // Criação dos canais do mixer
      this.masterGain = this.audioCtx.createGain();
      this.clickGain = this.audioCtx.createGain();
      this.voiceGain = this.audioCtx.createGain();
      this.musicGain = this.audioCtx.createGain();

      // Roteamento: Click, Voice e Music conectam ao Master; Master conecta à saída
      this.clickGain.connect(this.masterGain);
      this.voiceGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      this.masterGain.connect(this.audioCtx.destination);

      this.applyVolumes();
    }

    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }

    return this.audioCtx;
  }

  // Aplica os ganhos nos nós de áudio
  private applyVolumes() {
    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime;

    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.volumes.master, now);
    }
    if (this.clickGain) {
      this.clickGain.gain.setValueAtTime(this.volumes.click, now);
    }
    if (this.voiceGain) {
      this.voiceGain.gain.setValueAtTime(this.volumes.voice, now);
    }
    if (this.musicGain) {
      this.musicGain.gain.setValueAtTime(this.volumes.music, now);
    }
  }

  public setVolumes(newVolumes: Partial<MetronomeVolumes>) {
    this.volumes = { ...this.volumes, ...newVolumes };
    this.applyVolumes();
  }

  public setMusicVolume(val: number) {
    this.setVolumes({ music: Math.max(0, Math.min(1, val)) });
  }

  // 2. Carrega qualquer arquivo de áudio (MP3, WAV ou extrai áudio de MP4)
  public async loadAudioFile(key: string, fileOrUrl: File | Blob | string): Promise<AudioBuffer> {
    const ctx = this.initContext();

    if (this.buffers.has(key) && typeof fileOrUrl === "string") {
      return this.buffers.get(key)!;
    }

    let arrayBuffer: ArrayBuffer;
    if (typeof fileOrUrl !== "string") {
      arrayBuffer = await fileOrUrl.arrayBuffer();
    } else {
      const response = await fetch(fileOrUrl);
      if (!response.ok) {
        throw new Error(`Falha HTTP ${response.status} ao carregar ${fileOrUrl}`);
      }
      arrayBuffer = await response.arrayBuffer();
    }

    // O AudioContext decodifica nativamente MP3, WAV e a faixa de áudio de arquivos MP4
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    this.buffers.set(key, audioBuffer);
    return audioBuffer;
  }

  // Atalho para carregar buffers de URL
  public async loadBuffer(key: string, url: string): Promise<void> {
    await this.loadAudioFile(key, url);
  }

  // Pré-carrega os arquivos de fala padrão do baterista
  public async preloadDefaultVoices(): Promise<void> {
    const defaultVoiceFiles: Record<string, string> = {
      count_1: "/audio/falas/um.mp3",
      count_2: "/audio/falas/dois.mp3",
      count_3: "/audio/falas/tres.mp3",
      count_4: "/audio/falas/quatro.mp3",
      fill_1234: "/audio/falas/virada em.mp3",
      intro: "/audio/falas/Intro em.mp3",
      cymbals: "/audio/falas/enfeites no prato em.mp3",
      solo: "/audio/falas/solo.mp3",
      em: "/audio/falas/em.mp3",
    };

    const loadPromises = Object.entries(defaultVoiceFiles).map(([key, url]) =>
      this.loadAudioFile(key, url).catch((err) => {
        console.warn(`Não foi possível pré-carregar [${key}]:`, err);
      }),
    );
    await Promise.all(loadPromises);
  }

  // Configura a música atual antes ou durante o Play
  public setupSong(bpm: number, beatsPerMeasure: number, cues: CueMapping[] = []) {
    this.bpm = Math.max(30, Math.min(320, bpm));
    this.beatsPerMeasure = beatsPerMeasure;
    this.songCues = cues;
  }

  // Atualiza o andamento dinamicamente
  public setBpm(newBpm: number) {
    this.bpm = Math.max(30, Math.min(320, newBpm));
  }

  // 3. Inicia o Metrônomo E a Música de Fundo simultaneamente no relógio de hardware
  public start(musicKey?: string, startMeasure = 1, musicOffsetSeconds = 0) {
    if (this.isRunning) return;
    const ctx = this.initContext();

    this.isRunning = true;
    this.activeMusicKey = musicKey || null;

    // Calcula o beat inicial com base no compasso de largada
    this.currentBeatIndex = (startMeasure - 1) * this.beatsPerMeasure;

    // Agendamos o início com uma folga de 100ms para montagem perfeita dos nós
    const startTime = ctx.currentTime + 0.1;
    this.nextNoteTime = startTime;

    // Dispara a música de fundo sincronizada no tempo exato
    if (musicKey && this.buffers.has(musicKey)) {
      this.playBackgroundMusic(musicKey, startTime, musicOffsetSeconds);
    }

    this.scheduler();
    this.onStateChange?.(true);
  }

  // Dispara a música de fundo conectada ao canal musicGain
  private playBackgroundMusic(key: string, startTime: number, offsetSeconds = 0) {
    const buffer = this.buffers.get(key);
    if (!buffer || !this.audioCtx || !this.musicGain) return;

    // Interrompe execução anterior se houver
    if (this.musicSourceNode) {
      try {
        this.musicSourceNode.stop();
        this.musicSourceNode.disconnect();
      } catch { }
    }

    this.musicSourceNode = this.audioCtx.createBufferSource();
    this.musicSourceNode.buffer = buffer;
    this.musicSourceNode.connect(this.musicGain);

    // Inicia no timestamp exato agendado no relógio de hardware
    this.musicSourceNode.start(startTime, offsetSeconds);
    this.musicStartTime = startTime;
  }

  // 4. Loop de Agendamento (Lookahead Scheduler)
  private scheduler = () => {
    if (!this.isRunning || !this.audioCtx) return;

    while (this.nextNoteTime < this.audioCtx.currentTime + this.scheduleAheadTime) {
      this.scheduleCurrentStep(this.currentBeatIndex, this.nextNoteTime);
      this.advanceNote();
    }

    this.timerID = window.setTimeout(this.scheduler, this.lookahead);
  };

  private advanceNote() {
    const secondsPerBeat = 60.0 / this.bpm;
    this.nextNoteTime += secondsPerBeat;
    this.currentBeatIndex++;
  }

  // 5. Agendamento do clique e dos avisos de voz
  private scheduleCurrentStep(beatIndex: number, time: number) {
    const currentMeasure = Math.floor(beatIndex / this.beatsPerMeasure) + 1;
    const currentBeatInMeasure = beatIndex % this.beatsPerMeasure;
    const isAccent = currentBeatInMeasure === 0;

    // --- A. Tocar o Clique Sintetizado ---
    this.playClickSound(isAccent, time);

    // --- B. Verificar se há Comando de Voz ---
    const matchingCue = this.songCues.find(
      (c) => c.measure === currentMeasure && c.beat === currentBeatInMeasure,
    );

    if (matchingCue) {
      this.playVoiceBuffer(matchingCue.cueKey, time);
    }

    // --- C. Telemetria e Animação Visual ---
    if (this.onTick && this.audioCtx) {
      const delayMs = Math.max(0, (time - this.audioCtx.currentTime) * 1000);
      window.setTimeout(() => {
        if (this.isRunning && this.onTick) {
          this.onTick({
            measure: currentMeasure,
            beat: currentBeatInMeasure,
            time,
            isAccent,
            bpm: this.bpm,
            cueKey: matchingCue?.cueKey,
          });
        }
      }, delayMs);
    }
  }

  public setClickType(type: ClickSoundType) {
    this.clickType = type;
  }

  /**
   * Transição fluida de música durante o show:
   * Para a música anterior, reseta compassos e inicia a nova imediatamente
   */
  public switchSong(
    newBpm: number,
    newBeatsPerMeasure: number,
    newCues: CueMapping[] = [],
    newMusicKey?: string,
  ) {
    const wasRunning = this.isRunning;
    this.stop();

    this.bpm = Math.max(30, Math.min(320, newBpm));
    this.beatsPerMeasure = newBeatsPerMeasure;
    this.songCues = newCues;
    this.currentBeatIndex = 0;

    if (wasRunning) {
      this.start(newMusicKey, 1);
    }
  }

  private playClickSound(isAccent: boolean, time: number) {
    if (!this.audioCtx || !this.clickGain) return;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    switch (this.clickType) {
      case "beep": {
        // Beep clássico digital sintetizado
        osc.type = "sine";
        osc.frequency.setValueAtTime(isAccent ? 1200 : 800, time);
        gain.gain.setValueAtTime(0.5, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
        osc.connect(gain);
        gain.connect(this.clickGain);
        osc.start(time);
        osc.stop(time + 0.05);
        break;
      }

      case "woodblock": {
        // Som percussivo e seco tipo bloco de madeira
        osc.type = "triangle";
        osc.frequency.setValueAtTime(isAccent ? 1800 : 1200, time);
        gain.gain.setValueAtTime(0.9, time);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);
        osc.connect(gain);
        gain.connect(this.clickGain);
        osc.start(time);
        osc.stop(time + 0.03);
        break;
      }

      case "cowbell": {
        // Timbre metálico médio (agudo cortante no fone)
        osc.type = "square";
        osc.frequency.setValueAtTime(isAccent ? 800 : 580, time);
        gain.gain.setValueAtTime(0.4, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
        osc.connect(gain);
        gain.connect(this.clickGain);
        osc.start(time);
        osc.stop(time + 0.08);
        break;
      }

      case "mechanical": {
        // Som de relógio mecânico antigo tipo Maelzel
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(isAccent ? 2400 : 1600, time);
        gain.gain.setValueAtTime(0.3, time);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.02);
        osc.connect(gain);
        gain.connect(this.clickGain);
        osc.start(time);
        osc.stop(time + 0.02);
        break;
      }
    }
  }

  private playVoiceBuffer(cueKey: string, time: number) {
    if (!this.audioCtx || !this.voiceGain) return;
    const buffer = this.buffers.get(cueKey);

    if (!buffer) {
      console.warn(`Buffer de voz não encontrado: "${cueKey}"`);
      return;
    }

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.voiceGain);
    source.start(time);
  }

  // 6. Para o Metrônomo e a Música de Fundo
  public stop() {
    this.isRunning = false;
    if (this.timerID !== null) {
      window.clearTimeout(this.timerID);
      this.timerID = null;
    }

    if (this.musicSourceNode) {
      try {
        this.musicSourceNode.stop();
        this.musicSourceNode.disconnect();
      } catch { }
      this.musicSourceNode = null;
    }

    this.onStateChange?.(false);
  }

  // Alterna entre tocar e parar
  public toggle(musicKey?: string, startMeasure = 1) {
    if (this.isRunning) {
      this.stop();
    } else {
      this.start(musicKey, startMeasure);
    }
  }

  public isMusicLoaded(key: string): boolean {
    return this.buffers.has(key);
  }

  public getMusicDuration(key: string): number {
    return this.buffers.get(key)?.duration ?? 0;
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  public getCurrentMeasure(): number {
    return Math.floor(this.currentBeatIndex / this.beatsPerMeasure) + 1;
  }

  // Libera os recursos de áudio
  public destroy() {
    this.stop();
    if (this.audioCtx && this.audioCtx.state !== "closed") {
      this.audioCtx.close();
      this.audioCtx = null;
    }
    this.buffers.clear();
  }
}
