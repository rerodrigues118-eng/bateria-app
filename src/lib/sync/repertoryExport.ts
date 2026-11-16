import type { Setlist, Song } from "../types/metronome";

export interface RepertoryData {
  version: string;
  exportDate: string;
  songs: Song[];
  setlists: Setlist[];
}

/**
 * Exporta todas as músicas e setlists salvos em um arquivo JSON para backup ou compartilhamento
 */
export function exportRepertory(songs: Song[], setlists: Setlist[] = []): void {
  const data: RepertoryData = {
    version: "1.0.0",
    exportDate: new Date().toISOString(),
    songs,
    setlists,
  };

  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  link.download = `repertorio-bateria-${dateStr}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Lê e valida o arquivo JSON importado pelo usuário
 */
export function importRepertory(file: File): Promise<RepertoryData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const json = JSON.parse(text) as Partial<RepertoryData>;

        if (!json.songs || !Array.isArray(json.songs)) {
          throw new Error("Formato de arquivo inválido: lista de músicas ausente.");
        }

        const validData: RepertoryData = {
          version: json.version || "1.0.0",
          exportDate: json.exportDate || new Date().toISOString(),
          songs: json.songs,
          setlists: Array.isArray(json.setlists) ? json.setlists : [],
        };

        resolve(validData);
      } catch (error) {
        reject(error instanceof Error ? error : new Error("Erro ao ler arquivo JSON."));
      }
    };

    reader.onerror = () => reject(new Error("Falha na leitura do arquivo."));
    reader.readAsText(file);
  });
}
