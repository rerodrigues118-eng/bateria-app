/**
 * Gerenciador de Desbloqueio de Áudio no iOS Safari & Dispositivos Móveis
 * 
 * O Safari no iOS e outros navegadores móveis restringem a inicialização
 * de áudio (AudioContext) até que o usuário execute um gesto explícito
 * (click, touchstart, touchend).
 * 
 * Esta classe ouve o primeiro toque do usuário na tela, dispara um micro
 * buffer de silêncio e força a transição do AudioContext de "suspended"
 * para "running", garantindo que quando o botão de Play for acionado
 * (ou contagem prévia começar), o som saia com latência zero.
 */
export class IOSAudioUnlocker {
  private isUnlocked = false;
  private unlockCallbacks: Array<() => void> = [];

  constructor() {
    this.setupListeners();
  }

  private setupListeners(): void {
    if (typeof window === "undefined") return;

    const events = ["touchstart", "touchend", "click", "keydown"];
    const handleFirstInteraction = () => {
      this.isUnlocked = true;
      this.unlockCallbacks.forEach((cb) => cb());
      this.unlockCallbacks = [];

      events.forEach((evt) => {
        window.removeEventListener(evt, handleFirstInteraction, true);
      });
    };

    events.forEach((evt) => {
      window.addEventListener(evt, handleFirstInteraction, {
        capture: true,
        passive: true,
      });
    });
  }

  /**
   * Força o desbloqueio ativo de uma instância específica de AudioContext
   */
  public async unlockAudioContext(ctx: AudioContext): Promise<boolean> {
    if (ctx.state === "running") {
      return true;
    }

    try {
      // Cria um buffer de silêncio de 1 amostra
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);

      // Resume o contexto
      await ctx.resume();
      return ctx.state === "running";
    } catch (err) {
      console.warn("Aviso: Falha ao desbloquear AudioContext no iOS:", err);
      return false;
    }
  }

  /**
   * Executa uma função assim que o primeiro gesto do usuário for detectado
   */
  public onUnlocked(callback: () => void): void {
    if (this.isUnlocked) {
      callback();
    } else {
      this.unlockCallbacks.push(callback);
    }
  }
}

export const iosAudioUnlocker = new IOSAudioUnlocker();

/**
 * Gerenciador de Atalhos de Teclado de Palco (Para pedais Bluetooth / Teclados)
 * 
 * Permite que bateristas usem pedais tipo Page Turner ou teclado numérico:
 * - Barra de Espaço: Play / Pause
 * - Seta Cima / Direita: +1 BPM ou +5 BPM
 * - Seta Baixo / Esquerda: -1 BPM ou -5 BPM
 * - Tecla N: Próxima música
 */
export interface DrummerShortcuts {
  onTogglePlay: () => void;
  onBpmChange: (delta: number) => void;
  onNextSong?: () => void;
  onTapTempo?: () => void;
}

export function registerDrummerKeyShortcuts(shortcuts: DrummerShortcuts): () => void {
  if (typeof window === "undefined") return () => {};

  const handleKeyDown = (e: KeyboardEvent) => {
    // Ignora atalhos se o foco estiver em um input de texto
    const target = e.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    ) {
      return;
    }

    switch (e.code) {
      case "Space":
        e.preventDefault();
        shortcuts.onTogglePlay();
        break;
      case "ArrowUp":
        e.preventDefault();
        shortcuts.onBpmChange(e.shiftKey ? 5 : 1);
        break;
      case "ArrowDown":
        e.preventDefault();
        shortcuts.onBpmChange(e.shiftKey ? -5 : -1);
        break;
      case "ArrowRight":
        e.preventDefault();
        shortcuts.onBpmChange(1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        shortcuts.onBpmChange(-1);
        break;
      case "KeyN":
        shortcuts.onNextSong?.();
        break;
      case "KeyT":
        shortcuts.onTapTempo?.();
        break;
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}
