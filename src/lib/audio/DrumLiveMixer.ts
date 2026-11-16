/**
 * ============================================================================
 * DrumLiveMixer — Mixer Multicanal ao Vivo para Bateristas
 * ============================================================================
 * Captura o microfone da sala ou a interface de áudio USB conectada ao computador/celular.
 * 
 * Separa a entrada por faixas de frequência (Kick, Snare, Toms, Cymbals)
 * e fornece canais de ganho independentes (0% a 200%) com analisadores de espectro
 * para VU meters em tempo real com latência zero.
 */

export type DrumChannelId = "master" | "kick" | "snare" | "toms" | "cymbals";

export interface DrumChannelConfig {
  id: DrumChannelId;
  label: string;
  volume: number; // 0.0 a 2.0 (padrão 1.0)
  muted: boolean;
  color: string;
}

export class DrumLiveMixer {
  private audioCtx: AudioContext;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;

  // Roteamento e filtros por elemento da bateria
  private channelGains: Map<DrumChannelId, GainNode> = new Map();
  private channelAnalysers: Map<DrumChannelId, AnalyserNode> = new Map();
  private channelFilters: Map<DrumChannelId, BiquadFilterNode> = new Map();

  // Nós mestres
  private masterMicGain: GainNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;

  private isConnected = false;
  private isListeningToSpeakers = false; // Se deve enviar o microfone para o fone do baterista (Direct Monitor)

  constructor(audioCtx?: AudioContext) {
    if (audioCtx) {
      this.audioCtx = audioCtx;
    } else {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass({ latencyHint: "interactive" });
    }
  }

  public getAudioContext(): AudioContext {
    return this.audioCtx;
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  public getIsDirectMonitor(): boolean {
    return this.isListeningToSpeakers;
  }

  /**
   * Conecta a interface de áudio ou microfone do dispositivo
   */
  public async initializeMicrophone(enableDirectMonitor = false): Promise<boolean> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      console.warn("getUserMedia não é suportado neste navegador.");
      return false;
    }

    try {
      if (this.audioCtx.state === "suspended") {
        await this.audioCtx.resume();
      }

      // Parâmetros para áudio profissional: desliga processamentos de voz que distorcem bateria
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      this.micSource = this.audioCtx.createMediaStreamSource(this.micStream);

      // 1. Canal Mestre do Microfone
      this.masterMicGain = this.audioCtx.createGain();
      this.masterMicGain.gain.setValueAtTime(1.0, this.audioCtx.currentTime);

      this.masterAnalyser = this.audioCtx.createAnalyser();
      this.masterAnalyser.fftSize = 64;
      this.masterAnalyser.smoothingTimeConstant = 0.6;

      this.micSource.connect(this.masterMicGain);
      this.masterMicGain.connect(this.masterAnalyser);

      // 2. Configura os 4 canais virtuais de frequência da bateria
      this.setupChannel("kick", "lowpass", 130, 1.2);       // Bumbo (Sub-graves e corpo)
      this.setupChannel("snare", "bandpass", 650, 1.0);     // Caixa (Médios-graves e estalo)
      this.setupChannel("toms", "bandpass", 320, 1.5);      // Tons e Surdo (Ressonância)
      this.setupChannel("cymbals", "highpass", 3500, 0.7);  // Pratos e Chimbal (Agudos / Overheads)

      // Se o baterista quiser monitoramento direto no fone
      this.setDirectMonitor(enableDirectMonitor);

      this.isConnected = true;
      return true;
    } catch (error) {
      console.error("Erro ao conectar microfone da bateria:", error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Cria um canal com filtro de frequência, controle de ganho e analisador de VU
   */
  private setupChannel(
    channelId: DrumChannelId,
    filterType: BiquadFilterType,
    freq: number,
    q: number,
  ) {
    if (!this.micSource || !this.masterMicGain) return;

    // Filtro divisor de frequência acústica
    const filter = this.audioCtx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
    filter.Q.setValueAtTime(q, this.audioCtx.currentTime);

    // Ganho do canal
    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(1.0, this.audioCtx.currentTime);

    // Analisador para VU Meter
    const analyser = this.audioCtx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.7;

    // Conexão: MicSource -> Filter -> Gain -> Analyser -> MasterMicGain
    this.micSource.connect(filter);
    filter.connect(gain);
    gain.connect(analyser);

    this.channelFilters.set(channelId, filter);
    this.channelGains.set(channelId, gain);
    this.channelAnalysers.set(channelId, analyser);
  }

  /**
   * Ativa ou desativa a saída do microfone para o fone do baterista (Direct Monitor)
   */
  public setDirectMonitor(enabled: boolean) {
    this.isListeningToSpeakers = enabled;
    if (!this.masterMicGain) return;

    try {
      this.masterMicGain.disconnect(this.audioCtx.destination);
    } catch {}

    if (enabled) {
      this.masterMicGain.connect(this.audioCtx.destination);
    }
  }

  /**
   * Altera o volume de um canal específico (0.0 a 2.0 = 0% a 200%)
   */
  public setChannelVolume(channel: DrumChannelId, volume: number) {
    const clamped = Math.max(0, Math.min(2.0, volume));
    const now = this.audioCtx.currentTime;

    if (channel === "master" && this.masterMicGain) {
      this.masterMicGain.gain.setValueAtTime(clamped, now);
      return;
    }

    const gainNode = this.channelGains.get(channel);
    if (gainNode) {
      gainNode.gain.setValueAtTime(clamped, now);
    }
  }

  /**
   * Muta ou desmuta um canal individual
   */
  public setChannelMute(channel: DrumChannelId, muted: boolean, currentVolume = 1.0) {
    this.setChannelVolume(channel, muted ? 0.0 : currentVolume);
  }

  /**
   * Retorna o nível de pico instantâneo (0.0 a 1.0) para alimentar o VU Meter gráfico
   */
  public getLevel(channel: DrumChannelId): number {
    const analyser =
      channel === "master" ? this.masterAnalyser : this.channelAnalysers.get(channel);
    if (!analyser) return 0;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(dataArray);

    // Calcula valor RMS (Root Mean Square) do sinal
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i]! - 128) / 128;
      sum += normalized * normalized;
    }

    const rms = Math.sqrt(sum / dataArray.length);
    // Escalamento dinâmico para resposta visual de VU meter musical
    return Math.min(1.0, rms * 3.2);
  }

  /**
   * Desconecta o microfone e encerra as faixas
   */
  public stop() {
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }

    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch {}
      this.micSource = null;
    }

    this.isConnected = false;
  }
}
