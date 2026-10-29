export class FlightAudio {
  constructor() { this.enabled = true; this.context = null; }

  unlock() {
    if (!this.enabled) return;
    try {
      this.context ??= new AudioContext();
      this.context.resume().catch(() => {});
    } catch { this.context = null; }
  }

  tone(type) {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type === 'hit' ? 'sawtooth' : 'sine';
    const frequency = type === 'hit' ? 110 : type === 'goal' ? 880 : 440;
    const duration = type === 'hit' ? 0.35 : 0.14;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(type === 'hit' ? 35 : frequency * 1.5, now + duration);
    gain.gain.setValueAtTime(type === 'hit' ? 0.06 : 0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }
}
