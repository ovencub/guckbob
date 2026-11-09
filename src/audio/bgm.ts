// BGM: BPM 150 5음계 루프, 마감 10초 전 템포 업 (GDD 17장)
import { AUDIO } from '../data/audio';
import type { Audio } from './sfx';

// 8마디 멜로디 (5음계 단계, -1 = 쉼표) + 베이스
const MELODY = [0, 2, 4, 2, 3, -1, 4, 3, 2, 0, 1, 2, -1, 4, 3, 2, 0, 2, 4, 5, 4, 3, 2, -1, 1, 2, 3, 2, 1, 0, -1, 0];
const BASS = [0, 0, 3, 3, 4, 4, 2, 2];

export class Bgm {
  private timer = 0;
  private next = 0;
  private i = 0;
  playing = false;
  rush = false;
  constructor(private a: Audio) {}

  start(): void {
    if (this.playing || !this.a.ctx) return;
    this.playing = true;
    this.next = this.a.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 50);
  }

  stop(): void {
    this.playing = false;
    clearInterval(this.timer);
  }

  private note(step: number, octave: number, t: number, dur: number, type: OscillatorType, vol: number): void {
    const c = this.a.ctx!;
    const sc = AUDIO.scale;
    const n = AUDIO.root + octave * 12 + sc[((step % sc.length) + sc.length) % sc.length] + 12 * Math.floor(step / sc.length);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = 440 * 2 ** ((n - 69) / 12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.a.bgmBus!);
    o.start(t); o.stop(t + dur + 0.02);
  }

  private schedule(): void {
    const c = this.a.ctx;
    if (!c || !this.playing) return;
    const beat = 60 / (this.rush ? AUDIO.rushBpm : AUDIO.bpm) / 2; // 8분음표
    while (this.next < c.currentTime + 0.2) {
      const m = MELODY[this.i % MELODY.length];
      if (m >= 0) this.note(m, 1, this.next, beat * 0.9, 'square', 0.12);
      if (this.i % 4 === 0) this.note(BASS[(this.i / 4) % BASS.length], -1, this.next, beat * 3.5, 'triangle', 0.25);
      if (this.i % 2 === 1) this.note(0, 2, this.next, 0.03, 'square', 0.03);
      this.next += beat;
      this.i++;
    }
  }
}
