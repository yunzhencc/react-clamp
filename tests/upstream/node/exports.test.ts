// Ported from vue-clamp upstream tests at 9f93dbcc31f60b02dc34fbd6a9da9bf90edc6d84; MIT.
import { describe, expect, it } from "vitest";
import * as exports from "../../../src/index.js";
import * as pretextExports from "../../../src/pretext.js";

function renderName(component: unknown): string {
  return (component as { render: { name: string } }).render.name;
}

describe("Public exports", () => {
  it("exports the documented root components", () => {
    // React forwardRef components are objects; their render functions carry names.
    expect(renderName(exports.LineClamp)).toBe("LineClamp");
    expect(renderName(exports.RichLineClamp)).toBe("RichLineClamp");
    expect(renderName(exports.InlineClamp)).toBe("InlineClamp");
    expect(renderName(exports.WrapClamp)).toBe("WrapClamp");
  });

  it("does not expose the old Clamp alias", () => {
    expect("Clamp" in exports).toBe(false);
  });

  it("does not expose internal runtime helpers", () => {
    expect("borderBoxWidth" in exports).toBe(false);
    expect("clampTextToFit" in exports).toBe(false);
    expect("prepareRich" in exports).toBe(false);
  });

  it("exports the opt-in Pretext component from its own entry", () => {
    expect(renderName(pretextExports.LineClamp)).toBe("PredictiveLineClamp");
    expect(Object.keys(pretextExports)).toEqual(["LineClamp"]);
  });
});
