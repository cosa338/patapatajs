// @ts-check

class FlipAnimation {
  from: string;
  to: string;
  startTime: number;
  durationMs: number | null;

  constructor(from, to, startTime, durationMs = null) {
    this.from = from;
    this.to = to;
    this.startTime = startTime;
    this.durationMs = (typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs > 0)
      ? durationMs
      : null;
  }
}

class Flipper {
  baseValue: string;
  animations: FlipAnimation[];

  constructor(startValue) {
    this.baseValue = String(startValue ?? '');
    // animations: [newest (back) ... oldest (front)]
    this.animations = [];
  }

  setValue(v) {
    this.baseValue = String(v ?? '');
    this.animations.length = 0;
  }

  transitionTo(next, now, durationMs = null) {
    const to = String(next ?? '');
    if (to === this.baseValue) return;
    const anim = new FlipAnimation(this.baseValue, to, now, durationMs);
    this.animations.unshift(anim);
    this.baseValue = to;
  }

  update(now, defaultDurationMs) {
    const fallback = Math.max(1, defaultDurationMs || 1);
    const len = this.animations.length;
    if (len <= 0) return;

    let write = 0;
    for (let i = 0; i < len; i++) {
      const anim = this.animations[i];
      const dur = Math.max(1, anim.durationMs || fallback);
      const elapsed = now - anim.startTime;
      if (elapsed < dur) {
        this.animations[write] = anim;
        write++;
      }
    }
    this.animations.length = write;
  }

  hasActive() {
    return this.animations.length > 0;
  }
}

export { Flipper };
