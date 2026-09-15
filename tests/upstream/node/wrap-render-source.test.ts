// React translation of upstream wrap-render-source.test.ts (9f93dbcc, MIT).
import { describe, expect, it } from "vitest";
import { elementRef, parseReactSource } from "./react-source.js";

describe("WrapClamp render source", () => {
  it("keeps the SFC render-only and binds it through defineRender", () => {
    const { source, elements } = parseReactSource("src/WrapClamp.tsx");
    // A TSX forwardRef render function is React's equivalent of defineRender.
    expect(source).not.toContain("<template");
    expect(source).toMatch(/forwardRef\(function WrapClamp<T>\(/);
    expect(source).toContain("export const WrapClamp = WrapClampImpl");
    expect(source).not.toContain("function setRootElement");
    expect(source).not.toContain("function setContentElement");
    expect(elements.filter((element) => elementRef(element) !== null).map(elementRef)).toContain("rootRef");
    expect(elements.filter((element) => elementRef(element) !== null).map(elementRef)).toContain("contentRef");
  });
});
