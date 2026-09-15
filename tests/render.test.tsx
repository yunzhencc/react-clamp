import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderToString } from 'react-dom/server'
import { InlineClamp, LineClamp, WrapClamp } from '../src/index'

test('server rendering preserves escaped source text and controlled expansion', () => {
  const html = renderToString(
    <LineClamp
      text="<script> & hello"
      expanded
      after={({ expanded }) => <button>{expanded ? 'Less' : 'More'}</button>}
    />,
  )
  assert.ok(html.includes('&lt;script&gt; &amp; hello'))
  assert.ok(html.includes('Less'))
  assert.ok(!html.includes('aria-hidden="true"'))
  const inline = renderToString(
    <InlineClamp
      text="photo.jpeg"
      split={() => ({ body: 'photo', end: '.jpeg' })}
    />,
  )
  assert.ok(inline.includes('.jpeg'))
})

test('accepts upstream out-of-range locations and browser-resolved heights', () => {
  for (const props of [
    { maxHeight: -1 },
    { maxHeight: NaN },
    { maxHeight: Infinity },
    { location: 2 },
    { location: -1 },
    { location: NaN },
  ]) {
    assert.doesNotThrow(() =>
      renderToString(<LineClamp text="hello" {...props} />),
    )
  }
})

test('wrapClamp renders all items on the server and delegates invalid heights to CSS', () => {
  const html = renderToString(
    <WrapClamp maxLines={1}>
      <button>A & B</button>
      <span>Second</span>
    </WrapClamp>,
  )
  assert.ok(html.includes('A &amp; B'))
  assert.ok(html.includes('Second'))
  assert.ok(html.includes('data-clamped="false"'))
  for (const props of [{ maxHeight: NaN }]) {
    assert.doesNotThrow(() =>
      renderToString(<WrapClamp {...props}>Item</WrapClamp>),
    )
  }
})

test('accepts upstream CSS lengths and configurable root tags', () => {
  assert.ok(
    renderToString(
      <LineClamp text="Text" as="section" maxHeight="3em" />,
    ).startsWith('<section'),
  )
  assert.ok(
    renderToString(
      <WrapClamp as="section" maxHeight="calc(3rem + 2px)">
        Tag
      </WrapClamp>,
    ).startsWith('<section'),
  )
})

test('normalizes upstream line limits and accepts a zero height', () => {
  assert.ok(
    !renderToString(<LineClamp text="text" maxLines={0} />).includes(
      '-webkit-line-clamp',
    ),
  )
  assert.ok(
    renderToString(<LineClamp text="text" maxLines={1.8} />).includes(
      'white-space:nowrap',
    ),
  )
  assert.ok(
    renderToString(<WrapClamp maxHeight={0}>Item</WrapClamp>).includes(
      'max-height:0',
    ),
  )
})
