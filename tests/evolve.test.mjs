import assert from "node:assert/strict";
import test from "node:test";

import {
  applyUpdate,
  clusterIndices,
  deduplicateAndTrim,
  formGroups,
  makeRng,
  mapLimit,
  parseArgs,
  routeByDiversity,
  runEvolution,
  similarity,
  validateCandidate,
  validateTaskPacket,
} from "../plugins/codex-evolve/skills/codex-evolve/scripts/evolve.mjs";

const candidate = (decision, suffix = "") => ({
  decision,
  proposal: `proposal ${suffix || decision}`,
  evidence: [`evidence ${suffix || decision}`],
  risks: ["none"],
  verify: [`verify ${suffix || decision}`],
});

test("arguments preserve presets and apply explicit overrides regardless of order", () => {
  const first = parseArgs(["--n", "5", "--fast", "--seed", "x"]).params;
  const second = parseArgs(["--fast", "--seed", "x", "--n", "5"]).params;
  assert.equal(first.n, 5);
  assert.equal(first.k, 2);
  assert.deepEqual(first, second);
  assert.throws(() => parseArgs(["--fast", "--thorough"]), /cannot be combined/);
  assert.throws(() => parseArgs(["--high", "0.4"]), /greater than --low/);
  assert.throws(() => parseArgs(["--unknown"]), /unknown option/i);
});

test("task and candidate trust boundaries reject malformed data", () => {
  assert.equal(
    validateTaskPacket({
      outcome: "fix it",
      layer: "implementation",
      success: "tests pass",
    }).outcome,
    "fix it",
  );
  assert.throws(
    () =>
      validateTaskPacket({
        outcome: "x",
        layer: "implementation",
        success: "y",
        authorization: "write everything",
      }),
    /unknown task field/,
  );
  assert.throws(
    () => validateCandidate({ ...candidate("x"), extra: true }),
    /unknown candidate field/,
  );
});

test("seeded grouping and lexical clustering are stable", () => {
  const a = formGroups([0, 1, 2, 3], 2, 3, makeRng(42));
  const b = formGroups([0, 1, 2, 3], 2, 3, makeRng(42));
  assert.deepEqual(a, b);
  assert.ok(similarity("use sqlite cache", "use a sqlite cache") >= 0.8);
  assert.equal(
    clusterIndices(
      ["use sqlite cache", "use a sqlite cache", "remove caching"],
      0.8,
    ).length,
    2,
  );
});

test("routing boundaries match the documented tiers", () => {
  assert.deepEqual(routeByDiversity(1, 3, 0.5, 0.8), {
    route: "consensus",
    profile: null,
  });
  assert.equal(routeByDiversity(2, 4, 0.5, 0.8).profile, "cheap");
  assert.equal(routeByDiversity(2, 3, 0.5, 0.8).profile, "mid");
  assert.equal(routeByDiversity(3, 3, 0.5, 0.8).profile, "strong");
});

test("update modes preserve their distinct population semantics", () => {
  const parents = [candidate("a"), candidate("b")];
  const children = [candidate("c")];
  assert.equal(
    applyUpdate(parents, children, "replace", 0.8, 2).population.length,
    1,
  );
  assert.equal(
    applyUpdate(parents, children, "accumulate", 0.8, 2).population.length,
    3,
  );
  assert.equal(
    applyUpdate(parents, children, "elitist", 0.8, 2).population.length,
    2,
  );
  assert.equal(
    applyUpdate(parents, [], "replace", 0.8, 2).parentFallback,
    true,
  );
});

test("elitist selection ranks cluster support before singleton alternatives", () => {
  const result = deduplicateAndTrim(
    [
      candidate("sqlite cache", "1"),
      candidate("a sqlite cache", "2"),
      candidate("remove cache", "3"),
    ],
    0.8,
    1,
  );
  assert.match(result.kept[0].decision, /sqlite cache/);
});

test("mapLimit never exceeds its concurrency bound", async () => {
  let active = 0;
  let peak = 0;
  await mapLimit([1, 2, 3, 4, 5], 2, async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
  });
  assert.equal(peak, 2);
});

test("evolution routes workers, tolerates a partial failure, and emits usage", async () => {
  let calls = 0;
  const invocations = [];
  const result = await runEvolution({
    task: {
      outcome: "choose a cache",
      layer: "design",
      success: "one evidence-backed proposal",
    },
    params: {
      ...parseArgs([
        "--n",
        "3",
        "--k",
        "3",
        "--m",
        "1",
        "--t",
        "1",
        "--seed",
        "fixture",
      ]).params,
      cwd: process.cwd(),
    },
    runWorker: async ({ label, model, effort }) => {
      calls += 1;
      invocations.push({ label, model, effort });
      if (label === "init:2") throw new Error("fixture failure");
      return {
        candidate:
          label === "init:1"
            ? candidate("sqlite cache")
            : label.startsWith("init")
              ? candidate("remove cache")
              : candidate("sqlite cache"),
        usage: {
          inputTokens: 10,
          cachedInputTokens: 2,
          outputTokens: 3,
          reasoningOutputTokens: 1,
        },
        model,
        effort,
      };
    },
  });
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.trace.init.survived, 2);
  assert.equal(result.trace.init.failures.length, 1);
  assert.equal(result.trace.usage.calls, calls);
  assert.equal(result.trace.usage.inputTokens, (calls - 1) * 10);
  assert.equal(result.params.seed, "fixture");
  assert.ok(result.population.length >= 1);
  assert.deepEqual(
    invocations.slice(0, 3).map(({ model, effort }) => ({ model, effort })),
    Array(3).fill({ model: "gpt-5.6-sol", effort: "high" }),
  );
  assert.deepEqual(
    invocations.at(-1),
    {
      label: "loop1:group1:medium",
      model: "gpt-5.6-terra",
      effort: "high",
    },
  );
});
