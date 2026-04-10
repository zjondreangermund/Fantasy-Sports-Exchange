import { useCallback } from "react";

type SoundKind = "click" | "reveal";

function playToneSequence(kind: SoundKind) {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return;

  const ctx = new AudioContextClass();
  const now = ctx.currentTime;

  const sequence: Array<{ freq: number; start: number; duration: number; gain: number }> =
    kind === "reveal"
      ? [
          { freq: 440, start: 0, duration: 0.08, gain: 0.02 },
          { freq: 660, start: 0.08, duration: 0.1, gain: 0.025 },
          { freq: 880, start: 0.18, duration: 0.12, gain: 0.03 },
        ]
      : [
          { freq: 520, start: 0, duration: 0.05, gain: 0.015 },
          { freq: 780, start: 0.04, duration: 0.06, gain: 0.018 },
        ];

  sequence.forEach((tone) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = kind === "reveal" ? "triangle" : "sine";
    osc.frequency.setValueAtTime(tone.freq, now + tone.start);

    gain.gain.setValueAtTime(0.0001, now + tone.start);
    gain.gain.exponentialRampToValueAtTime(tone.gain, now + tone.start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.start + tone.duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + tone.start);
    osc.stop(now + tone.start + tone.duration + 0.01);
  });

  setTimeout(() => {
    ctx.close().catch(() => undefined);
  }, 450);
}

export function useUiSound() {
  const play = useCallback((kind: SoundKind) => {
    try {
      playToneSequence(kind);
    } catch {
      // Sound is best-effort only.
    }
  }, []);

  return {
    play,
  };
}
