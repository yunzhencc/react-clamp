import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from 'react'
import type { ClampHandle, ClampState } from './Clamp.js'
import type { ClampLength, ClampTag } from './layout.js'
import {
  Children,
  forwardRef,
  isValidElement,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { findLargestFittingCount } from './engine/search.js'
import {
  averageItemWidth,
  findItemElements,
  itemWidthAt,
  measureSequence,
  showItemCandidate,
  simulateStaticFlow,
} from './engine/wrap-flow.js'
import {

  cssLength,
  normalizeLineLimit,
  onlyWidthChanges,
} from './layout.js'

export interface WrapClampState<T = ReactNode> extends ClampState {
  visibleCount: number
  hiddenCount: number
  hiddenItems: readonly T[]
}
export interface WrapClampHandle<T = ReactNode>
  extends ClampHandle,
  WrapClampState<T> {}
export interface WrapClampProps<T = ReactNode>
  extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** Each direct child is one indivisible item. Supply stable keys for lists. */
  children?: ReactNode
  as?: ClampTag
  items?: readonly T[]
  itemKey?: keyof T | ((item: T, index: number) => string | number)
  renderItem?: (item: T, index: number) => ReactNode
  before?: ReactNode | ((state: WrapClampState<T>) => ReactNode)
  after?: ReactNode | ((state: WrapClampState<T>) => ReactNode)
  /** Omit both limits to show every item. */
  maxLines?: number
  maxHeight?: ClampLength
  gap?: CSSProperties['gap']
  expanded?: boolean
  defaultExpanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  onClampChange?: (clamped: boolean) => void
  more?: ReactNode | ((state: WrapClampState<T>) => ReactNode)
}
const useBrowserLayoutEffect
  = typeof document === 'undefined' ? useEffect : useLayoutEffect

// React 18 requires forwardRef; keep the generic render name for DevTools.
// eslint-disable-next-line prefer-arrow-callback, react/no-forward-ref
const WrapClampImpl = forwardRef(function WrapClamp<T>(
  {
    children,
    as = 'div',
    items: dataItems,
    itemKey,
    renderItem,
    before,
    after,
    maxLines: requestedLines,
    maxHeight: requestedHeight,
    gap,
    expanded: controlledExpanded,
    defaultExpanded = false,
    onExpandedChange,
    onClampChange,
    more,
    style,
    className,
    ...attrs
  }: WrapClampProps<T>,
  forwardedRef: React.ForwardedRef<WrapClampHandle<T>>,
): React.ReactElement {
  const maxLines = normalizeLineLimit(requestedLines)
  const maxHeight = cssLength(requestedHeight)
  const items
    // eslint-disable-next-line react/no-children-to-array -- Normalize nested children and preserve their React keys.
    = dataItems ?? (Children.toArray(children) as unknown as readonly T[])
  const total = items.length
  const [localExpanded, setLocalExpanded] = useState(defaultExpanded)
  const expanded = controlledExpanded ?? localExpanded
  const constrained = maxLines !== undefined || maxHeight !== undefined
  const initialFrontier
    = dataItems && !expanded && constrained ? Math.min(total, 32) : total
  const [frontier, setFrontier] = useState(initialFrontier)
  const candidateTotal
    = dataItems && !expanded && constrained ? Math.min(frontier, total) : total
  const [result, setResult] = useState({
    visible: initialFrontier,
    settled: false,
  })
  const visibleCount = expanded ? total : Math.min(result.visible, total)
  const hiddenCount = total - visibleCount
  const clamped = hiddenCount > 0
  const changeExpanded = (next: boolean): void => {
    if (next === expanded)
      return
    if (controlledExpanded === undefined)
      setLocalExpanded(next)
    onExpandedChange?.(next)
  }
  const state: WrapClampState<T> = {
    clamped,
    expanded,
    visibleCount,
    hiddenCount,
    hiddenItems: items.slice(visibleCount),
    expand: () => changeExpanded(true),
    collapse: () => changeExpanded(false),
    toggle: () => changeExpanded(!expanded),
  }
  const rootRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const beforeRef = useRef<HTMLDivElement>(null)
  const moreRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<{ low: number, high: number, best: number } | null>(
    null,
  )
  const inputs = [
    children,
    dataItems,
    itemKey,
    renderItem,
    before,
    after,
    as,
    maxLines,
    maxHeight,
    gap,
    expanded,
    more,
    style,
    className,
  ]
  const previousInputsRef = useRef(inputs)
  const lastNotifiedRef = useRef<boolean | undefined>(undefined)
  const stableVisibleRef = useRef(0)
  const measuredSizesRef = useRef(
    new Map<Element, { width: number, height: number }>(),
  )
  const resizeRef = useRef<ResizeObserver | null>(null)
  const measuredWidthRef = useRef(0)
  const widthFromObserverRef = useRef(false)
  const itemWidthsRef = useRef<number[]>([])
  const plannedGrowRef = useRef(false)
  const verifyGrowRef = useRef(false)
  useImperativeHandle(forwardedRef, () => ({
    ...state,
    element: rootRef.current,
  }))

  // Candidate rendering must settle from DOM measurements before paint.
  /* eslint-disable react/set-state-in-effect */
  useBrowserLayoutEffect(() => {
    const root = rootRef.current
    const content = contentRef.current
    if (!root || !content)
      return
    for (const [element] of measuredSizesRef.current) {
      if (element.parentElement !== content) {
        resizeRef.current?.unobserve(element)
        measuredSizesRef.current.delete(element)
      }
    }
    for (const element of content.children) {
      resizeRef.current?.observe(element, { box: 'border-box' })
      if ((element as HTMLElement).style.display === 'none')
        measuredSizesRef.current.set(element, { width: 0, height: 0 })
    }
    if (result.settled)
      stableVisibleRef.current = visibleCount
    if (
      inputs.some((value, i) => !Object.is(value, previousInputsRef.current[i]))
    ) {
      if (dataItems !== previousInputsRef.current[1] || itemKey !== previousInputsRef.current[2]) {
        itemWidthsRef.current = []
      }
      previousInputsRef.current = inputs
      widthFromObserverRef.current = false
      searchRef.current = null
      plannedGrowRef.current = false
      verifyGrowRef.current = false
      const nextWidth = root.getBoundingClientRect().width
      if (
        dataItems && !expanded && maxLines !== undefined && maxHeight === undefined
        && before === undefined && after === undefined && more === undefined
        && nextWidth > measuredWidthRef.current + 0.5 && itemWidthsRef.current.length > 0
        && ['normal', '0px'].includes(getComputedStyle(content).columnGap)
      ) {
        const known = simulateStaticFlow({
          containerWidth: nextWidth,
          itemCount: total,
          itemWidth: index => itemWidthsRef.current[index] ?? null,
          lineLimit: maxLines,
        })
        const average = averageItemWidth(itemWidthsRef.current)
        if (known.fitCount > stableVisibleRef.current && average !== null) {
          const estimate = simulateStaticFlow({
            containerWidth: nextWidth,
            itemCount: total,
            itemWidth: index => itemWidthAt(itemWidthsRef.current, index, average),
            lineLimit: maxLines,
          })
          const upper = Math.min(total, Math.max(known.fitCount + 1, estimate.fitCount + 1))
          measuredWidthRef.current = nextWidth
          plannedGrowRef.current = true
          setFrontier(upper)
          setResult({ visible: known.fitCount, settled: false })
          return
        }
      }
      setFrontier(initialFrontier)
      if (result.visible !== initialFrontier || result.settled) {
        setResult({ visible: initialFrontier, settled: false })
        return
      }
    }
    if (result.settled)
      return
    if (!searchRef.current && !widthFromObserverRef.current)
      measuredWidthRef.current = root.getBoundingClientRect().width
    if (measuredWidthRef.current <= 0)
      return
    if (
      expanded
      || total === 0
      || (maxLines === undefined && maxHeight === undefined)
    ) {
      searchRef.current = null
      setResult({ visible: total, settled: true })
      return
    }
    const limits = {
      clipToRootHeight: maxHeight !== undefined,
      lineLimit: maxLines,
    }
    const measure = (): ReturnType<typeof measureSequence> => {
      const measurement = measureSequence(root, content, limits, {
        recordItemWidth: (index, width) => { itemWidthsRef.current[index] = width },
      })
      // The React children API promises whole items; a child wider than its
      // container cannot fit. The data/items API preserves upstream clipping.
      if (dataItems === undefined) {
        const bounds = content.getBoundingClientRect()
        const overflows = findItemElements(content).some((element) => {
          if (element.style.display === 'none')
            return false
          const box = element.getBoundingClientRect()
          return box.left < bounds.left - 0.5 || box.right > bounds.right + 0.5
        })
        if (overflows)
          return { ...measurement, allFit: false }
      }
      return measurement
    }
    if (plannedGrowRef.current && candidateTotal > result.visible) {
      plannedGrowRef.current = false
      const elements = findItemElements(content)
      let shown = result.visible
      const measureCandidate = (count: number): ReturnType<typeof measureSequence> => {
        shown = showItemCandidate(elements, shown, count)
        return measure()
      }
      const fitsCandidate = (count: number): boolean => {
        const measured = measureCandidate(count)
        return measured.allFit && measured.visibleItems === count
      }
      let best: number
      if (candidateTotal - result.visible <= 2) {
        best = findLargestFittingCount(result.visible, candidateTotal, fitsCandidate)
      }
      else {
        const upper = measureCandidate(candidateTotal)
        if (upper.allFit && upper.visibleItems === candidateTotal) {
          best = candidateTotal
        }
        else {
          const frontier = Math.max(result.visible, Math.min(candidateTotal - 1, upper.visibleItems))
          const successor = frontier + 1
          best = successor === candidateTotal || !fitsCandidate(successor)
            ? frontier
            : findLargestFittingCount(successor, candidateTotal - 1, fitsCandidate)
        }
      }
      showItemCandidate(elements, shown, result.visible)
      verifyGrowRef.current = best < candidateTotal
      setFrontier(best)
      setResult({ visible: best, settled: false })
      return
    }
    const measurement = measure()
    const fits = measurement.allFit
    if (verifyGrowRef.current) {
      verifyGrowRef.current = false
      if (fits && measurement.visibleItems === result.visible) {
        setResult({ visible: result.visible, settled: true })
        return
      }
    }
    if (result.visible === candidateTotal && fits) {
      if (candidateTotal < total) {
        const next = Math.min(total, Math.max(1, candidateTotal * 2))
        searchRef.current = null
        setFrontier(next)
        setResult({ visible: next, settled: false })
        return
      }
      setResult({ visible: total, settled: true })
      return
    }
    if (!searchRef.current) {
      searchRef.current = {
        low: fits ? result.visible + 1 : 0,
        high: fits ? candidateTotal : result.visible - 1,
        best: fits ? result.visible : 0,
      }
    }
    else if (fits) {
      searchRef.current.best = result.visible
      searchRef.current.low = result.visible + 1
    }
    else {
      searchRef.current.high = result.visible - 1
    }
    const { low, high, best } = searchRef.current
    // ponytail: binary search assumes fewer items fit at least as easily. Custom
    // count labels with irregular widths can be conservative; use exhaustive search
    // if non-monotone renderers become a requirement. Every probe uses real React DOM.
    if (low > high) {
      searchRef.current = null
      setResult({ visible: best, settled: true })
    }
    else {
      setResult({ visible: Math.floor((low + high) / 2), settled: false })
    }
  })

  /* eslint-enable react/set-state-in-effect */

  useBrowserLayoutEffect(() => {
    const root = rootRef.current
    const content = contentRef.current
    if (!root || !content)
      return
    let disposed = false
    const restart = (): void => {
      if (disposed)
        return
      searchRef.current = null
      const next
        = dataItems && !expanded && constrained
          ? Math.min(total, Math.max(1, stableVisibleRef.current + 1))
          : total
      setFrontier(next)
      setResult({
        visible:
          dataItems && !expanded && constrained
            ? Math.min(stableVisibleRef.current, total)
            : next,
        settled: false,
      })
    }
    const resize = new ResizeObserver((entries) => {
      let changed = false
      for (const entry of entries) {
        const box = entry.borderBoxSize?.[0]
        const next = {
          width: box?.inlineSize ?? entry.contentRect.width,
          height: box?.blockSize ?? entry.contentRect.height,
        }
        if (entry.target === root) {
          if (Math.abs(next.width - measuredWidthRef.current) > 0.5)
            changed = true
          measuredWidthRef.current = next.width
          widthFromObserverRef.current = true
        }
        else {
          const previous = measuredSizesRef.current.get(entry.target)
          if (
            !previous
            || Math.abs(next.width - previous.width) > 0.5
            || Math.abs(next.height - previous.height) > 0.5
          ) {
            changed = true
          }
          measuredSizesRef.current.set(entry.target, next)
        }
      }
      if (changed)
        restart()
    })
    resizeRef.current = resize
    resize.observe(root, { box: 'border-box' })
    for (const child of content.children)
      resize.observe(child, { box: 'border-box' })
    const mutations = new MutationObserver((records) => {
      if (onlyWidthChanges(records, root))
        return
      if (
        records.some((record) => {
          const target
            = record.target instanceof Element
              ? record.target
              : record.target.parentElement
          return (
            target
            && target.isConnected
            && target !== content
            && !moreRef.current?.contains(target)
            && !beforeRef.current?.contains(target)
            && !(
              record.type === 'attributes'
              && target.getAttribute('data-part') === 'item'
            )
          )
        })
      ) {
        restart()
      }
    })
    // Observe child-owned changes (including hidden children), not probe visibility.
    mutations.observe(content, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
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
    const fontLoading = (): void => {
      void document.fonts.ready.then(restart)
    }
    document.fonts?.addEventListener('loading', fontLoading)
    document.fonts?.addEventListener('loadingdone', restart)
    document.fonts?.addEventListener('loadingerror', restart)
    content.addEventListener('load', restart, true)
    return () => {
      disposed = true
      resize.disconnect()
      resizeRef.current = null
      mutations.disconnect()
      document.fonts?.removeEventListener('loading', fontLoading)
      document.fonts?.removeEventListener('loadingdone', restart)
      document.fonts?.removeEventListener('loadingerror', restart)
      content.removeEventListener('load', restart, true)
    }
  }, [
    children,
    dataItems,
    itemKey,
    renderItem,
    before,
    after,
    as,
    maxLines,
    maxHeight,
    gap,
    expanded,
    more,
    style,
    className,
  ])

  useEffect(() => {
    if (result.settled && lastNotifiedRef.current !== clamped) {
      lastNotifiedRef.current = clamped
      onClampChange?.(clamped)
    }
  }, [result.settled, clamped, onClampChange])

  const renderSlot = (slot: WrapClampProps<T>['after']): ReactNode =>
    typeof slot === 'function' ? slot(state) : slot
  const beforeContent = renderSlot(before)
  const moreContent
    = after !== undefined
      ? (
          renderSlot(after)
        )
      : more === undefined && dataItems
        ? null
        : more === undefined
          ? (
              <button
                type="button"
                aria-expanded={expanded}
                aria-label={
                  expanded ? 'Collapse items' : `Show ${hiddenCount} more items`
                }
                onClick={state.toggle}
              >
                {expanded ? 'Less' : `+${hiddenCount}`}
              </button>
            )
          : (
              renderSlot(more)
            )
  const hasContent = (content: ReactNode): boolean =>
    // eslint-disable-next-line react/no-children-to-array -- Use the same child normalization as the item list.
    Children.toArray(content).some(child => child !== '')
  const Tag = as as ElementType
  return (
    <Tag
      {...attrs}
      ref={rootRef}
      className={className}
      data-part="root"
      data-clamped={clamped}
      data-expanded={expanded}
      style={{
        minWidth: 0,
        maxWidth: '100%',
        overflow: 'hidden',
        ...(!expanded && maxHeight !== undefined ? { maxHeight } : {}),
        ...style,
      }}
    >
      <div
        ref={contentRef}
        data-part="content"
        style={{
          display: 'inline-flex',
          flexWrap: 'wrap',
          maxWidth: '100%',
          width: '100%',
          gap,
        }}
      >
        {hasContent(beforeContent) && (
          <div
            ref={beforeRef}
            data-part="before"
            style={{
              display: 'inline-flex',
              maxWidth: '100%',
              verticalAlign: 'baseline',
              whiteSpace: 'nowrap',
            }}
          >
            {beforeContent}
          </div>
        )}
        {items
          .slice(
            0,
            dataItems && !expanded && constrained
              ? result.settled
                ? visibleCount
                : candidateTotal
              : total,
          )
          .map((item, index) => (
            <div
              key={
                dataItems
                  ? typeof itemKey === 'function'
                    ? itemKey(item, index)
                    : itemKey
                      ? String(item[itemKey])
                      // eslint-disable-next-line react/no-array-index-key -- Positional fallback when the caller omits itemKey.
                      : index
                  : isValidElement(item)
                    ? item.key
                    // eslint-disable-next-line react/no-array-index-key -- Primitive children have no React key.
                    : index
              }
              data-part="item"
              style={{
                display: index < visibleCount ? 'inline-flex' : 'none',
                maxWidth: dataItems === undefined ? undefined : '100%',
                flex: dataItems === undefined ? '0 0 auto' : undefined,
                verticalAlign: 'baseline',
                whiteSpace: 'nowrap',
              }}
            >
              {dataItems ? renderItem?.(item, index) : (item as ReactNode)}
            </div>
          ))}
        {hasContent(moreContent) && (
          <div
            ref={moreRef}
            data-part="after"
            style={{
              display:
              (after !== undefined || clamped || (expanded && total > 0))
              && moreContent != null
              && moreContent !== false
                ? 'inline-flex'
                : 'none',
              maxWidth: '100%',
              verticalAlign: 'baseline',
              whiteSpace: 'nowrap',
            }}
          >
            {moreContent}
          </div>
        )}
      </div>
    </Tag>
  )
})
export const WrapClamp = WrapClampImpl as <T = ReactNode>(
  props: WrapClampProps<T> & React.RefAttributes<WrapClampHandle<T>>,
) => React.ReactElement
