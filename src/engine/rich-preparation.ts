// Adapted from vue-clamp rich-line/preparation.ts at 9f93dbcc31f60b02dc34fbd6a9da9bf90edc6d84; MIT.
import { prepareRich } from "./rich.js";

import type { PreparedRich } from "./rich.js";
import type { ClampBoundary } from "./types.js";

// Prepared source DOM is inert and only read by the patcher. Share at most one
// bounded source; connected trees, CSS inspection, and clamp results stay local.
let lastHtml = "";
let lastPrepared: PreparedRich | null = null;

export function prepareSharedRich(html: string, boundary: ClampBoundary): PreparedRich | null {
  if (lastPrepared && lastHtml === html && lastPrepared.boundary === boundary) {
    return lastPrepared;
  }

  const prepared = prepareRich(html, boundary);
  lastPrepared = html.length <= 8192 ? prepared : null;
  lastHtml = lastPrepared ? html : "";
  return prepared;
}
