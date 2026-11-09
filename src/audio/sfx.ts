// 효과음 즉석 합성 (GDD 17장). 첫 탭 이후에만 소리, 음소거는 저장.
import { AUDIO } from '../data/audio';

export type Sfx = 'tap' | 'sizzle' | 'ding' | 'burn' | 'serve' | 'coin' | 'wash' | 'angry' | 'tierup' | 'ending' | 'nope' | 'poof';

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

export class Audio {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  sfxBus: GainNode | null = null;
  bgmBus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  muted = false;

  /** 첫 사용자 입력에서 호출 (브라우저 자동재생 정책) */
  unlock(): void {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : AUDIO.master;
    this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = AUDIO.sfx; this.sfxBus.connect(this.master);
    this.bgmBus = this.ctx.createGain(); this.bgmBus.gain.value = AUDIO.bgm; this.bgmBus.connect(this.master);
    const len = this.ctx.sampleRate * 0.5;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : AUDIO.master, this.ctx.currentTime, 0.02);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, t0 = 0, slideTo?: number): void {
    const c = this.ctx!;
    const t = c.currentTime + t0;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfxBus!);
    o.start(t); o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, freq: number, q = 1, t0 = 0, type: BiquadFilterType = 'bandpass'): void {
    const c = this.ctx!;
    const t = c.currentTime + t0;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.sfxBus!);
    s.start(t); s.stop(t + dur + 0.02);
  }

  play(name: Sfx, combo = 0): void {
    if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
    const up = 2 ** ((Math.min(combo, AUDIO.comboMax) * AUDIO.comboStep) / 12);
    switch (name) {
      case 'tap': this.tone(900, 0.06, 'sine', 0.25, 0, 500); break; // 뽁
      case 'nope': this.tone(220, 0.12, 'square', 0.08, 0, 180); break;
      case 'sizzle': this.noise(0.35, 0.18, 4000, 0.7, 0, 'highpass'); break; // 치익
      case 'ding': this.tone(1318, 0.18, 'triangle', 0.25); this.tone(1046, 0.3, 'triangle', 0.22, 0.12); break; // 띵동
      case 'burn': this.noise(0.6, 0.3, 600, 0.6, 0, 'lowpass'); this.tone(160, 0.4, 'sawtooth', 0.06, 0, 70); break; // 푸쉬
      case 'serve': this.tone(520 * up, 0.07, 'square', 0.12); this.noise(0.05, 0.2, 2500, 2); break; // 탁
      case 'coin': this.tone(1568 * up, 0.08, 'square', 0.12); this.tone(2093 * up, 0.16, 'square', 0.1, 0.06); break; // 짤랑
      case 'wash': this.tone(1200, 0.07, 'sine', 0.15, 0, 1800); this.tone(1500, 0.07, 'sine', 0.12, 0.05, 2200); break; // 뽀득
      case 'angry': this.tone(700, 0.35, 'sawtooth', 0.1, 0, 300); this.tone(900, 0.2, 'triangle', 0.08, 0.05, 500); break; // 냐앙!
      case 'poof': this.noise(0.15, 0.08, 1800, 1); break;
      case 'tierup': [0, 4, 7, 12].forEach((n, i) => this.tone(midi(AUDIO.root + 12 + n), 0.25, 'triangle', 0.22, i * 0.11)); break;
      case 'ending': [0, 4, 7, 12, 7, 12, 16, 19].forEach((n, i) => this.tone(midi(AUDIO.root + 12 + n), 0.3, i % 2 ? 'square' : 'triangle', 0.16, i * 0.13)); break;
    }
  }
}
