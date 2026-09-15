# 上游基准工作负载对应

对应 `Justineo/vue-clamp` 的 `9f93dbcc31f60b02dc34fbd6a9da9bf90edc6d84`，保留六个文件的 114 个场景、数据规模、宽度序列、工作计数器和正确性断言。组件通过 React 测试适配器渲染，直接算法场景调用本库的 engine。逐场景目录和测试声明位置见 `mapping.json`。

```sh
# 正确性冒烟：每个场景测一次，不减少场景、组件数量或宽度变化。
UPSTREAM_BENCHMARK_SMOKE=1 npx vitest run --config vitest.upstream-benchmarks.config.ts

# 完整基准：保留上游预热和重复次数。
UPSTREAM_BENCHMARK_OUTPUT=/private/tmp/react-clamp-bench.json npx vitest run --config vitest.upstream-benchmarks.config.ts

# 提供可配对的基线报告，输出逐指标均值差和 95% 区间。
UPSTREAM_BENCHMARK_BASELINE=/private/tmp/react-clamp-before.json UPSTREAM_BENCHMARK_OUTPUT=/private/tmp/react-clamp-after.json npx vitest run --config vitest.upstream-benchmarks.config.ts
```

默认报告写入 `/private/tmp/react-clamp-upstream-benchmarks.json`，含原始各场景指标及运行状态。只对提供了等长、至少两轮原始样本的匹配指标计算配对统计；调用方应确保基线与本次轮次具有可比性。冒烟单样本不能证明性能等价。部分上游场景只输出聚合值，它们保留原始指标，不据此构造置信区间。

Pretext 的 Vue `onVnodeUpdated` 计数转换为 React Profiler 的实际更新提交次数。它衡量 React 提交行为，与 Vue VNode 更新计数并非同一种底层操作。其他计数器继续测量真实 DOM 读取、观察器、字体监听和插槽调用。
