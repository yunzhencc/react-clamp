/** Test-fixture syntax adapter: all rendering and lifecycle work is performed by React.
 * Contains no clamp/layout implementation. Ref writes update only subscribed hosts.
 */
import React, { useLayoutEffect, useMemo, useReducer, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { WrapClamp } from "../../src/index";

export type Component = React.ElementType;
export type VNodeChild = ReactNode;
export type DefineComponent<T = unknown> = React.ElementType;
export interface Ref<T> { version: number; value: T; assign(value: T): void; listeners: Set<() => void> }
let collecting: Set<Ref<unknown>> | null = null;
const updates = new Set<() => void>();
let scheduled = false;
function flushUpdates() {
  scheduled = false;
  const batch = [...updates];
  updates.clear();
  if (batch.length) flushSync(() => batch.forEach(update => update()));
}
function schedule(update: () => void) {
  updates.add(update);
  if (!scheduled) { scheduled = true; queueMicrotask(flushUpdates); }
}
export function ref<T>(initial: T): Ref<T> {
  const proxies = new WeakMap<object, object>();
  const wrap = (input: any): any => {
    if (!input || typeof input !== "object" ||
        (Object.getPrototypeOf(input) !== Object.prototype && !Array.isArray(input)) || React.isValidElement(input)) return input;
    if (proxies.has(input)) return proxies.get(input);
    const proxy = new Proxy(input, {
      get(target, key) { return wrap(Reflect.get(target, key)); },
      set(target, key, next) { const changed = !Object.is(Reflect.get(target, key), next); const success = Reflect.set(target, key, next); if (changed) { result.version++; result.listeners.forEach(schedule); } return success; },
    });
    proxies.set(input, proxy);
    return proxy;
  };
  let value = initial;
  const result: Ref<T> = {
    version: 0,
    listeners: new Set(),
    get value() { collecting?.add(result as Ref<unknown>); return value; },
    set value(next: T) {
      if (Object.is(value, next)) return;
      value = wrap(next);
      result.version++;
      result.listeners.forEach(schedule);
    },
    assign(next: T) { value = next; },
  };
  value = wrap(initial);
  return result;
}
export async function nextTick() {
  await Promise.resolve();
  flushUpdates();
  await Promise.resolve();
}
function tracked(render: () => ReactNode): ReactNode {
  const [, update] = useReducer(value => value + 1, 0);
  const dependencies = new Set<Ref<unknown>>();
  const add = dependencies.add.bind(dependencies);
  dependencies.add = dependency => { dependency.listeners.add(update); return add(dependency); };
  const previous = collecting;
  collecting = dependencies;
  let node;
  try { node = render(); } finally { collecting = previous; }
  useLayoutEffect(() => {
    dependencies.forEach(dependency => dependency.listeners.add(update));
    return () => { dependencies.forEach(dependency => dependency.listeners.delete(update)); updates.delete(update); };
  });
  return node;
}
export function defineComponent(input: {setup?: (...args: any[]) => () => ReactNode; render?: () => ReactNode; name?: string} | (() => () => ReactNode)) {
  const options = typeof input === "function" ? { setup: input } : input;
  function FixtureHost(props: Record<string, unknown>) {
    const render = useMemo(() => options.setup?.(props) ?? options.render!, []);
    return tracked(render);
  }
  return FixtureHost;
}
export interface App { mount(container: HTMLElement): void; unmount(): void }
export function createApp(component: Component | { setup?: () => () => ReactNode; render?: () => ReactNode }): App {
  let root: Root | undefined;
  const Host = typeof component === "object" && !("$$typeof" in component)
    ? defineComponent(component) : typeof component === "function"
      ? defineComponent({render: component as () => ReactNode})
      : defineComponent({render: () => React.createElement(component as Component)});
  return {
    mount(container) { root = createRoot(container); flushSync(() => root!.render(React.createElement(Host))); },
    unmount() { flushSync(() => root?.unmount()); root = undefined; },
  };
}
export const Comment = Symbol("fixture-comment");
const slotCallbacks = new WeakMap<Function, {owner: Set<Ref<unknown>> | null; dependencies: Map<Ref<unknown>, number>; run: (value: any) => ReactNode}>();
const callbacks = new WeakMap<object, (value: unknown) => void>();
function css(value: unknown): React.CSSProperties | undefined {
  if (typeof value !== "string") return value as React.CSSProperties | undefined;
  const parsed = document.createElement("span").style;
  parsed.cssText = value;
  return Object.fromEntries(Array.from(parsed).map(name => [
    name.startsWith("--") ? name : name.replace(/^-ms-/, "ms-").replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()),
    parsed.getPropertyValue(name),
  ]));
}
export function h(type: Component | string | typeof Comment, props?: any, children?: any): ReactNode {
  if (type === Comment) return null;
  if (props == null) props = {};
  if (typeof props !== "object" || Array.isArray(props) || React.isValidElement(props)) {
    children = props; props = {};
  }
  const attributes = { ...props };
  if (attributes.class !== undefined) { attributes.className = attributes.class; delete attributes.class; }
  if (attributes.style !== undefined) attributes.style = css(attributes.style);
  if (attributes.innerHTML !== undefined) { attributes.dangerouslySetInnerHTML = {__html: attributes.innerHTML}; delete attributes.innerHTML; }
  if (attributes.onClampchange) { attributes.onClampChange = attributes.onClampchange; delete attributes.onClampchange; }
  if (attributes["onUpdate:expanded"]) { attributes.onExpandedChange = attributes["onUpdate:expanded"]; delete attributes["onUpdate:expanded"]; }
  if (attributes.ref && typeof attributes.ref === "object" && "assign" in attributes.ref) {
    const target = attributes.ref as Ref<unknown>;
    if (!callbacks.has(target)) callbacks.set(target, value => target.assign(value));
    attributes.ref = callbacks.get(target);
  }
  if (typeof type !== "string" && children && typeof children === "object" && !Array.isArray(children) && !React.isValidElement(children)) {
    const slots = children;
    const bind = (callback: any) => {
      if (!callback) return undefined;
      let bound = slotCallbacks.get(callback);
      if (!bound || [...bound.dependencies].some(([dependency, version]) => dependency.version !== version)) {
        bound = {owner: collecting, dependencies: new Map(), run: (value: any) => {
          const previous = collecting;
          const dependencies = new Set<Ref<unknown>>();
          dependencies.add = dependency => {
            bound!.owner?.add(dependency);
            bound!.dependencies.set(dependency, dependency.version);
            return dependencies;
          };
          collecting = dependencies;
          try { return callback(value); } finally { collecting = previous; }
        }};
        slotCallbacks.set(callback, bound);
      }
      bound.owner = collecting;
      return bound.run;
    };
    attributes.before = bind(slots.before);
    attributes.after = bind(slots.after);
    if (type === WrapClamp) {
      const itemSlot = bind(slots.item);
      attributes.renderItem = (item: unknown, index: number) => itemSlot?.({item, index});
    }
    children = slots.default?.();
  }
  const committed = attributes.onVnodeUpdated;
  delete attributes.onVnodeUpdated;
  const element = React.createElement(type as Component, attributes, children);
  return committed ? React.createElement(React.Profiler, {id: "upstream-fixture", onRender: (_, phase) => { if (phase !== "mount") committed(); }}, element) : element;
}
