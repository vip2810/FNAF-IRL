let ctx: AudioContext | null = null;

function audioCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, durationMs: number, type: OscillatorType = 'square', gainValue = 0.08, delayMs = 0): void {
  const ac = audioCtx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = gainValue;
  osc.connect(gain).connect(ac.destination);
  const start = ac.currentTime + delayMs / 1000;
  osc.start(start);
  gain.gain.setTargetAtTime(0, start + durationMs / 1000 - 0.03, 0.02);
  osc.stop(start + durationMs / 1000);
}

export function unlockAudio(): void {
  audioCtx();
  window.speechSynthesis?.getVoices();
}

export function sfxBlip(): void {
  tone(880, 70, 'square', 0.05);
}

export function sfxAlarm(): void {
  tone(440, 180, 'sawtooth', 0.1);
  tone(330, 180, 'sawtooth', 0.1, 200);
  tone(440, 180, 'sawtooth', 0.1, 400);
}

export function sfxKnock(): void {
  tone(90, 120, 'triangle', 0.3);
  tone(70, 160, 'triangle', 0.3, 180);
}

export function sfxJumpscare(): void {
  for (let i = 0; i < 14; i++) {
    tone(120 + Math.random() * 700, 140, 'sawtooth', 0.22, i * 90);
  }
}

export function speak(text: string, urgent = false): void {
  const synth = window.speechSynthesis;
  if (!synth) return;
  if (urgent) synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'fr-FR';
  utterance.rate = urgent ? 1.15 : 1;
  const voice = synth.getVoices().find((v) => v.lang.startsWith('fr'));
  if (voice) utterance.voice = voice;
  synth.speak(utterance);
}

export function vibrate(pattern: number | number[]): void {
  navigator.vibrate?.(pattern);
}
