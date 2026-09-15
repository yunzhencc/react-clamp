import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

// Published archives and CI do not install local Git hooks.
if (!process.env.CI && !process.env.SKIP_INSTALL_SIMPLE_GIT_HOOKS && existsSync(".git")) {
  const result = spawnSync(process.execPath, ["node_modules/simple-git-hooks/cli.js"], { stdio: "inherit" });
  process.exitCode = result.status ?? 1;
}
