// Adapted from vue-clamp at 9f93dbcc31f60b02dc34fbd6a9da9bf90edc6d84; MIT.
function mean(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function sampleStandardDeviation(values: number[], average: number): number {
  if (values.length < 2) {
    return 0;
  }

  const variance =
    values.reduce((total, value) => total + (value - average) ** 2, 0) / (values.length - 1);

  return Math.sqrt(variance);
}

function tCritical95(sampleCount: number): number {
  const values = [
    12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16,
    2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052,
    2.048, 2.045, 2.042,
  ];
  const degreesOfFreedom = sampleCount - 1;

  if (degreesOfFreedom < 1) {
    return Number.POSITIVE_INFINITY;
  }

  return values[degreesOfFreedom - 1] ?? 1.96;
}

export function summarizePairedSamples(before: readonly number[], after: readonly number[]) {
  if (
    before.length < 2 ||
    before.length !== after.length ||
    [...before, ...after].some((value) => !Number.isFinite(value))
  ) {
    throw new Error(
      "Paired samples require matching finite observations from at least two rounds.",
    );
  }

  const differences = after.map((value, index) => value - before[index]!);
  const meanDelta = mean(differences);
  const margin =
    (tCritical95(differences.length) * sampleStandardDeviation(differences, meanDelta)) /
    Math.sqrt(differences.length);
  const lower95 = meanDelta - margin;
  const upper95 = meanDelta + margin;
  const baseline = mean(before);

  return {
    samples: differences.length,
    meanDelta,
    meanDeltaPercent: baseline === 0 ? null : (meanDelta / Math.abs(baseline)) * 100,
    lower95,
    upper95,
    // An interval spanning zero is inconclusive, not proof of equivalence.
    direction: upper95 < 0 ? "lower" : lower95 > 0 ? "higher" : "inconclusive",
  };
}
