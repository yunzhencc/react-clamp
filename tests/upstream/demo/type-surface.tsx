import type { ReactNode, RefObject } from 'react'
import type {
  NativeClampMode,
  NativeModeInput,
} from '../../../src/engine/native'
import type {
  PreparedRich,
  PreparedRichNode,
  RichBoundaryPoint,
  RichClampOptions,
  RichClampProbe,
  RichClampResult,
  RichState,
} from '../../../src/engine/rich'
// @ts-expect-error Text helpers remain implementation API, not package-root exports.
// @ts-expect-error Rich helpers remain implementation API, not package-root exports.

import type {
  PreparedText,
  TextClampFitInput,
  TextClampHint,
  TextClampLayoutInput,
  TextClampResult,
  TextClampSpacing,
} from '../../../src/engine/text'
import type { ClampBoundary, ClampHandle, ClampLength, ClampLocation, ClampState, InlineClampParts, InlineClampProps, LineClampProps, RichLineClampProps, WrapClampHandle, WrapClampProps, WrapClampState } from '../../../src/index'
// @ts-expect-error Vue slot maps are not a React public contract.
// @ts-expect-error Shared internal prop maps are not public exports.
// @ts-expect-error Vue emit maps are not a React public contract.
// @ts-expect-error Vue slot maps are not a React public contract.
// @ts-expect-error Framework-internal ref plumbing is not a public export.
// React equivalents of upstream type-surface.ts and wrap-slot-types.vue (MIT), 9f93dbcc.
import { createRef } from 'react'
import {

  InlineClamp,

  LineClamp,

  RichLineClamp,

  WrapClamp,

} from '../../../src/index'

type Equal<Left, Right>
  = (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false
type Expect<Value extends true> = Value
type CallbackState<Value> = Value extends (state: infer State) => ReactNode
  ? State
  : never
type _PackageApiTypes = [
  Expect<Equal<ClampBoundary, 'grapheme' | 'word'>>,
  Expect<Equal<ClampLength, number | string>>,
  Expect<Equal<ClampLocation, 'start' | 'middle' | 'end' | number>>,
  Expect<Equal<LineClampProps['maxHeight'], ClampLength | undefined>>,
  Expect<Equal<RichLineClampProps['maxHeight'], ClampLength | undefined>>,
  Expect<Equal<WrapClampProps['maxHeight'], ClampLength | undefined>>,
  Expect<Equal<WrapClampProps<string>['items'], readonly string[] | undefined>>,
  Expect<
    Equal<
      InlineClampProps['split'],
      ((text: string) => InlineClampParts) | undefined
    >
  >,
  Expect<
    Equal<
      WrapClampProps<Invitee>['itemKey'],
      | keyof Invitee
      | ((item: Invitee, index: number) => string | number)
      | undefined
    >
  >,
  Expect<
    Equal<
      Parameters<NonNullable<WrapClampProps<string>['renderItem']>>[0],
      string
    >
  >,
  Expect<
    Equal<
      Parameters<NonNullable<WrapClampProps<string>['renderItem']>>[1],
      number
    >
  >,
  Expect<Equal<WrapClampState<string>['hiddenItems'], readonly string[]>>,
  Expect<Equal<CallbackState<LineClampProps['before']>, ClampState>>,
  Expect<Equal<CallbackState<RichLineClampProps['after']>, ClampState>>,
  Expect<
    Equal<
      CallbackState<WrapClampProps<string>['after']>,
      WrapClampState<string>
    >
  >,
  Expect<Equal<ClampState['toggle'], () => void>>,
  Expect<Equal<ClampState['expanded'], boolean>>,
  Expect<Equal<ClampHandle['clamped'], boolean>>,
  Expect<Equal<WrapClampHandle<string>['toggle'], () => void>>,
  Expect<Equal<ClampHandle['element'], HTMLElement | null>>,
  Expect<Equal<RefObject<ClampHandle | null>['current'], ClampHandle | null>>,
]
type _TextHelperContracts = [
  Expect<Equal<TextClampSpacing, 'trim' | 'preserve-outer'>>,
  Expect<Equal<PreparedText['boundaryOffsets'], readonly number[]>>,
  Expect<Equal<TextClampHint['boundaryOffsets'], readonly number[]>>,
  Expect<Equal<TextClampHint['ellipsis'], string | undefined>>,
  Expect<Equal<TextClampHint['hasAffixes'], boolean | undefined>>,
  Expect<Equal<TextClampHint['layoutKey'], string | undefined>>,
  Expect<Equal<TextClampHint['lineLimit'], number | undefined>>,
  Expect<Equal<TextClampHint['maxHeight'], ClampLength | undefined>>,
  Expect<Equal<TextClampHint['ratio'], number | undefined>>,
  Expect<Equal<TextClampHint['spacing'], TextClampSpacing | undefined>>,
  Expect<Equal<TextClampResult['text'], string>>,
  Expect<Equal<TextClampFitInput['prepared'], PreparedText>>,
  Expect<Equal<TextClampLayoutInput['hasAffixes'], boolean | undefined>>,
  Expect<Equal<TextClampLayoutInput['layoutKey'], string | undefined>>,
  Expect<Equal<TextClampLayoutInput['maxHeight'], ClampLength | undefined>>,
]
type _RichHelperContracts = [
  Expect<Equal<RichBoundaryPoint['path'], readonly number[]>>,
  Expect<Equal<PreparedRich['nodes'], readonly PreparedRichNode[]>>,
  Expect<
    Equal<Extract<RichState, { kind: 'clamped' }>['point'], RichBoundaryPoint>
  >,
  Expect<Equal<RichClampProbe['body'], HTMLElement>>,
  Expect<Equal<RichClampOptions['prepared'], PreparedRich>>,
  Expect<Equal<RichClampResult['state'], RichState | null>>,
]
type _NativeHelperContracts = [
  Expect<Equal<NativeClampMode, 'single-line' | 'multi-line'>>,
  Expect<Equal<NativeModeInput['maxHeight'], ClampLength | undefined>>,
  Expect<Equal<NativeModeInput['boundary'], ClampBoundary>>,
]

interface Invitee { id: string, label: string, priority: number }
const invitees: readonly Invitee[] = [
  { id: 'design', label: 'Design', priority: 2 },
  { id: 'docs', label: 'Docs', priority: 1 },
]
const lineRef = createRef<ClampHandle>()
const richRef = createRef<ClampHandle>()
const wrapRef = createRef<WrapClampHandle<Invitee>>()
export const typeFixtures = (
  <>
    <LineClamp
      ref={lineRef}
      text="Release notes"
      maxLines={2}
      after={({ toggle, clamped }) =>
        clamped && <button onClick={toggle}>More</button>}
    />
    <RichLineClamp
      ref={richRef}
      html="<strong>Trusted HTML</strong>"
      maxHeight="4em"
    />
    <InlineClamp
      text="image.jpeg"
      split={text => ({ body: text.slice(0, -5), end: '.jpeg' })}
    />
    <WrapClamp
      items={invitees}
      ref={wrapRef}
      itemKey={(item, index) => `${item.id}-${index}`}
      maxLines={1}
      renderItem={(item, index) => (
        <span>
          {item.label}
          {' '}
          {item.priority.toFixed(0)}
          {' '}
          {index.toFixed(0)}
        </span>
      )}
      after={({ hiddenItems, clamped, expanded, toggle }) => {
        const typedItems: readonly Invitee[] = hiddenItems
        return (
          (clamped || expanded) && (
            <button onClick={toggle}>{typedItems.length}</button>
          )
        )
      }}
    />
  </>
)
const _invalidItem = (
  // @ts-expect-error Item callback must accept the inferred item shape.
  <WrapClamp items={invitees} renderItem={(item: number) => item.toFixed(0)} />
)
const _invalidKey = (
  <WrapClamp
    items={invitees}
    // @ts-expect-error Object item keys are checked against the item shape.
    itemKey="missing"
    renderItem={item => item.label}
  />
)
// @ts-expect-error Line limits are numeric.
const _invalidLines = <LineClamp text="x" maxLines="two" />
// @ts-expect-error InlineClamp has no multiline height limit.
const _invalidInline = <InlineClamp text="x" maxHeight={40} />
// @ts-expect-error RichLineClamp supports end clamping only.
const _invalidRich = <RichLineClamp html="x" location="start" />
const _invalidRef = (
  <WrapClamp
    items={invitees}
    renderItem={item => item.label}
    // @ts-expect-error Generic wrap handles preserve item types.
    ref={createRef<WrapClampHandle<number>>()}
  />
)
