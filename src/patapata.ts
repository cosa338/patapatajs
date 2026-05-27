/*!
 * patapata.jp v0.1.1
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 https://github.com/cosa338
 */

// @ts-check

import { PatapataTextElement } from './elements/text.ts';
import { PatapataClockElement } from './elements/clock.ts';
import { PatapataTimerElement } from './elements/timer.ts';
import { PatapataControlElement } from './elements/control.ts';

if (!customElements.get('patapata-text')) {
  customElements.define('patapata-text', PatapataTextElement);
}

if (!customElements.get('patapata-clock')) {
  customElements.define('patapata-clock', PatapataClockElement);
}

if (!customElements.get('patapata-timer')) {
  customElements.define('patapata-timer', PatapataTimerElement);
}

if (!customElements.get('patapata-control')) {
  customElements.define('patapata-control', PatapataControlElement);
}
