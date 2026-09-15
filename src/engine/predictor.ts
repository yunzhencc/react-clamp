import type { ClampBoundary, ClampLength } from "./types.js";

export type LineClampPredictionInput = {
  readonly afterWidth: number;
  readonly beforeWidth: number;
  readonly ellipsis: string;
  readonly lineLimit: number;
  readonly rootWidth: number;
  readonly text: string;
  readonly textElement: HTMLElement;
};

export type LineClampPredictor = {
  readonly invalidate: () => void;
  readonly predict: (input: LineClampPredictionInput) => {
    readonly clamped: boolean;
    readonly text: string;
  } | null;
  readonly supports: (context: {
    readonly boundary: ClampBoundary;
    readonly ellipsis: string;
    readonly lineLimit: number | undefined;
    readonly locationRatio: number;
    readonly maxHeight: ClampLength | undefined;
  }) => boolean;
};
