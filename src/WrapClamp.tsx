import {
  Children,
  forwardRef,
  isValidElement,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import {
  rootTag,
  cssLength,
  normalizeLineLimit,
  onlyWidthChanges,
  type ClampLength,
  type ClampTag,
} from "./layout.js";
import type { ClampHandle, ClampState } from "./Clamp.js";
import {
  averageItemWidth,
  findItemElements,
  itemWidthAt,
  measureSequence,
  showItemCandidate,
  simulateStaticFlow,
} from "./engine/wrap-flow.js";
import { findLargestFittingCount } from "./engine/search.js";

export interface WrapClampState<T = ReactNode> extends ClampState {
  visibleCount: number;
  hiddenCount: number;
  hiddenItems: readonly T[];
}
export interface WrapClampHandle<T = ReactNode>
  extends ClampHandle,
    WrapClampState<T> {}
export interface WrapClampProps<T = ReactNode>
  extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /** Each direct child is one indivisible item. Supply stable keys for lists. */
  children?: ReactNode;
  as?: ClampTag;
  items?: readonly T[];
  itemKey?: keyof T | ((item: T, index: number) => string | number);
  renderItem?: (item: T, index: number) => ReactNode;
  before?: ReactNode | ((state: WrapClampState<T>) => ReactNode);
  after?: ReactNode | ((state: WrapClampState<T>) => ReactNode);
  /** Omit both limits to show every item. */
  maxLines?: number;
  maxHeight?: ClampLength;
  gap?: CSSProperties["gap"];
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  onClampChange?: (clamped: boolean) => void;
  more?: ReactNode | ((state: WrapClampState<T>) => ReactNode);
}
const useBrowserLayoutEffect =
  typeof document === "undefined" ? useEffect : useLayoutEffect;

const WrapClampImpl = forwardRef(function WrapClamp<T>(
  {
    children,
    as = "div",
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
) {
  const maxLines = normalizeLineLimit(requestedLines);
  const maxHeight = cssLength(requestedHeight);
  const items =
    dataItems ?? (Children.toArray(children) as unknown as readonly T[]);
  const total = items.length;
  const [localExpanded, setLocalExpanded] = useState(defaultExpanded);
  const expanded = controlledExpanded ?? localExpanded;
  const constrained = maxLines !== undefined || maxHeight !== undefined;
  const initialFrontier =
    dataItems && !expanded && constrained ? Math.min(total, 32) : total;
  const [frontier, setFrontier] = useState(initialFrontier);
  const candidateTotal =
    dataItems && !expanded && constrained ? Math.min(frontier, total) : total;
  const [result, setResult] = useState({
    visible: initialFrontier,
    settled: false,
  });
  const visibleCount = expanded ? total : Math.min(result.visible, total);
  const hiddenCount = total - visibleCount;
  const clamped = hiddenCount > 0;
  const changeExpanded = (next: boolean) => {
    if (next === expanded) return;
    if (controlledExpanded === undefined) setLocalExpanded(next);
    onExpandedChange?.(next);
  };
  const state: WrapClampState<T> = {
    clamped,
    expanded,
    visibleCount,
    hiddenCount,
    hiddenItems: items.slice(visibleCount),
    expand: () => changeExpanded(true),
    collapse: () => changeExpanded(false),
    toggle: () => changeExpanded(!expanded),
  };
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const beforeRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const search = useRef<{ low: number; high: number; best: number } | null>(
    null,
  );
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
  ];
  const previousInputs = useRef(inputs);
  const lastNotified = useRef<boolean | undefined>(undefined);
  const stableVisible = useRef(0);
  const measuredSizes = useRef(
    new Map<Element, { width: number; height: number }>(),
  );
  const resizeRef = useRef<ResizeObserver | null>(null);
  const measuredWidth = useRef(0);
  const widthFromObserver = useRef(false);
  const itemWidths = useRef<number[]>([]);
  const plannedGrow = useRef(false);
  const verifyGrow = useRef(false);
  useImperativeHandle(forwardedRef, () => ({
    ...state,
    element: rootRef.current,
  }));

  useBrowserLayoutEffect(() => {
    const root = rootRef.current;
    const content = contentRef.current;
    if (!root || !content) return;
    for (const [element] of measuredSizes.current) {
      if (element.parentElement !== content) {
        resizeRef.current?.unobserve(element);
        measuredSizes.current.delete(element);
      }
    }
    for (const element of content.children) {
      resizeRef.current?.observe(element, { box: "border-box" });
      if ((element as HTMLElement).style.display === "none")
        measuredSizes.current.set(element, { width: 0, height: 0 });
    }
    if (result.settled) stableVisible.current = visibleCount;
    if (
      inputs.some((value, i) => !Object.is(value, previousInputs.current[i]))
    ) {
      if (dataItems !== previousInputs.current[1] || itemKey !== previousInputs.current[2]) {
        itemWidths.current = [];
      }
      previousInputs.current = inputs;
      widthFromObserver.current = false;
      search.current = null;
      plannedGrow.current = false;
      verifyGrow.current = false;
      const nextWidth = root.getBoundingClientRect().width;
      if (
        dataItems && !expanded && maxLines !== undefined && maxHeight === undefined &&
        before === undefined && after === undefined && more === undefined &&
        nextWidth > measuredWidth.current + 0.5 && itemWidths.current.length > 0 &&
        ["normal", "0px"].includes(getComputedStyle(content).columnGap)
      ) {
        const known = simulateStaticFlow({
          containerWidth: nextWidth,
          itemCount: total,
          itemWidth: (index) => itemWidths.current[index] ?? null,
          lineLimit: maxLines,
        });
        const average = averageItemWidth(itemWidths.current);
        if (known.fitCount > stableVisible.current && average !== null) {
          const estimate = simulateStaticFlow({
            containerWidth: nextWidth,
            itemCount: total,
            itemWidth: (index) => itemWidthAt(itemWidths.current, index, average),
            lineLimit: maxLines,
          });
          const upper = Math.min(total, Math.max(known.fitCount + 1, estimate.fitCount + 1));
          measuredWidth.current = nextWidth;
          plannedGrow.current = true;
          setFrontier(upper);
          setResult({ visible: known.fitCount, settled: false });
          return;
        }
      }
      setFrontier(initialFrontier);
      if (result.visible !== initialFrontier || result.settled) {
        setResult({ visible: initialFrontier, settled: false });
        return;
      }
    }
    if (result.settled) return;
    if (!search.current && !widthFromObserver.current)
      measuredWidth.current = root.getBoundingClientRect().width;
    if (measuredWidth.current <= 0) return;
    if (
      expanded ||
      total === 0 ||
      (maxLines === undefined && maxHeight === undefined)
    ) {
      search.current = null;
      setResult({ visible: total, settled: true });
      return;
    }
    const limits = {
      clipToRootHeight: maxHeight !== undefined,
      lineLimit: maxLines,
    };
    const measure = () => {
      const measurement = measureSequence(root, content, limits, {
        recordItemWidth: (index, width) => { itemWidths.current[index] = width; },
      });
      // The React children API promises whole items; a child wider than its
      // container cannot fit. The data/items API preserves upstream clipping.
      if (dataItems === undefined) {
        const bounds = content.getBoundingClientRect();
        const overflows = findItemElements(content).some((element) => {
          if (element.style.display === "none") return false;
          const box = element.getBoundingClientRect();
          return box.left < bounds.left - 0.5 || box.right > bounds.right + 0.5;
        });
        if (overflows) return { ...measurement, allFit: false };
      }
      return measurement;
    };
    if (plannedGrow.current && candidateTotal > result.visible) {
      plannedGrow.current = false;
      const elements = findItemElements(content);
      let shown = result.visible;
      const measureCandidate = (count: number) => {
        shown = showItemCandidate(elements, shown, count);
        return measure();
      };
      const fitsCandidate = (count: number) => {
        const measured = measureCandidate(count);
        return measured.allFit && measured.visibleItems === count;
      };
      let best: number;
      if (candidateTotal - result.visible <= 2) {
        best = findLargestFittingCount(result.visible, candidateTotal, fitsCandidate);
      } else {
        const upper = measureCandidate(candidateTotal);
        if (upper.allFit && upper.visibleItems === candidateTotal) best = candidateTotal;
        else {
          const frontier = Math.max(result.visible, Math.min(candidateTotal - 1, upper.visibleItems));
          const successor = frontier + 1;
          best = successor === candidateTotal || !fitsCandidate(successor)
            ? frontier
            : findLargestFittingCount(successor, candidateTotal - 1, fitsCandidate);
        }
      }
      showItemCandidate(elements, shown, result.visible);
      verifyGrow.current = best < candidateTotal;
      setFrontier(best);
      setResult({ visible: best, settled: false });
      return;
    }
    const measurement = measure();
    const fits = measurement.allFit;
    if (verifyGrow.current) {
      verifyGrow.current = false;
      if (fits && measurement.visibleItems === result.visible) {
        setResult({ visible: result.visible, settled: true });
        return;
      }
    }
    if (result.visible === candidateTotal && fits) {
      if (candidateTotal < total) {
        const next = Math.min(total, Math.max(1, candidateTotal * 2));
        search.current = null;
        setFrontier(next);
        setResult({ visible: next, settled: false });
        return;
      }
      setResult({ visible: total, settled: true });
      return;
    }
    if (!search.current)
      search.current = {
        low: fits ? result.visible + 1 : 0,
        high: fits ? candidateTotal : result.visible - 1,
        best: fits ? result.visible : 0,
      };
    else if (fits) {
      search.current.best = result.visible;
      search.current.low = result.visible + 1;
    } else search.current.high = result.visible - 1;
    const { low, high, best } = search.current;
    // ponytail: binary search assumes fewer items fit at least as easily. Custom
    // count labels with irregular widths can be conservative; use exhaustive search
    // if non-monotone renderers become a requirement. Every probe uses real React DOM.
    if (low > high) {
      search.current = null;
      setResult({ visible: best, settled: true });
    } else setResult({ visible: Math.floor((low + high) / 2), settled: false });
  });

  useBrowserLayoutEffect(() => {
    const root = rootRef.current;
    const content = contentRef.current;
    if (!root || !content) return;
    let disposed = false;
    const restart = () => {
      if (disposed) return;
      search.current = null;
      const next =
        dataItems && !expanded && constrained
          ? Math.min(total, Math.max(1, stableVisible.current + 1))
          : total;
      setFrontier(next);
      setResult({
        visible:
          dataItems && !expanded && constrained
            ? Math.min(stableVisible.current, total)
            : next,
        settled: false,
      });
    };
    const resize = new ResizeObserver((entries) => {
      let changed = false;
      for (const entry of entries) {
        const box = entry.borderBoxSize?.[0];
        const next = {
          width: box?.inlineSize ?? entry.contentRect.width,
          height: box?.blockSize ?? entry.contentRect.height,
        };
        if (entry.target === root) {
          if (Math.abs(next.width - measuredWidth.current) > 0.5)
            changed = true;
          measuredWidth.current = next.width;
          widthFromObserver.current = true;
        } else {
          const previous = measuredSizes.current.get(entry.target);
          if (
            !previous ||
            Math.abs(next.width - previous.width) > 0.5 ||
            Math.abs(next.height - previous.height) > 0.5
          )
            changed = true;
          measuredSizes.current.set(entry.target, next);
        }
      }
      if (changed) restart();
    });
    resizeRef.current = resize;
    resize.observe(root, { box: "border-box" });
    for (const child of content.children)
      resize.observe(child, { box: "border-box" });
    const mutations = new MutationObserver((records) => {
      if (onlyWidthChanges(records, root)) return;
      if (
        records.some((record) => {
          const target =
            record.target instanceof Element
              ? record.target
              : record.target.parentElement;
          return (
            target &&
            target.isConnected &&
            target !== content &&
            !moreRef.current?.contains(target) &&
            !beforeRef.current?.contains(target) &&
            !(
              record.type === "attributes" &&
              target.getAttribute("data-part") === "item"
            )
          );
        })
      )
        restart();
    });
    // Observe child-owned changes (including hidden children), not probe visibility.
    mutations.observe(content, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });
    for (
      let ancestor: HTMLElement | null = root;
      ancestor;
      ancestor = ancestor.parentElement
    ) {
      mutations.observe(ancestor, {
        attributes: true,
        attributeOldValue: true,
        attributeFilter: ["class", "style", "dir", "hidden"],
      });
    }
    const fontLoading = () => {
      void document.fonts.ready.then(restart);
    };
    document.fonts?.addEventListener("loading", fontLoading);
    document.fonts?.addEventListener("loadingdone", restart);
    document.fonts?.addEventListener("loadingerror", restart);
    content.addEventListener("load", restart, true);
    return () => {
      disposed = true;
      resize.disconnect();
      resizeRef.current = null;
      mutations.disconnect();
      document.fonts?.removeEventListener("loading", fontLoading);
      document.fonts?.removeEventListener("loadingdone", restart);
      document.fonts?.removeEventListener("loadingerror", restart);
      content.removeEventListener("load", restart, true);
    };
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
  ]);

  useEffect(() => {
    if (result.settled && lastNotified.current !== clamped) {
      lastNotified.current = clamped;
      onClampChange?.(clamped);
    }
  }, [result.settled, clamped, onClampChange]);

  const renderSlot = (slot: WrapClampProps<T>["after"]) =>
    typeof slot === "function" ? slot(state) : slot;
  const beforeContent = renderSlot(before);
  const moreContent =
    after !== undefined ? (
      renderSlot(after)
    ) : more === undefined && dataItems ? null : more === undefined ? (
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={
          expanded ? "Collapse items" : `Show ${hiddenCount} more items`
        }
        onClick={state.toggle}
      >
        {expanded ? "Less" : `+${hiddenCount}`}
      </button>
    ) : (
      renderSlot(more)
    );
  const hasContent = (content: ReactNode) =>
    Children.toArray(content).some((child) => child !== "");
  const Tag = rootTag(as);
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
        maxWidth: "100%",
        overflow: "hidden",
        ...(!expanded && maxHeight !== undefined ? { maxHeight } : {}),
        ...style,
      }}
    >
      <div
        ref={contentRef}
        data-part="content"
        style={{
          display: "inline-flex",
          flexWrap: "wrap",
          maxWidth: "100%",
          width: "100%",
          gap,
        }}
      >
        {hasContent(beforeContent) && <div
          ref={beforeRef}
          data-part="before"
          style={{
            display: "inline-flex",
            maxWidth: "100%",
            verticalAlign: "baseline",
            whiteSpace: "nowrap",
          }}
        >
          {beforeContent}
        </div>}
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
                  ? typeof itemKey === "function"
                    ? itemKey(item, index)
                    : itemKey
                      ? String(item[itemKey])
                      : index
                  : isValidElement(item)
                    ? item.key
                    : index
              }
              data-part="item"
              style={{
                display: index < visibleCount ? "inline-flex" : "none",
                maxWidth: dataItems === undefined ? undefined : "100%",
                flex: dataItems === undefined ? "0 0 auto" : undefined,
                verticalAlign: "baseline",
                whiteSpace: "nowrap",
              }}
            >
              {dataItems ? renderItem?.(item, index) : (item as ReactNode)}
            </div>
          ))}
        {hasContent(moreContent) && <div
          ref={moreRef}
          data-part="after"
          style={{
            display:
              (after !== undefined || clamped || (expanded && total > 0)) &&
              moreContent != null &&
              moreContent !== false
                ? "inline-flex"
                : "none",
            maxWidth: "100%",
            verticalAlign: "baseline",
            whiteSpace: "nowrap",
          }}
        >
          {moreContent}
        </div>}
      </div>
    </Tag>
  );
});
export const WrapClamp = WrapClampImpl as <T = ReactNode>(
  props: WrapClampProps<T> & React.RefAttributes<WrapClampHandle<T>>,
) => React.ReactElement;
