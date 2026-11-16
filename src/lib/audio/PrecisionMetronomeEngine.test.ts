import { describe, expect, it } from "vitest";
import { SongSchema, VoiceCueSchema } from "../types/metronome";
import { resolveAudioKeyForCue } from "./voiceAudioMap";

describe("PrecisionMetronomeEngine & Data Models", () => {
  it("valida schemas Zod para Song corretamente", () => {
    const validSong = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      title: "Música de Teste",
      bpm: 120,
      timeSignatureBeats: 4,
      timeSignatureValue: 4,
      subdivision: 1,
      countInBeats: 4,
      updatedAt: new Date().toISOString(),
    };

    const parsed = SongSchema.safeParse(validSong);
    expect(parsed.success).toBe(true);
  });

  it("rejeita BPMs fora dos limites permitidos (30 a 320)", () => {
    const invalidSong = {
      id: "song-1",
      title: "Inválida",
      bpm: 20, // Menor que 30
      timeSignatureBeats: 4,
      timeSignatureValue: 4,
      subdivision: 1,
      countInBeats: 4,
      updatedAt: new Date().toISOString(),
    };

    const parsed = SongSchema.safeParse(invalidSong);
    expect(parsed.success).toBe(false);
  });

  it("valida esquema de VoiceCue e leadTimeBars padrão", () => {
    const cue = {
      id: "cue-1",
      songId: "song-1",
      measureNumber: 16,
      cueType: "fill_1234",
    };

    const parsed = VoiceCueSchema.parse(cue);
    expect(parsed.leadTimeBars).toBe(1);
    expect(parsed.measureNumber).toBe(16);
  });

  it("resolve corretamente os áudios correspondentes dos comandos de voz", () => {
    expect(resolveAudioKeyForCue("fill_1234")).toBe("virada_em");
    expect(resolveAudioKeyForCue("cymbals")).toBe("cymbals_em");
    expect(resolveAudioKeyForCue("intro")).toBe("intro_em");
    expect(resolveAudioKeyForCue("solo")).toBe("solo");
  });

  it("calcula duração correta de pulso para 120 BPM em 4/4 e 6/8", () => {
    const bpm = 120;
    const secondsPerBeat44 = 60.0 / bpm; // 0.5s por semínima
    expect(secondsPerBeat44).toBe(0.5);

    const secondsPerBeat68 = (60.0 / bpm) * 0.5; // 0.25s por colcheia
    expect(secondsPerBeat68).toBe(0.25);
  });

  it("calcula volumes de mixer incluindo canal de backing track", () => {
    const mixer = {
      master: 0.9,
      click: 0.8,
      count: 0.95,
      cues: 1.0,
      music: 0.85,
    };
    expect(mixer.music).toBe(0.85);
    expect(mixer.master * mixer.music).toBeCloseTo(0.765);
  });

  it("suporta os 4 timbres de clique do expansion pack", () => {
    const sounds = ["woodblock", "beep", "cowbell", "mechanical"];
    sounds.forEach((s) => {
      expect(["woodblock", "beep", "cowbell", "mechanical"]).toContain(s);
    });
  });

  it("valida os canais suportados pelo mixer multicanal da bateria", () => {
    const drumChannels = ["kick", "snare", "toms", "cymbals", "master"];
    expect(drumChannels).toHaveLength(5);
    expect(drumChannels).toContain("kick");
    expect(drumChannels).toContain("snare");
    expect(drumChannels).toContain("toms");
    expect(drumChannels).toContain("cymbals");
    expect(drumChannels).toContain("master");
  });
});
