import { forwardRef, useMemo } from "react";
import { Clamp, type ClampHandle, type LineClampProps } from "./Clamp.js";
import { createPretextLineClampPredictor } from "./engine/pretext/predictor.js";

export const LineClamp = forwardRef<ClampHandle, LineClampProps>(
  function PredictiveLineClamp(props, ref) {
    const predictor = useMemo(createPretextLineClampPredictor, []);
    return <Clamp {...props} ref={ref} predictor={predictor} />;
  },
);
export type { ClampHandle, ClampState, LineClampProps } from "./Clamp.js";
