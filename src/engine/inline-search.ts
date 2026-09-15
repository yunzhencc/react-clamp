import { isContentIndependentWidth, textLayoutMetricKey } from "./layout.js";
import { warmSearchLocalCoverage } from "./search.js";
import { canSkipFullTextFit, estimateTextRankFromFull, shouldRecheckFullTextFit, fallbackSearchPrepared,
 displayTextForKeptCount, searchTextCandidates, matchingTextClampHint, fullTextClampResult,
 nextClampedMaxWidth, setElementText, type PreparedText, type TextClampContext, type TextClampHint, type TextClampResult } from "./text.js";
type InlineSearchInput = {root: HTMLElement; target: HTMLElement; prepared: PreparedText; ellipsis: string; ratio: number; split: unknown; rootWidth?: number};
const fitTolerance = 0.5;
const maxTextSearchHints = 8;
function canTrustCurrentRootWidth(element: HTMLElement) { return isContentIndependentWidth(element.style.width.trim()); }
export function createInlineSearch() {
let lastTextClamp: TextClampResult | null = null;
let lastTextMetricKey: string | null = null;
const textSearchHints = new Map<number, Pick<TextClampHint, "boundaryOffsets" | "kept">>();
function* search(input: InlineSearchInput): Generator<() => number, string | null, number> {
  const {root: rootElement, target: bodyElement, prepared, ellipsis, ratio: locationRatio, split} = input;
  const body = prepared.text;
  const freshRootWidth = input.rootWidth;
  let currentBody = bodyElement.textContent ?? "";

  function applyBodyText(nextBody: string): void {
    if (nextBody !== currentBody) {
      setElementText(bodyElement, nextBody);
      currentBody = nextBody;
    }
  }

  const canMeasureCurrentWidth = currentBody !== body && canTrustCurrentRootWidth(rootElement);
  const context: TextClampContext = {
    ellipsis,
    hasAffixes: false,
    lineCapacity: 1,
    lineLimit: undefined,
    maxHeight: undefined,
    ratio: locationRatio,
    spacing: "preserve-outer",
  };

  if (!canMeasureCurrentWidth) {
    // Content-sized inline-blocks need the full body before measurement.
    // Otherwise a shortened previous result becomes the stale width limit.
    applyBodyText(body);
  }

  const limit = yield () => {
    if (split === undefined) {
      const key = textLayoutMetricKey(getComputedStyle(bodyElement));
      if (lastTextMetricKey !== null && lastTextMetricKey !== key) {
        lastTextClamp = null;
        textSearchHints.clear();
      }
      lastTextMetricKey = key;
    }
    return canMeasureCurrentWidth && freshRootWidth !== undefined
      ? freshRootWidth
      : rootElement.getBoundingClientRect().width;
  };

  if (limit <= 0) {
    // Do not replace visible text with a zero-width guess during mount or hidden
    // layout states.
    applyBodyText(body);
    return null;
  }

  let measuredScrollWidth = 0;
  function* fitsCurrentBody(): Generator<() => number, boolean, number> {
    measuredScrollWidth = yield () => rootElement!.scrollWidth;
    return measuredScrollWidth <= limit + fitTolerance;
  }
  const historicalHint = textSearchHints.get(limit) ?? null;
  const currentHint = matchingTextClampHint(prepared, lastTextClamp, context);
  const searchPrepared =
    split === undefined ? fallbackSearchPrepared(prepared, currentHint) : prepared;
  let textHint =
    currentHint !== null &&
    historicalHint !== null &&
    historicalHint.boundaryOffsets === searchPrepared.boundaryOffsets &&
    historicalHint.kept < searchPrepared.boundaryOffsets.length - 1 &&
    split === undefined &&
    (historicalHint.boundaryOffsets !== currentHint.boundaryOffsets ||
      Math.abs(historicalHint.kept - currentHint.kept) > warmSearchLocalCoverage())
      ? { ...historicalHint, ...context, rootWidth: limit }
      : currentHint;
  // Historical ranks choose a pivot; only the latest compatible layout carries
  // the width observation used to decide whether full text must be measured.
  const skipFullFit =
    split === undefined && canSkipFullTextFit(prepared, currentHint, limit, context);
  let searchAnchor: number | undefined;
  let searchAnchorFits: boolean | undefined;

  if (!skipFullFit) {
    if (
      currentHint &&
      !currentHint.fullPrepared &&
      currentHint.boundaryOffsets === searchPrepared.boundaryOffsets &&
      currentHint.kept < searchPrepared.boundaryOffsets.length - 1 &&
      currentBody ===
        displayTextForKeptCount(
          searchPrepared,
          locationRatio,
          ellipsis,
          currentHint.kept,
          "preserve-outer",
        ) &&
      !prepared.hasCursiveText &&
      !/[\p{Script_Extensions=Arabic}\p{Script_Extensions=Syriac}]/u.test(ellipsis)
    ) {
      searchAnchor = currentHint.kept;
      searchAnchorFits = yield* fitsCurrentBody();
    }
    applyBodyText(body);

    if (yield* fitsCurrentBody()) {
      // Store the full body as the next warm-start point so a following shrink
      // starts from the real upper bound.
      lastTextClamp = fullTextClampResult(prepared, limit, context);
      rememberTextSearchHint(limit, lastTextClamp);
      return body;
    }

    const boundaryCount = prepared.boundaryOffsets.length - 1;
    const coldBoundaryOffsets =
      boundaryCount <= 16 && prepared.fallbackBoundaryOffsets
        ? prepared.fallbackBoundaryOffsets
        : prepared.boundaryOffsets;
    const coldBoundaryCount = coldBoundaryOffsets.length - 1;
    if (
      (textHint === null || textHint.boundaryOffsets !== prepared.boundaryOffsets) &&
      coldBoundaryCount > 16
    ) {
      // A fallback rank is only a pivot. Prefer the current density already
      // measured with the full body before consulting its historical cut.
      // A failed full-body read carries more information than a boolean: for a
      // split line, measure the full body once to exclude fixed affix occupancy.
      // It remains only a hint; the normal measured search proves the result.
      const fullBodyWidth = split
        ? yield () => bodyElement.getBoundingClientRect().width
        : measuredScrollWidth;
      const availableBodyWidth = limit - (measuredScrollWidth - fullBodyWidth);
      const fitRatio = fullBodyWidth > 0 ? Math.max(0, availableBodyWidth / fullBodyWidth) : 0;
      textHint = {
        boundaryOffsets: coldBoundaryOffsets,
        ...context,
        kept: estimateTextRankFromFull({
          prepared,
          offsets: coldBoundaryOffsets,
          ratio: locationRatio,
          fitRatio,
        }),
      };
    }
  }

  if (
    textHint &&
    !textHint.fullPrepared &&
    textHint.rootWidth !== undefined &&
    textHint.rootWidth > 0 &&
    textHint.rootWidth !== limit
  ) {
    const previousKept = textHint.kept;
    textHint = {
      ...textHint,
      kept: Math.max(
        0,
        Math.min(
          textHint.boundaryOffsets.length - 2,
          Math.ceil((textHint.kept * limit) / textHint.rootWidth),
        ),
      ),
    };
    if (
      skipFullFit &&
      textHint.boundaryOffsets === searchPrepared.boundaryOffsets &&
      previousKept < searchPrepared.boundaryOffsets.length - 1 &&
      previousKept !== textHint.kept &&
      currentBody ===
        displayTextForKeptCount(
          searchPrepared,
          locationRatio,
          ellipsis,
          previousKept,
          "preserve-outer",
        )
    ) {
      searchAnchor = previousKept;
    }
  }

  const search = searchTextCandidates({
    anchor: searchAnchor,
    anchorFits: searchAnchorFits,
    ellipsis,
    hint: textHint,
    prepared: searchPrepared,
    ratio: locationRatio,
    // Split affixes already own the outer spacing; preserve spaces at the body
    // edges so custom split functions keep browser-like inline flow.
    spacing: "preserve-outer",
  });
  let step = search.next();
  while (!step.done) {
    applyBodyText(step.value);
    step = search.next(yield* fitsCurrentBody());
  }
  const nextResult = step.value;
  const nextBody = nextResult.text;
  let metricHint = currentHint?.boundaryOffsets === nextResult.boundaryOffsets ? currentHint : null;
  if (skipFullFit && shouldRecheckFullTextFit(currentHint, nextResult, limit)) {
    applyBodyText(body);
    if (yield* fitsCurrentBody()) {
      lastTextClamp = fullTextClampResult(prepared, limit, context);
      rememberTextSearchHint(limit, lastTextClamp);
      return body;
    }
    metricHint = null;
  }
  applyBodyText(nextBody);
  lastTextClamp = {
    ...nextResult,
    ...context,
    ...nextClampedMaxWidth(
      metricHint,
      nextResult.kept,
      limit,
      nextResult.boundaryOffsets.length - 1,
    ),
    rootWidth: limit,
  };
  rememberTextSearchHint(limit, lastTextClamp);
  return nextBody;
}

function rememberTextSearchHint(width: number, result: TextClampResult): void {
  textSearchHints.delete(width);
  // Full results cannot seed a historical cut. Avoid forcing their lazy rank.
  if (result.fullPrepared) return;
  textSearchHints.set(width, {
    boundaryOffsets: result.boundaryOffsets,
    kept: result.kept,
  });

  if (textSearchHints.size > maxTextSearchHints) {
    textSearchHints.delete(textSearchHints.keys().next().value!);
  }
}

return {search, invalidate() { lastTextClamp = null; textSearchHints.clear(); }};
}
