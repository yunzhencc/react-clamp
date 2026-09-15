# React Clamp

React 18 / 19 的文本与条目折叠组件。原生 CSS 优先，需要精确截断位置或行内操作时按浏览器真实布局测量。支持中文、英文、Emoji 与组合字符。根入口不加载预测引擎；`react-clamp/pretext` 入口使用 `@chenglou/pretext`。

第三方代码的来源及 MIT 许可见 [第三方声明](#third-party-notices)。

当前为本地首版，`react-clamp` 是临时包名，`private: true` 防止误发布。正式包名确认后再发布。当前输出为 ESM。

## 开发

开发环境使用 Node.js 24 和 pnpm 10.30.3（由 `packageManager` 固定）。Playwright 固定为 1.61.1，以兼容 macOS 14 的 WebKit；升级测试工具时需要重新验证对应浏览器运行时。

```sh
pnpm install --frozen-lockfile
pnpm run dev
pnpm exec playwright install chromium firefox webkit
pnpm run check
pnpm run test:upstream
pnpm run test:upstream:verify
pnpm run build:demo
```

`pnpm lint` 检查代码，`pnpm check:package` 检查发布产物。贡献流程与版本管理见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

`pnpm run build` 使用 tsdown 生成 `dist/`，包括 ESM、source map 和 TypeScript 声明；`pnpm pack` 生成本地安装包。示例站输出到 `demo-dist/`。示例与测试均运行 React 组件。

## 多行文本

```tsx
import { LineClamp } from 'react-clamp'

<LineClamp
  text={description}
  maxLines={3}
  after={({ clamped, expanded, toggle }) =>
    (clamped || expanded) && (
      <button type="button" aria-expanded={expanded} onClick={toggle}>
        {expanded ? '收起' : '展开'}
      </button>
    )}
/>
```

`before` 和 `after` 可以是 React 节点，也可以是状态渲染函数。它们作为不可拆分的行内单元参与布局。正文 `text` 仅接受字符串。

| 属性               | 默认值     | 说明                                                                                   |
| ------------------ | ---------- | -------------------------------------------------------------------------------------- |
| `text`             | `""`       | 原始字符串                                                                             |
| `maxLines`         | 无         | 不传时不限行；有限正数向下取整，非正数或非有限数不限制行数                             |
| `maxHeight`        | 无         | 内容高度限制，数字转换为 CSS px，或 CSS 长度字符串；有效性由浏览器解析                 |
| `location`         | `end`      | `start`、`middle`、`end`，或 0–1；数值表示保留字符中前半部分的比例，超范围值限制到 0–1 |
| `boundary`         | `grapheme` | `grapheme` 或 `word`；单词完全放不下时回退到字素边界                                   |
| `ellipsis`         | `…`        | 自定义省略字符串，可为空                                                               |
| `expanded`         | 非受控     | 受控展开状态；配合 `onExpandedChange`                                                  |
| `defaultExpanded`  | `false`    | 非受控初始状态                                                                         |
| `onExpandedChange` | 无         | 用户请求改变展开状态时调用                                                             |
| `onClampChange`    | 无         | 首次挂载及截断状态改变时调用；测量前可能先报告 `false`                                 |
| `before` / `after` | 无         | 附加内容，或 `(state) => ReactNode`                                                    |
| `as`               | `div`      | HTML 标签字符串，须能合法容纳内部内容                                                  |

支持 `className`、`style`、`title`、ARIA、事件等根元素 HTML 属性。内部使用行内元素，附加内容也应使用合法行内内容；不要在 `p` 内放置块级节点。

状态渲染函数和 `ClampHandle` 提供 `clamped`、`expanded`、`expand()`、`collapse()`、`toggle()`。展开后 `clamped` 为 `false`，所以收起按钮用 `expanded || clamped` 判断。

```tsx
import type { ClampHandle } from 'react-clamp'
import { useRef, useState } from 'react'
import { LineClamp } from 'react-clamp'

export function ControlledExample({ description }: { description: string }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <LineClamp
      text={description}
      expanded={expanded}
      onExpandedChange={setExpanded}
    />
  )
}

export function RefExample({ description }: { description: string }) {
  const clampRef = useRef<ClampHandle>(null)
  // clampRef.current?.expand()
  // clampRef.current?.element 是根 DOM 元素。
  return <LineClamp ref={clampRef} text={description} />
}
```

## 单行与固定前后缀

```tsx
import { InlineClamp } from 'react-clamp'

<InlineClamp
  text="summer-campaign-panorama-final.jpeg"
  location="middle"
  split={(text) => {
    const dot = text.lastIndexOf('.')
    return dot > 0
      ? { body: text.slice(0, dot), end: text.slice(dot) }
      : { body: text }
  }}
/>
```

`split` 返回 `{ start?: string, body: string, end?: string }`，只截断 `body`。未传时处理整个 `text`。单行组件支持 `location`、`boundary`、`ellipsis`、`onClampChange`、根元素属性和 ref；不提供展开状态 props 或附加内容插槽。默认根元素为 `span`，宽度为可用宽度的 100%。

## 标签、头像与完整条目

```tsx
import { WrapClamp } from 'react-clamp'

<WrapClamp
  maxLines={2}
  gap={8}
  more={({ hiddenCount, expanded, toggle }) => (
    <button type="button" aria-expanded={expanded} onClick={toggle}>
      {expanded ? '收起' : `+${hiddenCount} 更多`}
    </button>
  )}
>
  {tags.map(tag => (
    <span key={tag.id}>{tag.name}</span>
  ))}
</WrapClamp>
```

以上为 children 便捷接口。每个直接子节点是一项，按顺序保留完整前缀；数组自动展开，Fragment 整体算一项。动态列表应提供稳定的 `key`。不截断条目内部文字，也不拆开单个标签或头像。

| 属性           | 默认值       | 说明                                                                    |
| -------------- | ------------ | ----------------------------------------------------------------------- |
| `children`     | 无           | 任意合法 div 子内容，每个直接子节点作为一个完整条目                     |
| `maxLines`     | 无           | 不传时不限行；有限正数向下取整，非正数或非有限数不限行                  |
| `maxHeight`    | 无           | 内容高度限制，数字转换为 CSS px，或 CSS 长度字符串；有效性由浏览器解析  |
| `gap`          | `0`          | CSS gap，数字为 px，也可传 CSS 字符串                                   |
| `more`         | 内置按钮     | React 节点或 `(state: WrapClampState) => ReactNode`；传 `null` 隐藏控件 |
| 展开属性与回调 | 同 LineClamp | `expanded`、`defaultExpanded`、`onExpandedChange`、`onClampChange`      |

`WrapClampState` / `WrapClampHandle` 在现有状态与 ref 接口上增加 `visibleCount` 和 `hiddenCount`。展开后显示全部条目，`hiddenCount` 为 0、`clamped` 为 false；控件仍显示以便收起。默认按钮显示 `+N` / `Less`，中文文案可通过 `more` 定制。`onClampChange` 只报告完成测量后的状态。

- 内部使用 flex 换行，支持不同宽高及基线、居中对齐的条目。根元素默认 div，可通过 `as` 修改，可传 HTML 属性与样式；间距通过 `gap` 设置。
- 隐藏项通过 `display: none` 移出布局、辅助技术树与键盘顺序，仍保持挂载和内部状态；其订阅也继续运行。此组件不是大列表虚拟化方案。
- 控件使用真实 React DOM 参与测量，不复制或额外挂载条目。容器尺寸、子节点变化、图片加载、字体加载后重新测量。
- 测量采用二分搜索，通常需要对数次同步布局提交。自定义 `more` 应保持尺寸稳定，或随隐藏数量规律变化；宽度剧烈跳变的任意渲染函数可能少显示一些条目。
- 单项放不下时会整体隐藏；所有条目都放不下时只显示控件。宿主须为控件提供足够空间，控件超出宽度或高度限制时会被裁剪。SSR 先输出全部条目，客户端挂载后测量，可能出现首屏布局变化。
- 可使用 `data-part="root|content|before|item|after"`、`data-clamped` 和 `data-expanded` 定制样式，但不要覆盖内部的 display、flex-wrap、flex 或排列顺序。

## WrapClamp 数据接口

数据列表可使用与上游对应的 `items`、`itemKey`、`renderItem`、`before` 和 `after`：

```tsx
<WrapClamp
  items={tags}
  itemKey="id"
  renderItem={(item, index) => <span>{item.name}</span>}
  maxLines={2}
  gap={8}
  before={<span>标签：</span>}
  after={({ hiddenItems, expanded, clamped, toggle }) =>
    (expanded || clamped) && (
      <button type="button" onClick={toggle} aria-expanded={expanded}>
        {expanded ? '收起' : `+${hiddenItems.length} 更多`}
      </button>
    )}
/>
```

`itemKey` 接受字段名或 `(item, index) => string | number`。`items` 模式必须提供 `renderItem`，不传 `items` 时使用 `children`。状态与 ref 的 `hiddenItems` 是未显示的原始数据后缀；children 模式则返回对应 React 节点。`before` / `after` 无默认内容，始终按渲染函数返回值参与测量，显示条件由使用方控制。`after` 优先于便捷属性 `more`。

数据模式先测量有限前缀，需要更多时分批增加，稳定后只挂载可见项。隐藏项卸载，状态应存放在列表外；children 模式仍保持全部子组件挂载以保留状态。SSR 与客户端首次渲染使用一致的初始前缀，之后按实际布局修正。数据模式没有内置按钮；children 模式保留 `+N` / `Less` 便捷按钮。

## 富文本

```tsx
import { RichLineClamp } from 'react-clamp'

<RichLineClamp
  html={trustedHtml}
  maxLines={3}
  boundary="word"
  ellipsis="..."
  after={({ expanded, clamped, toggle }) =>
    (expanded || clamped) && (
      <button type="button" onClick={toggle}>
        {expanded ? '收起' : '展开'}
      </button>
    )}
/>
```

`html` 必填，仅接受可信或已经清理的 HTML；组件不提供 HTML 清理。共享行数、高度、字素/单词边界、前后插槽、展开、回调与 ref；仅支持末尾省略，不提供 `location`。

默认末尾省略在兼容场景使用原生 CSS，保留原始富文本 DOM；自定义省略符、单词边界、附加内容等场景按真实布局测量。支持被动内联格式、链接、br/wbr、空内联元素、尺寸确定的 img 及外层 svg。图片须通过属性或 CSS 提前确定布局尺寸。

测量路径遇到块布局、脱离文档流的元素，或不能安全复制的内容（自定义元素、id/name、内联事件、活动嵌入内容等），返回原始 HTML，并撤销高度裁剪。前后插槽也参与安全检查，按钮请显式设置 `type="button"`。原生 CSS 路径不复制作者 DOM。

## 预测入口

```tsx
import { LineClamp } from 'react-clamp/pretext'

<LineClamp
  text={description}
  maxLines={2}
  boundary="word"
  style={{ font: '16px/24px Arial, sans-serif' }}
/>
```

该入口保留 LineClamp API：默认 grapheme / end / 默认省略符优先原生 CSS；`word`、末尾省略、明确行数、无高度限制且省略符无强制换行时使用 Pretext；其余组合回退到浏览器测量。支持前后插槽的宽度变化。

预测会缓存文本、字体与间距准备结果。在字体和样式稳定时，连续宽度更新直接消费 ResizeObserver 的尺寸，无同步几何或计算样式读取。字体加载、内容/样式变化会使准备失效。适用于大量文本的高频缩放；自动断词、复杂字体塑形、动态字体样式等超出预测模型时应使用根入口。预测不承诺与任意浏览器排版逐像素相同。

## 布局与可访问性

- 宿主应提供确定的可用宽度。在 flex/grid 内通常需要给承载列设置 `min-width: 0`。
- 多行文本继承宿主的 word-break / overflow-wrap 规则；超宽不可断单词可能被容器横向裁剪，需要强制折行时请设置 `overflowWrap: "anywhere"`。
- 默认末尾省略采用 CSS；多行行内后缀、自定义省略符、首中间省略、单词边界和高度限制采用测量路径。
- 监听容器/附加内容尺寸、字体加载，以及祖先 `class/style/dir/hidden` 属性变化。修改样式表规则但未引发尺寸变化时，应触发组件重新渲染。
- 纯文本测量路径隐藏截断后的文本副本，保留完整源文本供辅助技术读取；操作按钮仍保持可访问。按钮标签与 `aria-expanded` 由使用方设置。
- 文本 SSR 输出完整源内容；hydration 首次输出一致，挂载后测量。测量路径可能出现首次布局变化，不承诺服务端精确省略位置。构建入口保留 `"use client"`。
- 过窄时，固定前后缀或省略符保留在 DOM 中，由根容器裁剪。不要放置比容器更宽的必要操作按钮。
- LineClamp / InlineClamp 处理纯文本；RichLineClamp 支持上述受限富文本范围。各组件均不支持竖排文字。测量搜索假设常规排版容量基本单调，特殊字体塑形可能略保守。
- 根/正文的 display、white-space、overflow 等布局样式是内部约束，避免用全局 CSS 覆盖。CSS 原生省略符是视觉效果，不一定出现在复制文本中。

稳定选择器是 `data-part` 标记，不保证它们的直接子节点或嵌套层级不变。LineClamp 在截断或预测状态下的 `body` 内包含辅助技术源文本与可见文本两个 span；读取展示文字时应定位可见 span，完整源内容读取 `source`，不能把整个 `body.textContent` 当作显示文本。富文本测量探针带有 `inert`，应从展示区域查询中排除。

文本与富文本使用 `root/content/body/before/after`，单行前后缀使用 `start/end`，条目使用 `root/content/before/item/after`。辅助源文本额外使用 `source`；根提供 `data-clamped`、`data-expanded`。不要依赖内部嵌套层级。

## 从本地首版迁移

- LineClamp / WrapClamp 不再默认限制 3 行；需要旧效果请显式传 `maxLines={3}`。
- WrapClamp 的 gap 默认改为 0；需要旧间距请传 `gap={8}`。
- InlineClamp 的前后缀选择器由 before/after 改为 start/end；WrapClamp 的 more 选择器改为 after。
- 增加 CSS 高度、数据列表、富文本和预测入口；便捷 children/more API 保留。
- location 超范围数字限制到 0–1；高度数字转换为 CSS px，非法 CSS 高度由浏览器忽略，不再抛出 RangeError。

## 验证

`pnpm run check` 执行构建、类型、单元/SSR、React 三浏览器回归及包产物检查。

`pnpm run test:upstream` 保留已迁移的 React 功能与类型测试：39 个功能测试文件、536 个展开用例（111 Node + 106 引擎 + 298 组件 + 21 示例页面）。这些测试直接运行 React 组件及测量引擎，无需安装其他 UI 框架。

`pnpm run test:upstream:benchmarks` 运行 React 基准的 114 项工作负载；`:benchmarks:smoke` 仅用于快速检查。测试来源映射和必要的版权声明保留在仓库中。`test:upstream:verify` 需要独立的测试清单文件，当前仓库缺少该清单，不能作为通过的验证结果。

CI 配置 React 18/19 矩阵；实际结果以 Actions 记录为准。WebKit 测试不能代替全部 Safari 或 Electron 宿主版本的集成测试。

## License

MIT

### Third-party notices

The framework-independent algorithms in src/engine, the corresponding upstream test suites in tests/upstream, and adapted benchmark/measurement tools in scripts are adapted from [vue-clamp](https://github.com/Justineo/vue-clamp), version 1.7.1, commit 9f93dbcc31f60b02dc34fbd6a9da9bf90edc6d84. Imports and React integration differ; the original license follows.

MIT License

Copyright (c) 2018-present GU Yiling

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
