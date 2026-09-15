#!/usr/bin/env node
/** Aggregate explicit Vitest JSON files; never infer a pass from source names. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, relative, join } from "node:path";
import {
  root,
  groups,
  inputs,
  sha256,
  configuredBrowsers,
} from "./upstream-inputs.mjs";
const args = process.argv.slice(2);
const allowIncomplete = args.includes("--allow-incomplete");
const updateInventory = args.includes("--update-inventory");
const paths = args.filter((arg) => !arg.startsWith("--"));
assert(
  paths.length,
  "Supply Vitest JSON report paths (or wrapped type-check reports).",
);
const inventoryPath = join(root, "docs/upstream-test-inventory.json");
const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
const reports = paths.map((path) => {
  const absolutePath = resolve(path),
    bytes = readFileSync(absolutePath),
    report = JSON.parse(bytes);
  const found = new Set(
    (report.testResults ?? [])
      .map(
        (file) =>
          relative(root, file.name).match(/^tests\/upstream\/([^/]+)\//)?.[1],
      )
      .filter(Boolean),
  );
  const group =
    report.reactClampVerification?.group ??
    (found.size === 1 ? [...found][0] : null);
  assert(
    groups.includes(group),
    `Report does not identify exactly one upstream suite: ${path}`,
  );
  const current = inputs(group),
    recorded = report.reactClampVerification;
  const sourceStatus = recorded
    ? recorded.inputsUnchangedDuringRun &&
      recorded.after.digest === current.digest
      ? "hash-pinned-current"
      : "stale-or-changed-during-run"
    : current.latestInputMtimeMs <= report.startTime
      ? "mtime-audited-current-unpinned"
      : "stale-or-unpinned";
  return {
    path: absolutePath,
    sha256: sha256(bytes),
    group,
    report,
    current,
    sourceStatus,
  };
});
assert.equal(
  new Set(reports.map((report) => report.group)).size,
  reports.length,
  "Supply one final report per suite.",
);
const suiteResults = reports.map(
  ({ path, sha256, group, report, current, sourceStatus }) => ({
    group,
    reportPath: path,
    reportSha256: sha256,
    sourceStatus,
    currentInputs: current,
    success:
      report.success === true &&
      (report.reactClampVerification?.exitCode ?? 0) === 0,
    passed: report.numPassedTests ?? 0,
    failed: report.numFailedTests ?? 0,
    pending: (report.numPendingTests ?? 0) + (report.numTodoTests ?? 0),
    smoke:
      report.reactClampVerification?.smoke ??
      (group === "benchmarks" ? null : false),
    configuredBrowsers:
      report.reactClampVerification?.configuredBrowsers ??
      configuredBrowsers(group),
    startedAt: report.startTime,
    endedAt:
      report.reactClampVerification?.endTime ??
      Math.max(0, ...(report.testResults ?? []).map((file) => file.endTime)),
  }),
);
// This exact upstream test conditionally skips only when WebKit omits loadingdone.
// Hashes pin both the original fixture and its reviewed import-only React port.
const fontCompletionSkip = {
  upstreamFile: "packages/vue-clamp/tests/font-delivery.browser.test.ts",
  upstreamSha256:
    "f84ef8edf6d9419c3d25c87008cfac014cb4feb71e64668895322d25fbd6870d",
  localFile: "tests/upstream/engine/font-delivery.browser.test.ts",
  localSha256:
    "0938d4ba6d62ac4d9e31d0abf5d45793da11a0e2cb492761f560ca6432e327bc",
  name: "keeps real font completion after subscribing before font discovery",
};
function permittedConditionalSkip(original, evidence) {
  const rule = fontCompletionSkip;
  if (
    original.path !== rule.upstreamFile ||
    original.sha256 !== rule.upstreamSha256 ||
    evidence.length !== 3 ||
    sha256(readFileSync(join(root, rule.localFile))) !== rule.localSha256 ||
    evidence.some(
      (item) =>
        item.localFile !== rule.localFile ||
        [...item.configuredBrowsers].sort().join(",") !==
          "chromium,firefox,webkit",
    )
  )
    return null;
  const exceptions = evidence.flatMap((item) => item.failures);
  if (
    exceptions.length !== 1 ||
    exceptions[0].name !== rule.name ||
    exceptions[0].status !== "skipped" ||
    exceptions[0].messages?.length
  )
    return null;
  const executions = evidence.flatMap((item) =>
    item.cases.filter((test) => test.name === rule.name),
  );
  if (
    executions.length !== 3 ||
    executions.filter((test) => test.status === "passed").length !== 2
  )
    return null;
  return {
    upstreamFile: rule.upstreamFile,
    localFile: rule.localFile,
    name: rule.name,
    status: "skipped",
    count: 1,
    passedOtherExecutions: 2,
    platform: "webkit",
    reason:
      "The unchanged upstream guard skips when WebKit does not emit native font loadingdone.",
    attribution:
      "Platform follows the hash-pinned source guard; Vitest JSON does not label browser instances.",
  };
}
const files = [];
for (const original of inventory.files) {
  const mappings = original.correspondence.localTests ?? [];
  const candidates = mappings.filter(
    (local) => local.path && existsSync(join(root, local.path)),
  );
  const hashesMatch =
    candidates.length > 0 &&
    candidates.every(
      (local) =>
        !local.sha256 ||
        local.sha256 === sha256(readFileSync(join(root, local.path))),
    );
  const evidence = [];
  for (const local of candidates)
    for (const item of reports) {
      const matches =
        item.report.testResults?.filter(
          (file) => resolve(file.name) === join(root, local.path),
        ) ?? [];
      matches.forEach((result, instanceOrdinal) =>
        evidence.push({
          runtimeInstanceOrdinal: instanceOrdinal,
          configuredBrowsers:
            item.report.reactClampVerification?.configuredBrowsers ??
            configuredBrowsers(item.group),
          localFile: local.path,
          group: item.group,
          report: item.path,
          reportSuccess:
            item.report.success === true &&
            (item.report.reactClampVerification?.exitCode ?? 0) === 0,
          sourceStatus: item.sourceStatus,
          passed: result.assertionResults.filter(
            (test) => test.status === "passed",
          ).length,
          total: result.assertionResults.length,
          failures: result.assertionResults
            .filter((test) => test.status !== "passed")
            .map((test) => ({
              name: test.fullName,
              status: test.status,
              messages: test.failureMessages,
            })),
          cases: result.assertionResults.map((test) => ({
            name: test.fullName,
            status: test.status,
          })),
          fileStatus: result.status,
        }),
      );
    }
  const expectedCases = original.declarations.reduce(
    (sum, item) => sum + (item.staticallyExpandedCaseCount ?? 0),
    0,
  );
  let status = original.declarations.length
    ? "missing-runtime-report"
    : original.correspondence.status;
  const conditionalSkip = permittedConditionalSkip(original, evidence);
  if (original.declarations.length && evidence.length) {
    const expectedInstances = Math.max(
      1,
      ...evidence.map((item) => item.configuredBrowsers.length),
    );
    const complete =
      evidence.length === expectedInstances &&
      evidence.every(
        (item) =>
          item.reportSuccess &&
          item.total === expectedCases &&
          (item.failures.length === 0 || !!conditionalSkip) &&
          item.fileStatus === "passed",
      );
    status = !hashesMatch
      ? "stale-correspondence-source-hash"
      : !complete
        ? "failed-or-incomplete-runtime"
        : evidence.every((item) => item.sourceStatus === "hash-pinned-current")
          ? conditionalSkip
            ? "passed-with-upstream-platform-skip"
            : "passed-hash-pinned-current"
          : conditionalSkip
            ? "runtime-with-upstream-platform-skip-unpinned-or-stale"
            : "passed-runtime-unpinned-or-stale";
  }
  if (original.category === "type-contract") {
    const types = suiteResults.find((item) => item.group === "types");
    status = !types
      ? "missing-typecheck-report"
      : !types.success
        ? "typecheck-failed"
        : types.sourceStatus === "hash-pinned-current" && hashesMatch
          ? "typechecked-hash-pinned-current"
          : "typechecked-unpinned-or-stale";
  }
  files.push({
    upstreamFile: original.path,
    upstreamSha256: original.sha256,
    category: original.category,
    expectedExpandedCases: expectedCases,
    correspondenceHashesMatch: hashesMatch,
    correspondenceStatus: original.correspondence.status,
    status,
    conditionalSkip,
    evidence,
  });
}
const manifests = [
  ...new Set(
    inventory.files.flatMap((file) => file.correspondence.evidence ?? []),
  ),
]
  .filter((path) => existsSync(join(root, path)))
  .map((path) => ({ path, sha256: sha256(readFileSync(join(root, path))) }));
const functional = files.filter((file) =>
  file.upstreamFile.endsWith(".test.ts"),
);
const complete =
  functional.length === 39 &&
  functional.every((file) =>
    [
      "passed-hash-pinned-current",
      "passed-with-upstream-platform-skip",
    ].includes(file.status),
  ) &&
  files
    .filter((file) => file.category === "type-contract")
    .every((file) => file.status === "typechecked-hash-pinned-current");
const benchmark = suiteResults.find((item) => item.group === "benchmarks");
const benchmarkSummaryPath = join(
  root,
  "docs/upstream-benchmark-verification.json",
);
const benchmarkSummary = existsSync(benchmarkSummaryPath)
  ? JSON.parse(readFileSync(benchmarkSummaryPath, "utf8"))
  : null;
const benchmarkMetricsPath = benchmarkSummary?.metricsReport?.path
  ? resolve(root, benchmarkSummary.metricsReport.path)
  : null;
const benchmarkMetricsBytes =
  benchmarkMetricsPath && existsSync(benchmarkMetricsPath)
    ? readFileSync(benchmarkMetricsPath)
    : null;
const benchmarkMetrics = benchmarkMetricsBytes
  ? JSON.parse(benchmarkMetricsBytes)
  : null;
const benchmarkRepetitionsVerified =
  !!benchmark &&
  benchmarkSummary?.vitestReportSha256 === benchmark.reportSha256 &&
  benchmarkSummary?.metricsReport?.sha256 ===
    (benchmarkMetricsBytes && sha256(benchmarkMetricsBytes)) &&
  [benchmarkSummary, benchmarkMetrics].every(
    (item) =>
      item?.mode === "full" &&
      item.matrixComplete === true &&
      item.repetitionCountsVerified === true &&
      item.expectedWorkloads === 114 &&
      item.observedWorkloads === 114,
  ) &&
  benchmarkMetrics?.upstreamSha === inventory.upstream.commit &&
  benchmarkMetrics?.status === "passed";
if (updateInventory) {
  for (const entry of files) {
    const original = inventory.files.find(
      (file) => file.path === entry.upstreamFile,
    );
    if (!original.declarations.length && original.category !== "type-contract")
      continue;
    const runtime = {
      status: entry.status,
      verificationReport: "docs/upstream-verification.json",
      reports: entry.evidence.map((item) => item.report),
      expectedExpandedCases: entry.expectedExpandedCases,
      conditionalSkip: entry.conditionalSkip,
      note: "Complete containing-file registration and pass status, combined with the separately verified declaration/assertion source correspondence.",
    };
    original.correspondence.runtimeVerification = runtime;
    for (const declaration of original.declarations)
      declaration.correspondence.runtimeVerification = runtime;
  }
  writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);
}
const result = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  upstreamCommit: inventory.upstream.commit,
  inventorySha256: sha256(readFileSync(inventoryPath)),
  mappingManifests: manifests,
  scope: {
    testFiles: 39,
    testDeclarations: inventory.summary.testDeclarations,
    expandedTestCases: inventory.summary.staticExpandedTestCases,
    benchmarkFiles: 6,
    benchmarkDeclarations: 9,
    benchmarkWorkloads: 114,
  },
  functionalAndTypeVerificationComplete: complete,
  conditionalSkips: files.flatMap((file) =>
    file.conditionalSkip ? [file.conditionalSkip] : [],
  ),
  fullBrowserMatrixWithoutSkips:
    complete &&
    functional.every((file) => file.status === "passed-hash-pinned-current"),
  fullThreeBrowserFunctionalCoverage:
    complete &&
    functional
      .filter((file) =>
        file.evidence.some((item) => item.configuredBrowsers.length),
      )
      .every((file) =>
        file.evidence.every(
          (item) =>
            [...item.configuredBrowsers].sort().join(",") ===
            "chromium,firefox,webkit",
        ),
      ) &&
    functional.every((file) => !file.conditionalSkip),
  benchmarkRepetitionEvidence: {
    status: benchmarkRepetitionsVerified
      ? "verified-full-repetitions"
      : "missing-stale-or-incomplete-repetition-evidence",
    summaryPath: relative(root, benchmarkSummaryPath),
    summarySha256: existsSync(benchmarkSummaryPath)
      ? sha256(readFileSync(benchmarkSummaryPath))
      : null,
    metricsPath: benchmarkMetricsPath,
  },
  benchmarkVerificationComplete:
    benchmarkRepetitionsVerified &&
    !!benchmark?.success &&
    benchmark.sourceStatus === "hash-pinned-current" &&
    benchmark.smoke === false &&
    files
      .filter((file) => file.category === "browser-benchmark")
      .every((file) => file.status === "passed-hash-pinned-current"),
  boundaries: [
    "Only hash-pinned, unchanged before/after inputs count as current final verification.",
    "Imported bare Vitest reports remain unpinned; modification timestamps are diagnostic, not a substitute for before/after hashes.",
    "Functional suite completion excludes benchmark execution and performance comparison claims.",
    "One exact upstream WebKit font loadingdone conditional skip is recorded separately and allowed only when the same case passes the other two browser executions; it is never counted as passed.",
    "Case correspondence comes from the pinned AST/source mapping; runtime names and counts alone are not behavioral equivalence proof.",
    "Runtime metadata and browser config hashes define the tested environment; no React18 or cross-browser pass is inferred.",
  ],
  suites: suiteResults,
  files,
};
writeFileSync(
  join(root, "docs/upstream-verification.json"),
  `${JSON.stringify(result, null, 2)}\n`,
);
console.log(
  JSON.stringify(
    {
      functionalAndTypeVerificationComplete: complete,
      benchmarkVerificationComplete: result.benchmarkVerificationComplete,
      runtimePassed: suiteResults.reduce((sum, item) => sum + item.passed, 0),
      reports: suiteResults.map((item) => ({
        group: item.group,
        sourceStatus: item.sourceStatus,
        passed: item.passed,
        failed: item.failed,
        success: item.success,
      })),
    },
    null,
    2,
  ),
);
if (!complete && !allowIncomplete) process.exitCode = 1;
