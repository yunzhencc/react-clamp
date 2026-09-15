import type { NativeModeInput } from '../../../src/engine/native.js'
// Adapted from vue-clamp at 9f93dbcc31f60b02dc34fbd6a9da9bf90edc6d84; MIT.
import { describe, expect, it } from 'vitest'

import { resolveNativeMode } from '../../../src/engine/native.js'

const input = {
  boundary: 'grapheme',
  ellipsis: '…',
  expanded: false,
  hasAfterSlot: false,
  lineLimit: 2,
  locationRatio: 1,
  maxHeight: undefined,
} satisfies NativeModeInput

describe('native clamp selection', () => {
  it('selects semantically eligible multiline clamps', () => {
    expect(resolveNativeMode(input)).toBe('multi-line')
  })

  it('keeps custom ellipses off the legacy native path', () => {
    expect(resolveNativeMode({ ...input, ellipsis: '...' })).toBeNull()
  })
})
