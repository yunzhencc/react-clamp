import type { TextOptions } from '../src/text'
import assert from 'node:assert/strict'
import { it } from 'vitest'
import {
  clampTextToFit,
  normalizeLocationRatio,
  prepareSharedText,
} from '../src/engine/text'

function fitText(
  text: string,
  { boundary = 'grapheme', location = 'end', ellipsis = '…' }: TextOptions,
  fits: (text: string) => boolean,
) {
  return clampTextToFit({
    prepared: prepareSharedText(text, boundary),
    ratio: normalizeLocationRatio(location),
    ellipsis,
    fits,
    includeFullCandidate: true,
  }).text
}

it('keeps complete graphemes at each ellipsis location', () => {
  const text = 'A👨‍👩‍👧‍👦e\u0301中文Z'
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  const fits = (value: string) => [...segmenter.segment(value)].length <= 4
  assert.equal(fitText(text, { location: 'end' }, fits), 'A👨‍👩‍👧‍👦e\u0301…')
  assert.equal(fitText(text, { location: 'start' }, fits), '…中文Z')
  assert.equal(fitText(text, { location: 'middle' }, fits), 'A…文Z')
  assert.equal(fitText(text, { location: 1 }, fits), 'A👨‍👩‍👧‍👦e\u0301…')
})

it('preserves full text, custom ellipsis, and narrow-container output', () => {
  assert.equal(
    fitText('  short  ', {}, () => true),
    '  short  ',
  )
  assert.equal(
    fitText('abcdefgh', { ellipsis: '..' }, x => x.length <= 5),
    'abc..',
  )
  assert.equal(
    fitText('abcdefgh', {}, () => false),
    '…',
  )
  assert.equal(
    fitText('', {}, () => false),
    '',
  )
  assert.equal(
    fitText('abcdef', { ellipsis: '' }, x => x.length <= 3),
    'abc',
  )
})

it('word boundaries keep complete words and fall back for oversized words', () => {
  assert.equal(
    fitText('hello world again', { boundary: 'word' }, x => x.length <= 10),
    'hello…',
  )
  assert.equal(
    fitText('extraordinary', { boundary: 'word' }, x => x.length <= 5),
    'extr…',
  )
})
