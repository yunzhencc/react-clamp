// Adapted from vue-clamp RichLineClamp.vue at 9f93dbcc31f60b02dc34fbd6a9da9bf90edc6d84; MIT.
import { clampRich, canSafelyCloneRichProbe, patchRich, type PreparedRich, type RichState, type RichSearchIndex } from "./rich.js";
import { prepareSharedRich } from "./rich-preparation.js";
import type { ClampBoundary, ClampLength } from "./types.js";

export const richProbeStyle = {
  display: "block",
  left: "-99999px",
  pointerEvents: "none",
  position: "absolute",
  top: "0",
  visibility: "hidden",
} as const;

type RichMeasurementInput = {
  html: string;
  boundary: ClampBoundary;
  ellipsis: string;
  lineLimit: number | undefined;
  maxHeight: ClampLength | undefined;
  width: number;
  body: HTMLElement;
  probeRoot: HTMLElement;
  before: HTMLElement | null;
  after: HTMLElement | null;
};

/** Keeps connected probe DOM and visible patch cursors local to one React root. */
export function createRichMeasurement() {
  let source: string | undefined;
  let semantics = "";
  let prepared: PreparedRich | null = null;
  let visibleState: RichState | null = null;
  let measuredState: RichState | null = null;
  let searchIndex: RichSearchIndex | null = null;
  let probeRoot: HTMLElement | null = null;
  let content: HTMLElement | null = null;
  let probeBody: HTMLElement | null = null;
  let affixSignature: string | null = null;
  let blocked = false;
  let marker = "…";

  function clearProbe() {
    probeRoot?.replaceChildren();
    content = null;
    probeBody = null;
    measuredState = null;
    searchIndex = null;
    affixSignature = null;
  }

  function restore(body: HTMLElement, html: string) {
    if (source === html && prepared && visibleState?.kind === "clamped") {
      visibleState = patchRich(prepared, body, visibleState, { kind: "full" }, marker);
    }
    // A source prop change has already committed the new authored innerHTML.
    if (source !== html) {
      source = html;
      semantics = "";
      prepared = null;
      blocked = false;
    }
    visibleState = { kind: "full" };
    clearProbe();
  }

  return {
    get blocked() { return blocked; },
    restore,
    measure(input: RichMeasurementInput): { clamped: boolean; fallback: boolean } {
      // React 18 ignores JSX boolean `inert`. Set the native attribute before
      // connecting any cloned content, consistently across React 18 and 19.
      if (!input.probeRoot.hasAttribute("inert")) input.probeRoot.setAttribute("inert", "");
      const key = JSON.stringify([input.boundary, input.ellipsis, input.lineLimit, input.maxHeight]);
      if (source !== input.html || semantics !== key) {
        restore(input.body, input.html);
        semantics = key;
        prepared = null;
        blocked = false;
        marker = input.ellipsis;
      }
      prepared ??= prepareSharedRich(input.html, input.boundary);
      if (!prepared) return { clamped: false, fallback: false };
      if (probeRoot !== input.probeRoot) {
        clearProbe();
        probeRoot = input.probeRoot;
      }
      if (blocked || !canSafelyCloneRichProbe(prepared.root) ||
          !canSafelyCloneRichProbe(input.body) ||
          !canSafelyCloneRichProbe(input.before) || !canSafelyCloneRichProbe(input.after)) {
        blocked = true;
        restore(input.body, input.html);
        return { clamped: false, fallback: true };
      }
      if (!content || !probeBody) {
        content = document.createElement("span");
        probeBody = document.createElement("span");
        content.dataset.part = "content";
        probeBody.dataset.part = "body";
        content.append(probeBody);
        probeRoot.replaceChildren(content);
      }
      probeRoot.style.width = `${input.width}px`;
      probeRoot.style.maxHeight = input.maxHeight === undefined ? "" : typeof input.maxHeight === "number" ? `${input.maxHeight}px` : input.maxHeight;
      probeRoot.style.overflow = input.maxHeight === undefined ? "visible" : "hidden";
      // Public data-part hooks apply to both trees under the same styled root.
      // Affix DOM is never patched; clone only after the passive-content guard.
      const signature = [input.before?.outerHTML ?? "", input.after?.outerHTML ?? ""].join("|");
      if (signature !== affixSignature) {
        const children: HTMLElement[] = [];
        if (input.before) children.push(input.before.cloneNode(true) as HTMLElement);
        children.push(probeBody);
        if (input.after) children.push(input.after.cloneNode(true) as HTMLElement);
        content.replaceChildren(...children);
        affixSignature = signature;
        searchIndex = null;
      }
      const measured = clampRich({
        prepared,
        ellipsis: input.ellipsis,
        from: measuredState,
        hint: measuredState,
        searchIndex,
        lineLimit: input.lineLimit,
        maxHeight: input.maxHeight,
        probe: { root: probeRoot, content, body: probeBody, width: input.width },
      });
      measuredState = measured.state;
      searchIndex = measured.searchIndex ?? null;
      if (measured.state) {
        visibleState = patchRich(prepared, input.body, visibleState, measured.state, input.ellipsis);
      }
      if (measured.fallback) {
        restore(input.body, input.html);
      }
      return { clamped: measured.state?.kind === "clamped", fallback: measured.fallback };
    },
  };
}
