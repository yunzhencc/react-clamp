import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  LineClamp,
  InlineClamp,
  type ClampHandle,
  type LineClampProps,
} from "../../src";

export type Case = Omit<LineClampProps, "after" | "before" | "ref"> & {
  text: string;
  width?: number;
  kind?: "inline";
  suffix?: string;
  prefix?: string;
  control?: boolean;
  controlled?: boolean;
  largeControl?: boolean;
};

const root = createRoot(document.getElementById("root")!);
function Fixture({ value }: { value: Case }) {
  const [expanded, setExpanded] = useState(false);
  const {
    width = 220,
    kind,
    suffix = "",
    prefix = "",
    control,
    controlled,
    largeControl,
    ...props
  } = value;
  return (
    <div
      id="container"
      style={{
        width,
        fontFamily: "monospace",
        fontSize: 16,
        lineHeight: "24px",
      }}
    >
      {kind === "inline" ? (
        <InlineClamp
          {...props}
          split={
            suffix || prefix
              ? (text) => ({ body: text, start: prefix, end: suffix })
              : undefined
          }
        />
      ) : (
        <LineClamp
          {...props}
          ref={(handle) => {
            window.clampHandle = handle;
          }}
          {...(controlled ? { expanded, onExpandedChange: setExpanded } : {})}
          before={prefix || undefined}
          onClampChange={(value) => {
            window.clampEvents.push(value);
          }}
          after={
            control
              ? ({ expanded, clamped, toggle }) =>
                  (expanded || clamped) && (
                    <button
                      style={{
                        font: "inherit",
                        padding: 0,
                        border: 0,
                        width: largeControl ? 150 : undefined,
                      }}
                      aria-expanded={expanded}
                      onClick={toggle}
                    >
                      {expanded ? "Less" : "More"}
                    </button>
                  )
              : suffix || undefined
          }
        />
      )}
    </div>
  );
}
declare global {
  interface Window {
    mountCase: (value: Case) => void;
    clampEvents: boolean[];
    clampHandle: ClampHandle | null;
  }
}
window.clampEvents = [];
window.mountCase = (value) =>
  root.render(
    <StrictMode>
      <Fixture value={value} />
    </StrictMode>,
  );
