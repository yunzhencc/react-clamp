import { createRoot } from "react-dom/client";
import * as ReactLibrary from "../../src";
import { createApp, h, type Component } from "vue";
import * as VueLibrary from "vue-clamp";

export interface ParityCase {
  predictive?: boolean;
  count?: number;
  kind?: "line" | "inline" | "wrap" | "rich";
  text?: string;
  html?: string;
  width?: number;
  maxLines?: number;
  maxHeight?: number | string;
  location?: "start" | "middle" | "end" | number;
  boundary?: "word" | "grapheme";
  ellipsis?: string;
  as?: string;
  affixes?: boolean;
}
const root = createRoot(document.getElementById("react")!);
let vueApp: ReturnType<typeof createApp> | undefined;
declare global {
  interface Window {
    mountParity: (value: ParityCase) => void;
  }
}
window.mountParity = async ({
  predictive,
  count = 20,
  kind = "line",
  width = 240,
  affixes,
  ...props
}) => {
  const style = `width:${width}px;font:16px/24px Arial;`;
  for (const id of ["react", "vue"])
    document.getElementById(id)!.setAttribute("style", style);
  const names = {
    line: "LineClamp",
    inline: "InlineClamp",
    wrap: "WrapClamp",
    rich: "RichLineClamp",
  } as const;
  const tags = Array.from({ length: count }, (_, i) => ({
    id: i,
    label: `Tag ${i}`,
  }));
  const R = predictive
    ? (await import("../../src/pretext")).LineClamp
    : (ReactLibrary[
        names[kind] as keyof typeof ReactLibrary
      ] as React.ElementType);
  if (!R) {
    root.render(<div>Missing {names[kind]}</div>);
    return;
  }
  const before = affixes ? <span>Prefix </span> : undefined;
  const after = affixes ? (
    <button type="button" style={{ font: "inherit", padding: 0, border: 0 }}>
      More
    </button>
  ) : undefined;
  root.render(
    kind === "wrap" ? (
      <R
        {...props}
        gap={0}
        items={tags}
        itemKey="id"
        renderItem={(item: (typeof tags)[number]) => (
          <span style={{ display: "inline-block", width: 64, height: 24 }}>
            {item.label}
          </span>
        )}
        before={before}
        after={
          affixes
            ? ({ hiddenItems }: { hiddenItems: typeof tags }) => (
                <span
                  style={{ display: "inline-block", width: 48, height: 24 }}
                >
                  +{hiddenItems.length}
                </span>
              )
            : undefined
        }
      />
    ) : (
      <R {...props} before={before} after={after} />
    ),
  );
  const awaitPretext = predictive
    ? (await import("vue-clamp/pretext")).LineClamp
    : null;
  vueApp?.unmount();
  vueApp = createApp({
    render: () =>
      h(
        (predictive ? awaitPretext : VueLibrary[names[kind]]) as Component,
        {
          ...props,
          ...(kind === "wrap" ? { items: tags, itemKey: "id" } : {}),
        },
        kind === "inline"
          ? undefined
          : {
              ...(kind === "wrap"
                ? {
                    item: ({ item }: { item: (typeof tags)[number] }) =>
                      h(
                        "span",
                        {
                          style: {
                            display: "inline-block",
                            width: "64px",
                            height: "24px",
                          },
                        },
                        item.label,
                      ),
                  }
                : {}),
              ...(affixes
                ? {
                    before: () => h("span", null, "Prefix "),
                    after:
                      kind === "wrap"
                        ? ({ hiddenItems }: { hiddenItems: typeof tags }) =>
                            h(
                              "span",
                              {
                                style: {
                                  display: "inline-block",
                                  width: "48px",
                                  height: "24px",
                                },
                              },
                              "+" + hiddenItems.length,
                            )
                        : () =>
                            h(
                              "button",
                              {
                                type: "button",
                                style: {
                                  font: "inherit",
                                  padding: 0,
                                  border: 0,
                                },
                              },
                              "More",
                            ),
                  }
                : {}),
            },
      ),
  });
  vueApp.mount("#vue");
};
