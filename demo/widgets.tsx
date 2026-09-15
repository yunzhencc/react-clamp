import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { OverlayScrollbars } from "overlayscrollbars";
import "overlayscrollbars/styles/overlayscrollbars.css";
import { InlineClamp } from "../src";

export function ScrollArea({
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const instance = OverlayScrollbars(ref.current!, {
      overflow: { x: "scroll", y: "hidden" },
      scrollbars: { autoHide: "leave" },
    });
    return () => instance.destroy();
  }, []);
  return (
    <div {...props} ref={ref} data-overlayscrollbars-initialize="">
      {children}
    </div>
  );
}
export function Range({
  name,
  label,
  value,
  onChange,
  min = 1,
  max = 800,
  step = 1,
}: {
  name: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label>
      {label} <output>{value}</output>
      <input
        {...{ [`data-${name}`]: "" }}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onInput={(event) => onChange(event.currentTarget.valueAsNumber)}
        onChange={() => {}}
      />
    </label>
  );
}
export function CodeBlock({
  id,
  code,
  label = "example code",
}: {
  id: string;
  code: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => setCopied(false), [code]);
  return (
    <div className="code-block">
      <button
        data-copy-button={id}
        data-copy-state={copied ? "copied" : "idle"}
        aria-label={copied ? `${label} copied` : `Copy ${label}`}
        onClick={async () => {
          await navigator.clipboard.writeText(code);
          setCopied(true);
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <ScrollArea data-code-scroll="">
        <pre>
          <code>{code}</code>
        </pre>
      </ScrollArea>
    </div>
  );
}
export function HeroTagline() {
  const measure = useRef<HTMLSpanElement>(null),
    collapsedMeasure = useRef<HTMLSpanElement>(null);
  const [sizes, setSizes] = useState({ full: 0, collapsed: 0 });
  const [collapsed, setCollapsed] = useState(false);
  useLayoutEffect(() => {
    let active = true;
    const refresh = () => {
      if (active && measure.current && collapsedMeasure.current)
        setSizes({
          full: measure.current.getBoundingClientRect().width,
          collapsed: collapsedMeasure.current.getBoundingClientRect().width,
        });
    };
    refresh();
    document.fonts.ready.then(refresh);
    const observer = new ResizeObserver(refresh);
    observer.observe(measure.current!);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, []);
  useEffect(() => {
    const collapse = window.setTimeout(() => setCollapsed(true), 800);
    const expand = window.setInterval(
      () => setCollapsed((current) => !current),
      4500,
    );
    return () => {
      clearTimeout(collapse);
      clearInterval(expand);
    };
  }, []);
  return (
    <div className="hero-tagline-shell">
      <span ref={measure} className="hero-tagline-measure">
        Make your content fit.
      </span>
      <span ref={collapsedMeasure} className="hero-tagline-measure">
        Make your … fit.
      </span>
      <div
        style={{
          width: sizes.full
            ? collapsed
              ? sizes.collapsed
              : sizes.full + 80
            : "max-content",
          transition: collapsed ? "width 900ms ease" : undefined,
        }}
      >
        <InlineClamp
          className="hero-tagline"
          style={{ width: "100%", font: "20px/28px Arial" }}
          text="Make your content fit."
          split={() => ({ start: "Make your ", body: "content", end: " fit." })}
        />
      </div>
    </div>
  );
}
export function FpsMeter() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let animation = 0;
    let previous = performance.now();
    let x = 0;
    const draw = (now: number) => {
      const context = canvas.current?.getContext("2d");
      if (context) {
        const fps = 1000 / Math.max(1, now - previous);
        context.fillStyle = "#263a30";
        context.fillRect(x, 0, 2, 36);
        context.fillStyle = "#b7d478";
        context.fillRect(x, 36 - Math.min(fps, 60) / 2, 2, 36);
        x = (x + 2) % 120;
      }
      previous = now;
      animation = requestAnimationFrame(draw);
    };
    animation = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animation);
  }, []);
  return (
    <div data-fps-meter="" aria-label="Frame rate">
      <canvas ref={canvas} width="120" height="36" />
    </div>
  );
}
export function Controls({
  surface,
  children,
}: {
  surface: string;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="shared-controls" data-shared-controls={surface}>
      <button
        data-demo-controls-toggle=""
        aria-expanded={expanded}
        aria-label={
          expanded ? "Collapse demo controls" : "Expand demo controls"
        }
        onClick={() => setExpanded(!expanded)}
      >
        Demo controls
      </button>
      <div className={expanded ? "controls-body expanded" : "controls-body"}>
        {children}
      </div>
    </div>
  );
}
