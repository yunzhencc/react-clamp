# 参与开发

工程配置参考 `antfu/starter-ts`，并保留 React 浏览器测量库需要的测试与打包边界。

## 环境

使用 Node.js 24 和 `packageManager` 固定的 pnpm 10.30.3。安装 pnpm 后运行：

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium firefox webkit
pnpm dev
```

仓库只维护 `pnpm-lock.yaml`。新增依赖使用 `pnpm add` / `pnpm add -D`；CI 使用冻结锁文件。当前保留已验证的 TypeScript、Vitest 和 Playwright 版本，不随模板升级。

## 检查与构建

```sh
pnpm lint
pnpm typecheck
pnpm check
pnpm test:upstream
pnpm test:upstream:verify
pnpm check:package
pnpm build:demo
```

`tsdown` 构建两个 ESM 入口、声明和 source map，并运行 publint。Vite 用于示例开发和示例站构建。`pnpm dev:lib` 监听库源码。

ESLint 使用 Antfu 配置，保留现有格式；固定上游测试与机器证据不参与自动改写，由类型检查、来源映射和浏览器测试验证。`prepare` 在开发仓库安装提交钩子，提交时只检查暂存的 JS/TS 文件；CI 和安装包消费跳过钩子安装。

上游基准使用 `pnpm test:upstream:benchmarks` 独立运行，完整重复测量需要数分钟。修改源码、依赖、锁文件或配置后，旧证据会被指纹检查标为过期；必须重新执行相应组，不能手工把旧报告改成通过。详见 [上游验证](./docs/upstream-validation.md)。

## 版本与发布

`pnpm release` 仅交互更新版本，关闭自动 commit、tag 和 push。确认变更后执行 `pnpm check:package` 和 `pnpm pack` 检查包内容。版本标签或手动 Release 工作流构建可下载的包附件。

当前包名尚未正式确认，保留 `private: true`，工作流不发布 npm。正式发布前应确认包名、移除 private、配置 npm Trusted Publishing，再加入发布步骤；不要复用模板作者的账号、funding 或仓库元数据。
