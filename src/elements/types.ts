// @ts-check

import type { Flipper } from '../render/flipper.ts';

type LayoutMode = 'row' | 'stack';
type SequenceMode = 'rand' | 'sequence' | 'shuffle' | 'clock' | 'timer';

interface BaseConfig {
  visual: VisualConfig;
  interval: number;
  duration: number;
  value: string;
  light: boolean;
  easing: string;
  halfHead: number;
  halfTail: number;
}

interface VisualConfig {
  atomic: boolean;
  gap: number;
  cardWidth: number;
  cardHeight: number;
  radius: number;
  font: {
    family: string;
    sizePx: number;
    weight: string;
  };
  text: {
    align: 'left' | 'center' | 'right';
    valign: 'top' | 'middle' | 'bottom';
    offsetXPx: number;
    offsetYPx: number;
  };
  colors: {
    text: string;
  };
  [key: string]: unknown;
}

interface ClockConfig extends BaseConfig {
  format: string;
  diff: string;
  minDigits: number;
}

interface TimerConfig extends BaseConfig {
  format: string;
  sec: number | null;
  minDigits: number;
}

interface SequencePart {
  items: string[];
  maxLen: number;
  flippers: Flipper[];
  currentText: string;
  lastIndex: number;
}

interface SequenceState {
  mode: SequenceMode;
  layout: LayoutMode;
  repeat: boolean;
  steps: number;
  stepIndex: number;
  shuffleEndAt: number | null;
  parts: SequencePart[];
}

interface GeomPart {
  count: number;
  cardWidthPx: number;
  partW: number;
  tokens: string[] | null;
  scales: number[];
  offsets: number[];
}

interface LayoutCache {
  key: string;
  partsItems: string[][];
  isJsonValue: boolean;
  geomParts: GeomPart[];
  totalW: number;
  totalH: number;
  outerPadX: number;
}

interface PanelApplyOptions {
  part: SequencePart;
  tokens: string[];
  isMsPanel: boolean[];
  atomic: boolean;
  durationNormal: number;
  durationMsFixed: number;
  nowTs: number;
  allowRebuild?: boolean;
  onLayoutDirty?: (() => void) | null;
}

export type {
  BaseConfig,
  ClockConfig,
  GeomPart,
  LayoutCache,
  LayoutMode,
  PanelApplyOptions,
  SequencePart,
  SequenceState,
  TimerConfig,
  VisualConfig,
};
