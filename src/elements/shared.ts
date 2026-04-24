// @ts-check

import { Flipper } from '../render/flipper.ts';
import type { PanelApplyOptions, SequencePart, SequenceState } from './types.ts';

function applyPanelTokensToPart(opts: PanelApplyOptions) {
  const {
    part,
    tokens,
    isMsPanel,
    atomic,
    durationNormal,
    durationMsFixed,
    nowTs,
    allowRebuild = false,
    onLayoutDirty = null,
  } = opts;

  const tokensToApply = atomic ? [tokens.join('')] : tokens;
  const flagsToApply = atomic ? [isMsPanel.some(Boolean)] : isMsPanel;

  if (!atomic && tokensToApply.length > (part.maxLen || 0)) {
    part.maxLen = tokensToApply.length;
    if (typeof onLayoutDirty === 'function') onLayoutDirty();
  }

  if (allowRebuild && part.flippers.length !== tokensToApply.length) {
    part.flippers.length = 0;
    for (let i = 0; i < tokensToApply.length; i++) part.flippers.push(new Flipper(''));
    if (typeof onLayoutDirty === 'function') onLayoutDirty();
  }

  for (let i = 0; i < part.flippers.length; i++) {
    const dur = flagsToApply[i] ? durationMsFixed : durationNormal;
    part.flippers[i].transitionTo(tokensToApply[i] ?? '', nowTs, dur);
  }
}

function buildSinglePartSequence(mode: SequenceState['mode'], probe: string, tokens: string[], atomic: boolean) {
  const initialTokens = atomic ? [tokens.join('')] : tokens;
  const count = Math.max(1, initialTokens.length);
  const flippers: Flipper[] = [];
  for (let i = 0; i < count; i++) flippers.push(new Flipper(''));

  const part: SequencePart = {
    items: [probe],
    maxLen: atomic ? 1 : count,
    flippers,
    currentText: probe,
    lastIndex: 0,
  };

  for (let i = 0; i < part.flippers.length; i++) part.flippers[i].setValue(initialTokens[i] ?? '');

  const sequence: SequenceState = {
    mode,
    layout: 'row',
    repeat: true,
    steps: 1,
    stepIndex: 0,
    shuffleEndAt: null,
    parts: [part],
  };
  return { sequence, part };
}


export { applyPanelTokensToPart, buildSinglePartSequence };
