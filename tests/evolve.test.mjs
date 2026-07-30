import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmod, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

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

const runnerPath = fileURLToPath(
  new URL(
    "../plugins/codex-evolve/skills/codex-evolve/scripts/evolve.mjs",
    import.meta.url,
  ),
);

function waitForClose(child, timeout = 3_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("child did not exit"));
    }, timeout);
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal });
    });
  });
}

test("arguments preserve presets and apply explicit overrides regardless of order", () => {
  const first = parseArgs(["--n", "5", "--fast", "--seed", "x"]).params;
  const second = parseArgs(["--fast", "--seed", "x", "--n", "5"]).params;
  assert.equal(first.n, 5);
  assert.equal(first.k, 2);
  assert.equal(first.timeout, 600);
  assert.deepEqual(first, second);
  assert.equal(parseArgs(["--timeout", "30"]).params.timeout, 30);
  assert.throws(() => parseArgs(["--fast", "--thorough"]), /cannot be combined/);
  assert.throws(() => parseArgs(["--high", "0.4"]), /greater than --low/);
  assert.throws(() => parseArgs(["--timeout", "29"]), /between 30 and 3600/);
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
  assert.ok(similarity("方案甲", "方案乙") < 0.8);
  assert.equal(clusterIndices(["方案甲", "方案乙"], 0.8).length, 2);
});

test("groups never duplicate members when K exceeds the live population", () => {
  const [group] = formGroups([0, 1], 1, 8, makeRng(42));
  assert.deepEqual([...new Set(group)].sort(), [0, 1]);
  const decisions = ["sqlite", "redis"];
  const clusters = clusterIndices(
    group.map((index) => decisions[index]),
    0.8,
  ).length;
  assert.equal(routeByDiversity(clusters, group.length, 0.5, 0.8).profile, "strong");
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

test("stalled workers time out and report a bounded failure", async () => {
  let aborted = 0;
  const logs = [];
  const params = parseArgs([
    "--n",
    "2",
    "--k",
    "2",
    "--m",
    "1",
    "--t",
    "1",
  ]).params;
  params.timeout = 0.02;

  await assert.rejects(
    runEvolution({
      task: {
        outcome: "choose a cache",
        layer: "design",
        success: "one proposal",
      },
      params,
      runWorker: ({ signal }) =>
        new Promise((_, reject) => {
          signal.addEventListener(
            "abort",
            () => {
              aborted += 1;
              reject(new Error("aborted"));
            },
            { once: true },
          );
        }),
      log: (message) => logs.push(message),
    }),
    /all initialization workers failed:.*timed out/,
  );
  assert.equal(aborted, 2);
  assert.ok(logs.some((message) => message.startsWith("Failed init:1")));
});

test("cancellation stops evolution before another worker stage starts", async () => {
  const controller = new AbortController();
  const labels = [];
  const params = parseArgs([
    "--n",
    "2",
    "--k",
    "2",
    "--m",
    "1",
    "--t",
    "1",
  ]).params;
  const evolution = runEvolution({
    task: {
      outcome: "choose a cache",
      layer: "design",
      success: "one proposal",
    },
    params,
    signal: controller.signal,
    runWorker: ({ label, signal }) => {
      labels.push(label);
      if (label === "init:1") {
        return Promise.resolve({ candidate: candidate("sqlite"), usage: {} });
      }
      return new Promise((_, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")), {
          once: true,
        });
      });
    },
  });
  setTimeout(() => controller.abort(), 10);

  await assert.rejects(evolution, /interrupted/);
  assert.deepEqual(labels.sort(), ["init:1", "init:2"]);
});

test("the CLI subprocess path succeeds, cleans up, and exits 130 on SIGINT", async () => {
  const root = await mkdtemp(join(tmpdir(), "codex-evolve-test-"));
  const bin = join(root, "bin");
  const scratch = join(root, "tmp");
  await mkdir(bin);
  await mkdir(scratch);
  const fakeCodex = join(bin, "codex");
  await writeFile(
    fakeCodex,
    `#!/usr/bin/env node
if (process.argv.includes("--version")) process.exit(0);
if (process.env.FAKE_CODEX_MODE === "hang") {
  process.stdin.resume();
  setInterval(() => {}, 1000);
} else {
  const candidate = {
    decision: "sqlite",
    proposal: "use sqlite",
    evidence: ["fixture"],
    risks: ["none"],
    verify: ["test"],
  };
  process.stdout.write(JSON.stringify({
    type: "item.completed",
    item: { type: "agent_message", text: JSON.stringify(candidate) },
  }) + "\\n");
  process.stdout.write(JSON.stringify({
    type: "turn.completed",
    usage: {
      input_tokens: 10,
      cached_input_tokens: 2,
      output_tokens: 3,
      reasoning_output_tokens: 1,
    },
  }) + "\\n");
}
`,
  );
  await chmod(fakeCodex, 0o755);
  const task = JSON.stringify({
    outcome: "choose a cache",
    layer: "design",
    success: "one proposal",
  });
  const run = (mode) =>
    spawn(
      process.execPath,
      [
        runnerPath,
        "--n",
        "2",
        "--k",
        "2",
        "--m",
        "1",
        "--t",
        "1",
        "--cwd",
        process.cwd(),
      ],
      {
        env: {
          ...process.env,
          FAKE_CODEX_MODE: mode,
          PATH: `${bin}${delimiter}${process.env.PATH}`,
          TMPDIR: scratch,
        },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );

  try {
    const success = run("success");
    let stdout = "";
    success.stdout.setEncoding("utf8");
    success.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    success.stdin.end(task);
    assert.deepEqual(await waitForClose(success), { code: 0, signal: null });
    assert.equal(JSON.parse(stdout).trace.usage.calls, 2);
    assert.deepEqual(await readdir(scratch), []);

    const interrupted = run("hang");
    let stderr = "";
    interrupted.stderr.setEncoding("utf8");
    const started = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("worker did not start")), 2_000);
      interrupted.stderr.on("data", (chunk) => {
        stderr += chunk;
        if (stderr.includes("Start init:1")) {
          clearTimeout(timer);
          resolve();
        }
      });
    });
    interrupted.stdin.end(task);
    await started;
    interrupted.kill("SIGINT");
    assert.deepEqual(await waitForClose(interrupted), {
      code: 130,
      signal: null,
    });
    assert.deepEqual(await readdir(scratch), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
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
      label: "loop1:group1:high",
      model: "gpt-5.6-sol",
      effort: "high",
    },
  );
});
