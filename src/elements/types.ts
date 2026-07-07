import type { Flipper } from '../render/flipper.ts';

type LayoutMode = 'row' | 'stack';
type SequenceMode = 'rand' | 'sequence' | 'shuffle' | 'clock' | 'timer' | 'static';

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
    weight: number;
  };
  text: {
    align: string;
    valign: string;
    offsetXPx: number;
    offsetYPx: number;
  };
  colors: {
    panelTop: string;
    panelBottom: string;
    divider: string;
    text: string;
    edge: string;
  };
  divider: {
    sizePx: number;
    mode: string;
  };
  edge: {
    sizePx: number;
    insetShadeStrength: number;
  };
  flip: {
    overhang: number;
    shadow: number;
  };
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
  SequenceMode,
  SequencePart,
  SequenceState,
  TimerConfig,
  VisualConfig,
};
