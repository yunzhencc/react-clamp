import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  InlineClamp,
  LineClamp,
  RichLineClamp,
  WrapClamp,
  type ClampBoundary,
  type ClampState,
} from "../src";
import { LineClamp as PretextLineClamp } from "../src/pretext";
import { richHtmlPresets, lineTextPresets } from "./presets";
import { CodeBlock, Controls, HeroTagline, Range, ScrollArea } from "./widgets";
import { StressPlayground, type Surface } from "./StressPlayground";
import "./style.css";
import "./playground.css";

const surfaces: {
  id: Surface;
  hash: string;
  title: string;
  description: string;
  tooltip: string;
}[] = [
  {
    id: "line",
    hash: "line-clamp",
    title: "LineClamp",
    description: "Plain-text multiline clamp",
    tooltip:
      "Multiline browser-fit clamp for plain text, previews, cards, and expandable copy.",
  },
  {
    id: "rich",
    hash: "rich-line-clamp",
    title: "RichLineClamp",
    description: "Trusted inline HTML clamp",
    tooltip:
      "Trusted inline rich-html clamp for styled excerpts, links, and mixed inline markup.",
  },
  {
    id: "inline",
    hash: "inline-clamp",
    title: "InlineClamp",
    description: "Single-line text clamp",
    tooltip:
      "Native single-line clamp for filenames, paths, and email addresses.",
  },
  {
    id: "wrap",
    hash: "wrap-clamp",
    title: "WrapClamp",
    description: "Wrapped item clamp",
    tooltip:
      "Wrapped atomic-item clamp for labels, filters, and selected-value lists.",
  },
];
const snippets = {
  line: 'import { LineClamp } from "react-clamp";\n\n<LineClamp text={text} maxLines={3} />',
  pretext:
    'import { LineClamp } from "react-clamp/pretext";\n\n<LineClamp text={text} maxLines={3} boundary="word" />',
  rich: 'import { RichLineClamp } from "react-clamp";\n\n<RichLineClamp html={html} maxLines={3} />',
  inline:
    'import { InlineClamp } from "react-clamp";\n\nconst splitImageFile = (text: string) => {\n  const dot = text.lastIndexOf(".");\n  return { body: text.slice(0, dot), end: text.slice(dot) };\n};\n<InlineClamp text={filename} split={splitImageFile} />',
  // eslint-disable-next-line no-template-curly-in-string -- Rendered source-code example.
  wrap: 'import { WrapClamp } from "react-clamp";\n\n<WrapClamp items={items} renderItem={(item) => <span>{item}</span>} maxLines={1}\n  after={({ hiddenItems, expanded, toggle }) =>\n    <button onClick={toggle}>{expanded ? "Less" : `+${hiddenItems.length}`}</button>} />',
};
function Check({
  label,
  checked,
  onChange,
  marker,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  marker?: string;
}) {
  return (
    <label className="control-check">
      <input
        {...(marker ? { [`data-${marker}`]: "" } : {})}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      {label}
    </label>
  );
}
function Ratio({
  inline = false,
  value,
  onChange,
}: {
  inline?: boolean;
  value: number;
  onChange: (value: number) => void;
}) {
  const prefix = inline ? "inline-location" : "location";
  return (
    <div className="ratio-controls">
      <span>Location</span>
      {(["start", "middle", "end"] as const).map((item, index) => (
        <button
          key={item}
          {...{ [`data-${prefix}-preset`]: item }}
          aria-pressed={value === index / 2}
          onClick={() => onChange(index / 2)}
        >
          {item}
        </button>
      ))}
      <Range
        name={`${prefix}-ratio-slider`}
        label="Ratio"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}
function Boundary({
  value,
  onChange,
}: {
  value: ClampBoundary;
  onChange: (value: ClampBoundary) => void;
}) {
  return (
    <label>
      Boundary
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as ClampBoundary)}
      >
        <option value="grapheme">grapheme</option>
        <option value="word">word</option>
      </select>
    </label>
  );
}
function ApiSummary({
  surface,
  pretext,
}: {
  surface: Surface;
  pretext: boolean;
}) {
  return (
    <section data-reference-panel="api">
      <h2>API</h2>
      <div data-api-summary={surface}>
        {surface === "line"
          ? "LineClamp clamps plain text using maxLines (max-lines) or maxHeight (max-height). Configure boundary, location, before and after render callbacks."
          : surface === "rich"
            ? "RichLineClamp preserves trusted inline HTML and line breaks; always clamps from the end."
            : surface === "inline"
              ? "InlineClamp handles one-line strings, preserving the beginning, ending, or both. Use it for filenames, paths, and email addresses."
              : "WrapClamp preserves wrapped items. Use after with hiddenItems and toggle to show More or Less."}
      </div>
      {surface === "line" && pretext && (
        <aside data-alert="pretext" data-alert-tone="info">
          <h3>When Pretext pays off</h3>
          <p>
            For panels that resize repeatedly, use word boundaries and a
            supported custom ellipsis. A multiline after slot is measured
            separately. Ensure the named font is loaded before preparing text.
          </p>
        </aside>
      )}
      {surface === "rich" && (
        <aside data-alert="rich" data-alert-tone="warn">
          <svg
            className="alert-icon"
            width="18"
            height="18"
            viewBox="0 0 18 18"
            aria-hidden="true"
          >
            <path d="M9 1 17 17H1Z" fill="none" stroke="currentColor" />
          </svg>
          <h3>HTML input contract</h3>
          <p>
            Sanitize untrusted input with the HTML Sanitizer API or DOMPurify.
            Use sentence-like HTML: the clamp can trim through inline text.
            Atomic inline content stays whole: &lt;img&gt;, inline &lt;svg&gt;,
            display: inline-block and display: inline-flex. Avoid display:
            block, display: flex, display: grid, and absolute/fixed positioning.
            For media reserve space before load with width, height or
            aspect-ratio.
          </p>
        </aside>
      )}
    </section>
  );
}
function WrapDemos({ width, rtl }: { width: number; rtl: boolean }) {
  const [menu, setMenu] = useState(false),
    [selected, setSelected] = useState(0);
  const tabs = rtl
    ? [
        "نظرة عامة",
        "النشاط",
        "الملفات",
        "الفريق",
        "الإعدادات",
        "التقارير",
        "الأرشيف",
      ]
    : [
        "Overview",
        "Activity",
        "Files",
        "Team",
        "Settings",
        "Reports",
        "Archive",
      ];
  const invitees = rtl
    ? [
        "مايا تشن",
        "علي حسن",
        "سارة أحمد",
        "عمر خالد",
        "ليلى محمد",
        "نور",
        "سامي",
        "آدم",
      ]
    : [
        "Maya Chen",
        "Alex Rivera",
        "Sam Wilson",
        "Jordan Park",
        "Avery Brown",
        "Riley Smith",
        "Taylor Jones",
        "Jamie Lee",
      ];
  return (
    <>
      <article className="demo-block" data-wrap-example="tabs">
        <h3>Navigation tabs</h3>
        <ScrollArea className="demo-preview">
          <WrapClamp
            className="demo-clamp"
            style={{ width }}
            dir={rtl ? "rtl" : "ltr"}
            items={tabs}
            maxLines={1}
            renderItem={(item, index) => (
              <button
                className="wrap-tab"
                aria-current={selected === index ? "page" : undefined}
                onClick={() => setSelected(index)}
              >
                {item}
              </button>
            )}
            after={({ hiddenItems }) => (
              <span className="wrap-menu-host">
                <button
                  data-wrap-tabs-trigger=""
                  aria-label={
                    rtl ? "إظهار التبويبات المخفية" : "Show hidden tabs"
                  }
                  aria-expanded={menu}
                  onClick={() => setMenu(!menu)}
                >
                  ···
                </button>
                {menu && (
                  <div data-wrap-tabs-menu="" role="menu">
                    {hiddenItems.map((item) => (
                      <button
                        key={item}
                        className={`wrap-tabs-menu-item ${selected === tabs.indexOf(item) ? "active" : ""}`}
                        role="menuitem"
                        onClick={() => {
                          setSelected(tabs.indexOf(item));
                          setMenu(false);
                        }}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </span>
            )}
          />
        </ScrollArea>
      </article>
      <article className="demo-block" data-wrap-example="invitees">
        <h3>{rtl ? "المراجعون" : "Reviewers"}</h3>
        <ScrollArea className="demo-preview">
          <WrapClamp
            className="demo-clamp"
            style={{ width }}
            dir={rtl ? "rtl" : "ltr"}
            maxHeight={64}
            before={
              <span className="badge">{rtl ? "المراجعون" : "Reviewers"}</span>
            }
            items={invitees}
            renderItem={(item) => (
              <span className="tag" style={{ minWidth: 100 }}>
                {item}
              </span>
            )}
            after={({ clamped, expanded, toggle }) =>
              (clamped || expanded) && (
                <button data-wrap-toggle="" onClick={toggle}>
                  {rtl
                    ? expanded
                      ? "أقل"
                      : "المزيد"
                    : expanded
                      ? "Less"
                      : "More"}
                </button>
              )
            }
          />
        </ScrollArea>
      </article>
    </>
  );
}
export default function App() {
  const [surface, setSurface] = useState<Surface>(
    () =>
      surfaces.find((item) => `#${item.hash}` === window.location.hash)?.id ??
      "line",
  );
  const [width, setWidth] = useState(585),
    [ratio, setRatio] = useState(1),
    [inlineRatio, setInlineRatio] = useState(1),
    [lines, setLines] = useState(3);
  const [boundary, setBoundary] = useState<ClampBoundary>("grapheme"),
    [rtl, setRtl] = useState(false),
    [hyphens, setHyphens] = useState(true);
  const [text, setText] = useState<string>(lineTextPresets[0].value),
    [html, setHtml] = useState<string>(richHtmlPresets[0].value);
  const [pretext, setPretext] = useState(false),
    [clamped, setClamped] = useState(false),
    [stress, setStress] = useState(false),
    [manager, setManager] = useState("npm");
  const anchor = useRef<HTMLDivElement>(null),
    tabs = useRef<HTMLDivElement>(null),
    opener = useRef<HTMLButtonElement>(null);
  const [moreTabs, setMoreTabs] = useState(false);
  const closeStress = useCallback(() => setStress(false), []);
  useEffect(() => {
    const changed = () => {
      const item = surfaces.find(
        (item) => `#${item.hash}` === window.location.hash,
      );
      if (item) setSurface(item.id);
    };
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  useLayoutEffect(() => {
    const element = tabs.current!;
    const update = () =>
      setMoreTabs(
        element.scrollWidth - element.clientWidth - element.scrollLeft > 1,
      );
    const observer = new ResizeObserver(update);
    observer.observe(element);
    element.addEventListener("scroll", update);
    update();
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", update);
    };
  }, []);
  const select = (next: Surface) => {
    const top = anchor.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) window.scrollTo({ top: window.scrollY + top });
    setSurface(next);
    const hash = surfaces.find((item) => item.id === next)!.hash;
    history.replaceState(
      null,
      "",
      `${location.pathname}${location.search}#${hash}`,
    );
  };
  const toggle = ({ clamped, expanded, toggle }: ClampState) =>
    (clamped || expanded) && (
      <button className="toggle-btn" onClick={toggle}>
        {rtl ? (expanded ? "أقل" : "المزيد") : expanded ? "Less" : "More"}
      </button>
    );
  const shared = (
    <>
      <Boundary value={boundary} onChange={setBoundary} />
      <Range
        name={
          pretext && surface === "line"
            ? "pretext-width-slider"
            : `${surface}-width-slider`
        }
        label="Width"
        min={100}
        max={800}
        value={width}
        onChange={setWidth}
      />
      {surface === "line" && pretext ? (
        <Range
          name="pretext-lines-slider"
          label="Max lines"
          max={8}
          value={lines}
          onChange={setLines}
        />
      ) : (
        (surface === "line" || surface === "rich") && (
          <Check
            label="CSS Hyphens"
            marker={surface === "rich" ? "rich-hyphens-toggle" : undefined}
            checked={hyphens}
            onChange={setHyphens}
          />
        )
      )}
      {(surface === "line" || surface === "wrap") && (
        <Check label="RTL" checked={rtl} onChange={setRtl} />
      )}
    </>
  );
  const blockStyle = {
    width,
    font: "16px/24px Arial",
    hyphens: hyphens ? ("auto" as const) : ("manual" as const),
  };
  return (
    <main className="clamp-app">
      <header>
        <a className="wordmark" href="#">
          react<span>clamp</span> ↵
        </a>
        <span className="version">0.1 / React 18 + 19</span>
      </header>
      <section className="intro">
        <p className="eyebrow">SMALL PRIMITIVES, REAL LAYOUT</p>
        <h1>
          让文字，
          <br />
          <em>恰好装下。</em>
        </h1>
        <HeroTagline />
      </section>
      <section data-surface-guide="">
        <h2>react-clamp: four focused components</h2>
        <ul data-surface-guide-list="">
          {surfaces.map((item) => (
            <li key={item.id} data-surface-guide-item={item.id}>
              <a
                data-surface-guide-link={item.id}
                href={`#${item.hash}`}
                onClick={() => select(item.id)}
              >
                {item.title}
              </a>
              <p>{item.description}</p>
            </li>
          ))}
        </ul>
      </section>
      <section data-reference-shell="">
        <div className="reference-tabs-anchor" ref={anchor} />
        <nav className="component-tabs">
          <div ref={tabs} data-component-tabs-scroll="">
            {surfaces.map((item) => (
              <button
                key={item.id}
                id={item.hash}
                data-surface-tab={item.id}
                aria-pressed={surface === item.id}
                aria-describedby={`component-tab-tooltip-${item.id}`}
                onClick={() => select(item.id)}
              >
                {item.title}
              </button>
            ))}
          </div>
          {moreTabs && <span data-component-tabs-more="">More →</span>}
          {surfaces.map((item) => (
            <span
              key={item.id}
              className="sr-only"
              id={`component-tab-tooltip-${item.id}`}
              data-surface-tooltip={item.id}
            >
              {item.tooltip}
            </span>
          ))}
        </nav>
        <section data-reference-panel="overview">
          <h2>{surfaces.find((item) => item.id === surface)!.title}</h2>
          {surface === "line" && (
            <div>
              {(["standard", "pretext"] as const).map((engine) => (
                <button
                  key={engine}
                  data-line-engine={engine}
                  aria-pressed={pretext === (engine === "pretext")}
                  onClick={() => setPretext(engine === "pretext")}
                >
                  {engine === "standard" ? "Browser" : "Pretext"}
                </button>
              ))}
            </div>
          )}
        </section>
        <section
          data-reference-panel="demo"
          data-demo={
            surface === "inline" || surface === "wrap" ? surface : undefined
          }
        >
          <Controls key={surface} surface={surface}>
            {shared}
            {surface === "inline" && (
              <Ratio inline value={inlineRatio} onChange={setInlineRatio} />
            )}
          </Controls>
          {surface === "line" &&
            (pretext ? (
              <div data-pretext-workload="">
                {Array.from({ length: 8 }, (_, index) => (
                  <article key={index} className="demo-block">
                    <ScrollArea className="demo-preview">
                      <PretextLineClamp
                        data-pretext-item=""
                        className="demo-clamp"
                        style={{ width, font: "16px/24px Arial" }}
                        maxLines={lines}
                        boundary="word"
                        text={`${index + 1}. ${text}`}
                      />
                    </ScrollArea>
                  </article>
                ))}
              </div>
            ) : (
              <>
                <div className="source-editor">
                  <label>
                    Shared line text
                    <textarea
                      data-line-text-input=""
                      value={text}
                      onInput={(event) => setText(event.currentTarget.value)}
                      onChange={() => {}}
                    />
                  </label>
                  {lineTextPresets.map((preset) => (
                    <button
                      key={preset.id}
                      data-line-text-preset={preset.id}
                      aria-pressed={text === preset.value}
                      onClick={() => setText(preset.value)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <article className="demo-block">
                  <h3>Expandable text</h3>
                  <ScrollArea className="demo-preview">
                    <LineClamp
                      className="demo-clamp"
                      dir={rtl ? "rtl" : "ltr"}
                      style={blockStyle}
                      text={text}
                      maxLines={3}
                      boundary={boundary}
                      after={toggle}
                    />
                  </ScrollArea>
                </article>
                <article className="demo-block">
                  <h3>Height and before content</h3>
                  <ScrollArea className="demo-preview">
                    <LineClamp
                      className="demo-clamp"
                      dir={rtl ? "rtl" : "ltr"}
                      style={blockStyle}
                      text={text}
                      maxHeight={96}
                      boundary={boundary}
                      before={
                        <span className="badge">
                          {rtl ? "مميز" : "Featured"}
                        </span>
                      }
                    />
                  </ScrollArea>
                </article>
                <article className="demo-block" data-demo="location">
                  <h3>Location</h3>
                  <Ratio value={ratio} onChange={setRatio} />
                  <ScrollArea className="demo-preview">
                    <LineClamp
                      className="demo-clamp"
                      dir={rtl ? "rtl" : "ltr"}
                      style={blockStyle}
                      text={text}
                      maxLines={5}
                      boundary={boundary}
                      location={ratio}
                      after={toggle}
                    />
                  </ScrollArea>
                </article>
              </>
            ))}
          {surface === "rich" && (
            <>
              <div className="source-editor">
                <label>
                  Shared trusted HTML
                  <textarea
                    data-rich-html-input=""
                    value={html}
                    onInput={(event) => setHtml(event.currentTarget.value)}
                    onChange={() => {}}
                  />
                </label>
                {richHtmlPresets.map((preset) => (
                  <button
                    key={preset.id}
                    data-rich-preset={preset.id}
                    aria-pressed={html === preset.value}
                    onClick={() => setHtml(preset.value)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              {(["max-lines", "max-height", "clampchange"] as const).map(
                (example) => (
                  <article
                    key={example}
                    className="demo-block"
                    data-rich-example={example}
                    data-demo={
                      example === "max-lines" ? "rich-html" : undefined
                    }
                  >
                    <h3>{example}</h3>
                    {example === "max-lines" && (
                      <p>
                        Trusted or sanitized inline HTML only. The component
                        makes a best-effort pass through inline-flow markup and
                        always clamps from the end.
                      </p>
                    )}
                    <ScrollArea className="demo-preview">
                      <RichLineClamp
                        className={`demo-clamp ${hyphens ? "hyphens" : ""}`}
                        style={blockStyle}
                        html={html}
                        boundary={boundary}
                        {...(example === "max-height"
                          ? {
                              maxHeight: 96,
                              before: <span className="badge">Featured</span>,
                            }
                          : { maxLines: 3 })}
                        after={toggle}
                        onClampChange={
                          example === "clampchange" ? setClamped : undefined
                        }
                      />
                    </ScrollArea>
                    {example === "clampchange" && (
                      <output className="clamp-status">
                        {clamped ? "Clamped" : "Full text"}
                      </output>
                    )}
                  </article>
                ),
              )}
            </>
          )}
          {surface === "inline" &&
            [
              {
                id: "file-list",
                text: "summer-campaign-panorama-final-edited.jpeg",
                split: (text: string) => ({
                  body: text.slice(0, -5),
                  end: ".jpeg",
                }),
              },
              {
                id: "email",
                text: "design-systems-team-and-maintainers@acme.dev",
                split: (text: string) => ({
                  body: text.slice(0, -9),
                  end: "@acme.dev",
                }),
              },
              {
                id: "path",
                text: "~/screenshots/desktop-responsive-interface-final.png",
                split: (text: string) => ({
                  start: "~/screenshots/",
                  body: text.slice(14, -4),
                  end: ".png",
                }),
              },
            ].map((example) => (
              <article
                key={example.id}
                className="demo-block"
                data-inline-example={example.id}
              >
                <h3>{example.id}</h3>
                {(["plain", "split"] as const).map((mode) => (
                  <ScrollArea key={mode} className="demo-preview">
                    <div data-inline-mode={mode}>
                      <InlineClamp
                        className="demo-inline"
                        style={{ width, font: "16px/24px Arial" }}
                        text={example.text}
                        split={mode === "split" ? example.split : undefined}
                        boundary={boundary}
                        location={inlineRatio}
                      />
                    </div>
                  </ScrollArea>
                ))}
              </article>
            ))}
          {surface === "wrap" && <WrapDemos width={width} rtl={rtl} />}
        </section>
        <section data-reference-panel="stress">
          <h2>Measure your workload</h2>
          <button
            ref={opener}
            data-stress-playground-open=""
            onClick={() => setStress(true)}
          >
            Open stress playground
          </button>
        </section>
        <section data-reference-panel="example">
          <h2>Example</h2>
          <CodeBlock
            id={`${surface === "line" && pretext ? "pretext" : surface}-example`}
            code={snippets[surface === "line" && pretext ? "pretext" : surface]}
          />
        </section>
        <ApiSummary surface={surface} pretext={pretext} />
      </section>
      <section id="installation">
        <h2>Install</h2>
        <div>
          {["npm", "yarn", "pnpm", "deno", "bun"].map((item) => (
            <button
              className="install-tab"
              key={item}
              aria-pressed={manager === item}
              onClick={() => setManager(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <CodeBlock
          id="install"
          label="installation command"
          code={`${manager} ${manager === "npm" ? "install" : "add"} react-clamp`}
        />
      </section>
      <footer>
        <span>React Clamp</span>
        <span>文本恰好装下，意思完整留下。</span>
      </footer>
      {stress && (
        <StressPlayground
          initialSurface={surface}
          onClose={closeStress}
          returnFocus={opener.current}
        />
      )}
    </main>
  );
}
