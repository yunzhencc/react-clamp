import { useEffect, useLayoutEffect, type ElementType } from "react";
export type ClampLength = number | string;
export type ClampTag = string;
export const useBrowserLayoutEffect =
  typeof document === "undefined" ? useEffect : useLayoutEffect;
export const rootTag = (tag: string): ElementType => tag as ElementType;
export { normalizeLineLimit, cssLength } from "./engine/layout.js";
export function heightLimit(root: HTMLElement, height?: ClampLength): number {
  if (height === undefined) return Infinity;
  if (typeof height === "number") return height;
  const style = getComputedStyle(root);
  // Measure resolved browser geometry: percentages, calc(), em and CSS variables
  // use the actual containing block, not an independently sized measurement node.
  return (
    root.getBoundingClientRect().height -
    (parseFloat(style.borderTopWidth) || 0) -
    (parseFloat(style.borderBottomWidth) || 0) -
    (parseFloat(style.paddingTop) || 0) -
    (parseFloat(style.paddingBottom) || 0)
  );
}

export function onlyWidthChanges(
  records: MutationRecord[],
  root: HTMLElement,
): boolean {
  return records.every((record) => {
    if (
      record.attributeName !== "style" ||
      !(record.target instanceof HTMLElement) ||
      !record.target.contains(root)
    )
      return false;
    const previous = document.createElement("span").style;
    previous.cssText = record.oldValue ?? "";
    const withoutWidth = (style: CSSStyleDeclaration) =>
      Array.from(style)
        .filter((name) => !["width", "min-width", "max-width"].includes(name))
        .sort()
        .map(
          (name) =>
            `${name}:${style.getPropertyValue(name)}!${style.getPropertyPriority(name)}`,
        )
        .join(";");
    return withoutWidth(previous) === withoutWidth(record.target.style);
  });
}
