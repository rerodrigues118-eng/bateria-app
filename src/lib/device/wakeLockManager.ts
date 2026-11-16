/**
 * Utilitário de Gerenciamento da Screen Wake Lock API
 * 
 * Evita que a tela do celular ou tablet apague ou entre em repouso
 * durante o ensaio ou apresentação ao vivo do baterista.
 * 
 * Lida automaticamente com a perda de lock quando o usuário alterna de app
 * ou bloqueia a tela, readquirindo o lock quando o app volta a ficar visível.
 */
export class WakeLockManager {
  private wakeLockSentinel: WakeLockSentinel | null = null;
  private isActiveRequested = false;
  private onVisibilityChangeBound: () => void;

  public onStatusChange?: (isLocked: boolean) => void;

  constructor() {
    this.onVisibilityChangeBound = this.handleVisibilityChange.bind(this);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.onVisibilityChangeBound);
    }
  }

  public isSupported(): boolean {
    return typeof navigator !== "undefined" && "wakeLock" in navigator;
  }

  public isLocked(): boolean {
    return this.wakeLockSentinel !== null && !this.wakeLockSentinel.released;
  }

  /**
   * Solicita a trava de tela (Screen Wake Lock)
   */
  public async requestLock(): Promise<boolean> {
    this.isActiveRequested = true;

    if (!this.isSupported()) {
      return false;
    }

    try {
      if (this.wakeLockSentinel && !this.wakeLockSentinel.released) {
        return true;
      }

      this.wakeLockSentinel = await navigator.wakeLock.request("screen");
      this.wakeLockSentinel.addEventListener("release", () => {
        this.onStatusChange?.(false);
      });

      this.onStatusChange?.(true);
      return true;
    } catch (err) {
      console.warn("Falha ao adquirir Screen Wake Lock:", err);
      this.onStatusChange?.(false);
      return false;
    }
  }

  /**
   * Libera a trava de tela permitindo que o dispositivo economize energia
   */
  public async releaseLock(): Promise<void> {
    this.isActiveRequested = false;

    if (this.wakeLockSentinel) {
      try {
        await this.wakeLockSentinel.release();
      } catch (err) {
        console.warn("Erro ao liberar Screen Wake Lock:", err);
      } finally {
        this.wakeLockSentinel = null;
        this.onStatusChange?.(false);
      }
    }
  }

  /**
   * Readquire automaticamente a trava quando o navegador volta a ter foco
   */
  private handleVisibilityChange(): void {
    if (this.isActiveRequested && document.visibilityState === "visible") {
      this.requestLock();
    }
  }

  public destroy(): void {
    this.releaseLock();
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.onVisibilityChangeBound);
    }
  }
}

export const wakeLockManager = new WakeLockManager();
