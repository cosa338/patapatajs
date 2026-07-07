// Safety cap for concurrently tracked flips per panel. Anything beyond this
// is visual noise anyway; the oldest (mostly finished) entries get dropped.
const MAX_STACKED_ANIMATIONS = 64;

class FlipAnimation {
  from: string;
  to: string;
  startTime: number;
  durationMs: number | null;

  constructor(from: string, to: string, startTime: number, durationMs: number | null = null) {
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

  constructor(startValue: string) {
    this.baseValue = String(startValue ?? '');
    // animations: [newest (back) ... oldest (front)]
    this.animations = [];
  }

  setValue(v: string) {
    this.baseValue = String(v ?? '');
    this.animations.length = 0;
  }

  transitionTo(next: string, now: number, durationMs: number | null = null) {
    const to = String(next ?? '');
    if (to === this.baseValue) return;

    // update() only runs while painting, so cull expired animations here too;
    // otherwise a hidden/off-screen element would accumulate entries for as
    // long as its tick loop keeps feeding new values.
    if (this.animations.length > 0) {
      let write = 0;
      for (let i = 0; i < this.animations.length; i++) {
        const anim = this.animations[i];
        if (anim.durationMs != null && now - anim.startTime >= anim.durationMs) continue;
        this.animations[write] = anim;
        write++;
      }
      this.animations.length = write;
      // Entries without their own duration are culled by update(); cap them here.
      if (this.animations.length >= MAX_STACKED_ANIMATIONS) {
        this.animations.length = MAX_STACKED_ANIMATIONS - 1;
      }
    }

    const anim = new FlipAnimation(this.baseValue, to, now, durationMs);
    this.animations.unshift(anim);
    this.baseValue = to;
  }

  update(now: number, defaultDurationMs: number) {
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
