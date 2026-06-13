export class AudioManager {
  private ctx: AudioContext | null = null;

  private ensure(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private beep(
    freq: number,
    duration: number,
    type: OscillatorType = "square",
    volume = 0.1,
  ): void {
    const ctx = this.ensure();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  clawClose(): void {
    this.beep(200, 0.08, "square", 0.08);
  }

  clawOpen(): void {
    this.beep(150, 0.08, "square", 0.06);
  }

  dropPrize(): void {
    this.beep(80, 0.2, "sine", 0.15);
  }

  buttonClick(): void {
    this.beep(800, 0.03, "square", 0.05);
  }

  fanfare(): void {
    this.beep(523, 0.12, "sine", 0.1);
    setTimeout(() => this.beep(659, 0.12, "sine", 0.1), 120);
    setTimeout(() => this.beep(784, 0.12, "sine", 0.1), 240);
    setTimeout(() => this.beep(1047, 0.3, "sine", 0.12), 360);
  }
}
