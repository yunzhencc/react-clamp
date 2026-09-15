/* eslint-disable react/no-children-to-array -- Normalize nested slot children with React key semantics. */
import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from 'react'
import type { SimpleLineFit } from './engine/layout.js'
import type { LineClampPredictor } from './engine/predictor.js'
import type { TextClampHint } from './engine/text.js'
import type { ClampLength, ClampTag } from './layout.js'
import type { TextOptions } from './text.js'
import {
  Children,

  forwardRef,

  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { scheduleFontFrame } from './engine/font-frame.js'
import { createInlineSearch } from './engine/inline-search.js'
import { estimateLineCapacity, simpleLineFitFromStyle, textLayoutMetricKey } from './engine/layout.js'
import { searchLineEndCandidates } from './engine/line/end-search.js'
import { measureLayout } from './engine/measure.js'
import { getNativeContentStyle, measureNativeClamped, resolveNativeMode } from './engine/native.js'
import { createRichMeasurement, richProbeStyle } from './engine/rich-measurement.js'
import {
  normalizeLocationRatio,
  prepareSharedText,
  searchTextLayout,

} from './engine/text.js'
import {

  cssLength,
  normalizeLineLimit,
  onlyWidthChanges,
} from './layout.js'

export interface ClampState {
  clamped: boolean
  expanded: boolean
  expand: () => void
  collapse: () => void
  toggle: () => void
}
export interface ClampHandle extends ClampState {
  element: HTMLElement | null
}
export type ClampContent = ReactNode | ((state: ClampState) => ReactNode)
export interface LineClampProps
  extends Omit<HTMLAttributes<HTMLElement>, 'children'>,
  TextOptions {
  text?: string
  as?: ClampTag
  /** Omit both limits to show the full source. */
  maxLines?: number
  /** Maximum content height in CSS pixels. */
  maxHeight?: ClampLength
  expanded?: boolean
  defaultExpanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  onClampChange?: (clamped: boolean) => void
  before?: ClampContent
  after?: ClampContent
}
export interface InlineClampParts {
  start?: string
  body: string
  end?: string
}
export interface InlineClampProps
  extends Omit<
    LineClampProps,
    | 'maxLines'
    | 'maxHeight'
    | 'before'
    | 'after'
    | 'expanded'
    | 'defaultExpanded'
    | 'onExpandedChange'
  > {
  text: string
  split?: (text: string) => InlineClampParts
}

const useBrowserLayoutEffect
  = typeof document === 'undefined' ? useEffect : useLayoutEffect
const hiddenStyle: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  border: 0,
}

function renderContent(value: ClampContent, state: ClampState): ReturnType<typeof Children.toArray> {
  const content = typeof value === 'function' ? value(state) : value
  return Children.toArray(content).filter(node => node !== '')
}

export interface RichLineClampProps
  extends Omit<LineClampProps, 'text' | 'location'> {
  /** Trusted or already sanitized inline HTML. This component is not a sanitizer. */
  html: string
}
interface InternalProps extends LineClampProps {
  html?: string
  predictor?: LineClampPredictor
  inline?: boolean
  split?: InlineClampProps['split']
}

// eslint-disable-next-line react/no-forward-ref -- Required by React 18 consumers.
export const Clamp = forwardRef<ClampHandle, InternalProps>((
  {
    text = '',
    html,
    predictor,
    as,
    maxLines: requestedLines,
    maxHeight: requestedHeight,
    location: requestedLocation = 'end',
    boundary = 'grapheme',
    ellipsis = '…',
    expanded: controlledExpanded,
    defaultExpanded = false,
    onExpandedChange,
    onClampChange,
    before,
    after,
    inline = false,
    split,
    style,
    ...attrs
  },
  forwardedRef,
) => {
  const maxLines = inline ? 1 : normalizeLineLimit(requestedLines)
  const maxHeight = cssLength(requestedHeight)
  const location = normalizeLocationRatio(requestedLocation)

  const parts = split?.(text) ?? { body: text }
  const source = html ?? parts.body
  const prepared = useMemo(
    () => prepareSharedText(parts.body, boundary),
    [parts.body, boundary],
  )
  const richMeasurementRef = useRef<ReturnType<typeof createRichMeasurement> | null>(null)
  richMeasurementRef.current ??= createRichMeasurement()
  const richProbeRef = useRef<HTMLSpanElement>(null)
  const textHintRef = useRef<TextClampHint | null>(null)
  const lineFitCacheRef = useRef<{ key: string, fit: SimpleLineFit | undefined } | null>(null)
  const inlineSearchRef = useRef<ReturnType<typeof createInlineSearch> | null>(null)
  inlineSearchRef.current ??= createInlineSearch()
  const accessibleText
    = html === undefined
      ? (parts.start ?? '') + source + (parts.end ?? '')
      : ''
  const [localExpanded, setLocalExpanded] = useState(defaultExpanded)
  const expanded = controlledExpanded ?? localExpanded
  const [result, setResult] = useState({
    source,
    text: source,
    clamped: false,
    fallback: false,
  })
  const clamped = !expanded && result.source === source && result.clamped
  const changeExpanded = useCallback((next: boolean) => {
    if (next === expanded)
      return
    if (controlledExpanded === undefined)
      setLocalExpanded(next)
    onExpandedChange?.(next)
  }, [expanded, controlledExpanded, onExpandedChange])
  const state = useMemo<ClampState>(() => ({
    clamped,
    expanded,
    expand: () => changeExpanded(true),
    collapse: () => changeExpanded(false),
    toggle: () => changeExpanded(!expanded),
  }), [clamped, expanded, changeExpanded])
  const beforeContent = useMemo(() => inline ? parts.start : renderContent(before, state), [inline, parts.start, before, state])
  const afterContent = useMemo(() => inline ? parts.end : renderContent(after, state), [inline, parts.end, after, state])
  const hasAfter = Children.toArray(afterContent).some(node => node !== '')
  const nativeMode = split || (html !== undefined && richMeasurementRef.current.blocked)
    ? null
    : resolveNativeMode({
        expanded,
        lineLimit: maxLines,
        locationRatio: location,
        boundary,
        ellipsis,
        maxHeight,
        hasAfterSlot: hasAfter,
      })
  const native = nativeMode !== null
  const single = !expanded && maxLines === 1 && !result.fallback
  const visibleText
    = native || expanded || result.source !== source ? source : result.text
  const rewritten = !native && !expanded && clamped
  const canPredict
    = !expanded
      && !!predictor?.supports({
        boundary,
        ellipsis,
        lineLimit: maxLines,
        locationRatio: normalizeLocationRatio(location),
        maxHeight,
      })
  const predictionActiveRef = useRef(false)
  const predictionRevealedRef = useRef(false)
  const predictionSizesRef = useRef<{
    rootWidth: number
    beforeWidth: number
    afterWidth: number
  } | null>(null)
  const rootRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLSpanElement>(null)
  const bodyRef = useRef<HTMLSpanElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const beforeRef = useRef<HTMLSpanElement>(null)
  const afterRef = useRef<HTMLSpanElement>(null)
  const lastNotifiedRef = useRef<boolean | undefined>(undefined)

  const resultRef = useRef(result)
  const observerRef = useRef<ResizeObserver | null>(null)
  useBrowserLayoutEffect(() => {
    if (!canPredict) {
      // React last rendered the full source while prediction owned this Text
      // node. Restore it explicitly when returning DOM ownership to React.
      if (predictionActiveRef.current && textRef.current) {
        const node = textRef.current.firstChild
        if (node instanceof Text)
          node.data = source
        else textRef.current.replaceChildren(document.createTextNode(source))
        textRef.current.style.visibility = ''
      }
      resultRef.current = result
      predictionActiveRef.current = false
      predictionRevealedRef.current = false
      predictionSizesRef.current = null
    }
    for (const element of [beforeRef.current, afterRef.current]) {
      if (element)
        observerRef.current?.observe(element)
    }
  })

  useImperativeHandle(forwardedRef, () => ({
    ...state,
    element: rootRef.current,
  }))

  useBrowserLayoutEffect(() => {
    const root = rootRef.current
    const content = contentRef.current
    const body = html === undefined && !inline ? textRef.current : bodyRef.current
    if (!root || !content || !body)
      return
    let disposed = false

    const update = (
      sizes?: NonNullable<typeof predictionSizesRef.current>,
      force = false,
    ): void => {
      if (disposed)
        return
      if (canPredict && predictor && maxLines !== undefined) {
        if (!predictionActiveRef.current) {
          predictor.invalidate()
          predictionActiveRef.current = true
        }
        if (force)
          predictor.invalidate()
        // The first prediction is committed during ResizeObserver delivery. A
        // prop-only update can reuse delivered geometry; never synchronously
        // read layout on this path, including at zero width.
        sizes ??= predictionSizesRef.current ?? undefined
        if (!sizes)
          return
        predictionSizesRef.current = sizes
        const predicted = predictor.predict({
          ...sizes,
          text: source,
          ellipsis,
          lineLimit: maxLines,
          textElement: body,
        })
        if (predicted) {
          const previous = resultRef.current
          const textNode = body.firstChild
          if (textNode instanceof Text) {
            if (textNode.data !== predicted.text)
              textNode.data = predicted.text
          }
          else {
            body.replaceChildren(document.createTextNode(predicted.text))
          }
          predictionRevealedRef.current = true
          body.style.visibility = ''
          resultRef.current = {
            source,
            text: predicted.text,
            clamped: predicted.clamped,
            fallback: false,
          }
          // Width changes own only the Text node. React renders semantic state
          // changes so refs/events/affixes remain current without rerendering
          // every predicted prefix.
          if (previous.source !== source || previous.clamped !== predicted.clamped || previous.fallback) {
            setResult(resultRef.current)
          }
          return
        }
        return
      }
      const rootWidth = root.getBoundingClientRect().width
      if (rootWidth <= 0)
        return
      let nextText = source
      let nextClamped = false
      let fallback = false
      if (html !== undefined && (native || expanded || !source || (maxLines === undefined && maxHeight === undefined))) {
        richMeasurementRef.current!.restore(body, html)
      }
      if (
        !expanded
        && source
        && (maxLines !== undefined || maxHeight !== undefined)
      ) {
        if (native) {
          nextClamped = measureNativeClamped(single ? body : content, nativeMode!, rootWidth) ?? false
        }
        else if (html !== undefined) {
          const probeRoot = richProbeRef.current
          if (probeRoot) {
            const measured = richMeasurementRef.current!.measure({
              html,
              boundary,
              ellipsis,
              lineLimit: maxLines,
              maxHeight,
              width: rootWidth,
              body,
              probeRoot,
              before: beforeRef.current,
              after: afterRef.current,
            })
            fallback = measured.fallback
            nextClamped = measured.clamped
          }
        }
        else {
          if (!inline) {
            const textStyle = getComputedStyle(body)
            const hasAffixes = !!beforeRef.current || !!afterRef.current
            const layoutKey = [beforeRef.current, afterRef.current].map((element) => {
              if (!element)
                return ''
              const rect = element.getBoundingClientRect()
              return `${rect.width},${rect.height}`
            }).join('|')
            const metricKey = `${layoutKey}\n${textLayoutMetricKey(textStyle)}`
            if (lineFitCacheRef.current?.key !== metricKey) {
              if (lineFitCacheRef.current)
                textHintRef.current = null
              const fit = maxLines !== undefined && maxHeight === undefined ? simpleLineFitFromStyle(textStyle) : undefined
              lineFitCacheRef.current = { key: metricKey, fit: fit && hasAffixes ? { lineHeight: fit.lineHeight, verifyOverflow: true } : fit }
            }
            const task = searchTextLayout({
              root,
              content,
              target: body,
              rootWidth,
              prepared,
              ellipsis,
              ratio: location,
              lineLimit: maxLines,
              maxHeight,
              hint: textHintRef.current,
              hasAffixes,
              layoutKey,
              lineCapacity: estimateLineCapacity(root, maxHeight, maxLines, textStyle.lineHeight),
              simpleLineFit: lineFitCacheRef.current.fit,
              searchCandidates: boundary === 'grapheme' && location === 1 && maxLines !== undefined && maxHeight === undefined
                ? input => searchLineEndCandidates(input, { content, target: body, rootWidth, lineLimit: maxLines, style: textStyle })
                : undefined,
            })
            void measureLayout(task, () => !disposed, (measured) => {
              if (!measured)
                return
              textHintRef.current = measured
              nextText = measured.text
              nextClamped = (!measured.fullPrepared && measured.kept < measured.boundaryOffsets.length - 1)
                || (maxLines === 1 && root.scrollWidth > root.clientWidth + 0.5)
              if (resultRef.current.source !== source || resultRef.current.text !== nextText || resultRef.current.clamped !== nextClamped) {
                resultRef.current = { source, text: nextText, clamped: nextClamped, fallback: false }
                setResult(resultRef.current)
              }
            }, false)
            return
          }
          void measureLayout(inlineSearchRef.current!.search({ root, target: body, prepared, ellipsis, ratio: location, split, rootWidth }), () => !disposed, (next) => {
            if (next === null)
              return
            nextText = next
            nextClamped = nextText !== source
          }, false)
        }
      }
      // Do not enqueue a layout update at all for an unchanged result. React 18
      // can otherwise keep committing this effect while a previous lane is pending.
      if (
        resultRef.current.source !== source
        || resultRef.current.text !== nextText
        || resultRef.current.clamped !== nextClamped
        || resultRef.current.fallback !== fallback
      ) {
        resultRef.current = {
          source,
          text: nextText,
          clamped: nextClamped,
          fallback,
        }
        setResult(resultRef.current)
      }
    }

    update()
    if (expanded || (maxLines === undefined && maxHeight === undefined))
      return () => { disposed = true }
    const observedSizes = new Map<Element, { width: number, height: number }>()
    if (inline)
      observedSizes.set(root, { width: root.getBoundingClientRect().width, height: 0 })
    const observer = new ResizeObserver((entries) => {
      let changed = false
      for (const entry of entries) {
        const previous = observedSizes.get(entry.target)
        const box = entry.borderBoxSize?.[0]
        const next = {
          width: box?.inlineSize ?? entry.contentRect.width,
          height: box?.blockSize ?? entry.contentRect.height,
        }
        // Text commits change our own height; only width (and explicit height
        // constraints) invalidates fitting. Affixes can change in both axes.
        const tracksHeight
          = entry.target !== content
            && (entry.target !== root || maxHeight !== undefined)
        if (
          !previous
          || next.width !== previous.width
          || (tracksHeight && Math.abs(next.height - previous.height) > 0.5)
        ) {
          changed = true
        }
        observedSizes.set(entry.target, next)
      }
      if (!changed)
        return
      if (!canPredict) {
        update()
        return
      }
      const sizes = { rootWidth: Number.NaN, beforeWidth: beforeRef.current ? Number.NaN : 0, afterWidth: afterRef.current ? Number.NaN : 0, ...predictionSizesRef.current }
      for (const entry of entries) {
        const width
          = entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width
        if (entry.target === root)
          sizes.rootWidth = entry.contentRect.width
        if (entry.target === beforeRef.current)
          sizes.beforeWidth = width
        if (entry.target === afterRef.current)
          sizes.afterWidth = width
      }
      if (!beforeRef.current)
        sizes.beforeWidth = 0
      if (!afterRef.current)
        sizes.afterWidth = 0
      update(sizes)
    })
    observerRef.current = observer
    for (const element of [
      root,
      canPredict || inline ? null : content,
      beforeRef.current,
      afterRef.current,
    ]) {
      if (element)
        observer.observe(element)
    }
    const refresh = (): void => update(undefined, true)
    const mutations = new MutationObserver((records) => {
      if (onlyWidthChanges(records, root))
        return // ResizeObserver handles width changes once.
      refresh()
    })
    for (
      let ancestor: HTMLElement | null = root;
      ancestor;
      ancestor = ancestor.parentElement
    ) {
      mutations.observe(ancestor, {
        attributes: true,
        attributeOldValue: true,
        attributeFilter: ['class', 'style', 'dir', 'hidden'],
      })
    }
    let cancelFontFrame = (): void => {}
    const refreshFont = (): void => {
      if (disposed)
        return
      cancelFontFrame()
      // Refresh after the font is applied to browser line boxes.
      cancelFontFrame = scheduleFontFrame(refresh)
    }
    // Older WebKit may resolve ready without dispatching loadingdone.
    const fontLoading = (): void => {
      void document.fonts.ready.then(refreshFont)
    }
    document.fonts?.addEventListener('loading', fontLoading)
    content.addEventListener('load', refresh, true)
    document.fonts?.addEventListener('loadingdone', refreshFont)
    document.fonts?.addEventListener('loadingerror', refreshFont)
    if (document.fonts?.status === 'loading')
      void document.fonts.ready.then(refreshFont)
    return () => {
      disposed = true
      cancelFontFrame()
      content.removeEventListener('load', refresh, true)
      observerRef.current = null
      observer.disconnect()
      mutations.disconnect()
      document.fonts?.removeEventListener('loading', fontLoading)
      document.fonts?.removeEventListener('loadingdone', refreshFont)
      document.fonts?.removeEventListener('loadingerror', refreshFont)
    }
  }, [
    source,
    prepared,
    as,
    maxLines,
    maxHeight,
    location,
    boundary,
    ellipsis,
    expanded,
    before,
    after,
    style,
    attrs.className,
    native,
    single,
    canPredict,
    predictor,
    hasAfter,
  ])

  useEffect(() => {
    if (lastNotifiedRef.current !== clamped) {
      lastNotifiedRef.current = clamped
      onClampChange?.(clamped)
    }
  }, [clamped, onClampChange])

  const Tag = (as ?? (inline ? 'span' : 'div')) as ElementType
  const affixStyle: CSSProperties = single
    ? { display: 'inline-block', flex: '0 0 auto', whiteSpace: 'pre' }
    : { display: 'inline-block', whiteSpace: 'normal' }
  const contentStyle: CSSProperties = native
    ? getNativeContentStyle(nativeMode, maxLines)!
    : single && !inline && html !== undefined
      ? {
          display: 'flex',
          alignItems: 'baseline',
          whiteSpace: 'nowrap',
          minWidth: 0,
        }
      : {
          display:
          native || canPredict
            ? '-webkit-box'
            : html !== undefined
              ? 'inline'
              : 'inline',
          ...(native || canPredict
            ? {
                WebkitLineClamp: maxLines,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }
            : {}),
        }
  const bodyStyle: CSSProperties | undefined = single && native
    ? {
        display: 'block',
        flex: '1 1 auto',
        whiteSpace: 'nowrap',
        minWidth: 0,
        ...(native ? { overflow: 'hidden', textOverflow: 'ellipsis' } : {}),
      }
    : undefined

  return (
    <Tag
      {...attrs}
      ref={
        rootRef as React.Ref<
          HTMLDivElement & HTMLParagraphElement & HTMLSpanElement
        >
      }
      data-clamped={clamped}
      data-expanded={expanded}
      data-part="root"
      style={{
        display: inline ? 'inline-block' : 'block',
        minWidth: 0,
        maxWidth: '100%',
        ...(!result.fallback ? { overflow: 'hidden' } : {}),
        ...(inline ? { width: '100%', verticalAlign: 'baseline', whiteSpace: 'nowrap' } : {}),
        ...(!expanded && !result.fallback && maxHeight !== undefined
          ? { maxHeight }
          : {}),
        ...style,
        ...(inline ? { display: 'inline-block', whiteSpace: 'nowrap' } : {}),
      }}
    >
      {rewritten && html === undefined && inline && (
        <span data-part="source" style={hiddenStyle}>
          {accessibleText}
        </span>
      )}
      <span data-part="content" ref={contentRef} style={contentStyle}>
        {Children.toArray(beforeContent).some(node => node !== '') && (
          <span
            data-part={inline ? 'start' : 'before'}
            ref={beforeRef}
            style={affixStyle}
            aria-hidden={(inline && rewritten) || undefined}
          >
            {beforeContent}
          </span>
        )}
        <span
          data-part="body"
          ref={bodyRef}
          style={bodyStyle}
          aria-hidden={html === undefined && inline ? rewritten || undefined : undefined}
          {...(html !== undefined
            ? { dangerouslySetInnerHTML: { __html: html } }
            : {})}
        >
          {html === undefined
            ? inline
              ? visibleText
              : (
                  <>
                    {(rewritten || canPredict) && <span data-part="source" style={hiddenStyle}>{accessibleText}</span>}
                    <span ref={textRef} aria-hidden={(rewritten || canPredict) || undefined} style={canPredict ? { visibility: predictionRevealedRef.current ? undefined : 'hidden' } : native && single ? { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : undefined}>{canPredict ? source : visibleText}</span>
                  </>
                )
            : undefined}
        </span>
        {hasAfter && (
          <span
            data-part={inline ? 'end' : 'after'}
            ref={afterRef}
            style={affixStyle}
            aria-hidden={(inline && rewritten) || undefined}
          >
            {afterContent}
          </span>
        )}
      </span>
      {html !== undefined && !native && (
        <span aria-hidden="true" ref={richProbeRef} style={richProbeStyle} />
      )}
    </Tag>
  )
})

// eslint-disable-next-line react/no-forward-ref -- Required by React 18 consumers.
export const LineClamp = forwardRef<ClampHandle, LineClampProps>(
  // eslint-disable-next-line prefer-arrow-callback -- Preserve the public render name for React DevTools.
  function LineClamp(props, ref) {
    return <Clamp {...props} ref={ref} />
  },
)

// eslint-disable-next-line react/no-forward-ref -- Required by React 18 consumers.
export const InlineClamp = forwardRef<ClampHandle, InlineClampProps>(
  // eslint-disable-next-line prefer-arrow-callback -- Preserve the public render name for React DevTools.
  function InlineClamp(props, ref) {
    return <Clamp {...props} ref={ref} inline />
  },
)

// eslint-disable-next-line react/no-forward-ref -- Required by React 18 consumers.
export const RichLineClamp = forwardRef<ClampHandle, RichLineClampProps>(
  // eslint-disable-next-line prefer-arrow-callback -- Preserve the public render name for React DevTools.
  function RichLineClamp(props, ref) {
    return <Clamp {...props} ref={ref} location="end" />
  },
)
