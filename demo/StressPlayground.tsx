import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  InlineClamp,
  LineClamp,
  RichLineClamp,
  WrapClamp,
  type ClampBoundary,
} from "../src";
import { LineClamp as PretextLineClamp } from "../src/pretext";
import { FpsMeter, Range, ScrollArea } from "./widgets";
export type Surface = "line" | "rich" | "inline" | "wrap";
export function StressPlayground({
  initialSurface,
  onClose,
  returnFocus,
}: {
  initialSurface: Surface;
  onClose: () => void;
  returnFocus: HTMLElement | null;
}) {
  const [surface, setSurface] = useState(initialSurface);
  const [count, setCount] = useState(10),
    [width, setWidth] = useState(360),
    [payload, setPayload] = useState(3),
    [lines, setLines] = useState(3),
    [height, setHeight] = useState(96);
  const [after, setAfter] = useState(false),
    [resizing, setResizing] = useState(false);
  const [mode, setMode] = useState<"lines" | "height">("lines");
  const [boundary, setBoundary] = useState<ClampBoundary>("word");
  const [engine, setEngine] = useState<"standard" | "pretext">("standard");
  const dialog = useRef<HTMLDivElement>(null),
    close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const bodyPosition = document.body.style.position,
      overflow = document.documentElement.style.overflow;
    document.body.style.position = "fixed";
    document.documentElement.style.overflow = "hidden";
    close.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const controls = [
        ...dialog.current!.querySelectorAll<HTMLElement>(
          "button,input,select,textarea,a[href]",
        ),
      ].filter((element) => element.getClientRects().length);
      const first = controls[0],
        last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.position = bodyPosition;
      document.documentElement.style.overflow = overflow;
      document.removeEventListener("keydown", keydown);
      returnFocus?.focus();
    };
  }, [onClose, returnFocus]);
  useEffect(() => {
    if (!resizing) return;
    let id = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setWidth(Math.round(440 + Math.sin((now - start) / 700) * 200));
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [resizing]);
  const native =
    mode === "lines" && boundary === "grapheme" && (lines === 1 || !after);
  const predictive =
    engine === "pretext" && mode === "lines" && boundary === "word";
  const activeEngine = native ? "native" : predictive ? "pretext" : "measured";
  const Clamp = engine === "pretext" ? PretextLineClamp : LineClamp;
  const limits = mode === "lines" ? { maxLines: lines } : { maxHeight: height };
  const afterSlot = after
    ? () => <button data-stress-after-slot="">Action</button>
    : undefined;
  return createPortal(
    <div className="stress-backdrop">
      <div
        ref={dialog}
        className="stress-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Stress playground"
        data-stress-playground=""
      >
        <button ref={close} data-stress-close="" onClick={onClose}>
          Close
        </button>
        <h2>Stress playground</h2>
        <FpsMeter />
        <ScrollArea data-stress-modal-scroll="">
          <div className="stress-controls">
            {(["line", "rich", "inline", "wrap"] as const).map((item) => (
              <button
                key={item}
                data-stress-surface={item}
                aria-pressed={surface === item}
                onClick={() => setSurface(item)}
              >
                {item}
              </button>
            ))}
            <Range
              name="stress-count-slider"
              label="Instances"
              value={count}
              min={1}
              max={200}
              onChange={setCount}
            />
            <output data-stress-count="">{count}</output>
            <Range
              name="stress-width-slider"
              label="Width"
              value={width}
              min={160}
              max={720}
              onChange={setWidth}
            />
            <output data-stress-width="">{width}px</output>
            <Range
              name="stress-payload-slider"
              label="Payload"
              value={payload}
              max={10}
              onChange={setPayload}
            />
            <output data-stress-payload="">
              {surface === "wrap" ? `${payload * 8} items` : `${payload}x text`}
            </output>
            <label data-stress-after-state="" data-enabled={after}>
              <input
                data-stress-after-toggle=""
                type="checkbox"
                checked={after}
                onChange={(event) => setAfter(event.currentTarget.checked)}
              />
              After slot
            </label>
            {(["lines", "height"] as const).map((item) => (
              <button
                key={item}
                data-stress-limit-mode={item}
                aria-pressed={mode === item}
                onClick={() => setMode(item)}
              >
                {item}
              </button>
            ))}
            {mode === "lines" ? (
              <>
                <Range
                  name="stress-max-lines-slider"
                  label="Max lines"
                  value={lines}
                  max={8}
                  onChange={setLines}
                />
                <output data-stress-max-lines="">{lines}</output>
              </>
            ) : (
              <>
                <Range
                  name="stress-max-height-slider"
                  label="Max height"
                  value={height}
                  min={24}
                  max={200}
                  onChange={setHeight}
                />
                <output data-stress-max-height="">{height}px</output>
              </>
            )}
            {surface === "line" && (
              <>
                {(["word", "grapheme"] as const).map((item) => (
                  <button
                    key={item}
                    data-stress-boundary={item}
                    aria-pressed={boundary === item}
                    onClick={() => setBoundary(item)}
                  >
                    {item}
                  </button>
                ))}
                {(["standard", "pretext"] as const).map((item) => (
                  <button
                    key={item}
                    data-stress-line-engine={item}
                    aria-pressed={engine === item}
                    onClick={() => setEngine(item)}
                  >
                    {item}
                  </button>
                ))}
                <output
                  data-stress-engine-status=""
                  data-stress-engine={activeEngine}
                  title={
                    native
                      ? `Native CSS ${lines === 1 ? "text-overflow" : "line-clamp"}`
                      : predictive
                        ? "Pretext prediction"
                        : "Browser measurement"
                  }
                >
                  {activeEngine === "native"
                    ? "Native"
                    : activeEngine === "pretext"
                      ? "Pretext"
                      : "Measured"}
                </output>
              </>
            )}
            <button
              data-stress-resize-toggle=""
              aria-pressed={resizing}
              onClick={() => setResizing(!resizing)}
            >
              Continuous resize
            </button>
          </div>
          <ScrollArea data-stress-workload="">
            <div className="stress-grid">
              {Array.from({ length: count }, (_, index) => {
                const text =
                  `Row ${index + 1} keeps customer impact, mitigation, ownership, and follow-up visible. `.repeat(
                    payload,
                  );
                return (
                  <div
                    key={index}
                    data-stress-item={mode}
                    data-stress-surface-item={surface}
                    style={{ width, font: "16px/22px Arial" }}
                  >
                    {surface === "line" ? (
                      <Clamp
                        className="stress-clamp"
                        text={text}
                        boundary={boundary}
                        {...limits}
                        after={afterSlot}
                      />
                    ) : surface === "rich" ? (
                      <RichLineClamp
                        className="stress-clamp"
                        html={`<strong>Release ${index + 1}</strong> ${text}`}
                        boundary={boundary}
                        {...limits}
                        after={afterSlot}
                      />
                    ) : surface === "inline" ? (
                      <InlineClamp
                        className="stress-clamp"
                        text={text}
                        boundary={boundary}
                      />
                    ) : (
                      <WrapClamp
                        className="stress-clamp"
                        items={Array.from(
                          { length: payload * 8 },
                          (_, i) => `Item ${i + 1}`,
                        )}
                        renderItem={(item) => (
                          <span className="tag">{item}</span>
                        )}
                        {...limits}
                        after={
                          after
                            ? ({ hiddenCount }) => (
                                <button data-stress-after-slot="">
                                  {hiddenCount > 0
                                    ? `+${hiddenCount}`
                                    : "Action"}
                                </button>
                              )
                            : undefined
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </ScrollArea>
      </div>
    </div>,
    document.body,
  );
}
