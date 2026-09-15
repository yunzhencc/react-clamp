import type { ClampHandle, LineClampProps } from './Clamp.js'
import { forwardRef, useMemo } from 'react'
import { Clamp } from './Clamp.js'
import { createPretextLineClampPredictor } from './engine/pretext/predictor.js'

// eslint-disable-next-line react/no-forward-ref -- Required by the supported React 18 peer dependency.
export const LineClamp = forwardRef<ClampHandle, LineClampProps>(
  // Keep the public component name available to React DevTools.
  // eslint-disable-next-line prefer-arrow-callback
  function PredictiveLineClamp(props, ref) {
    const predictor = useMemo(createPretextLineClampPredictor, [])
    return <Clamp {...props} ref={ref} predictor={predictor} />
  },
)
export type { ClampHandle, ClampState, LineClampProps } from './Clamp.js'
