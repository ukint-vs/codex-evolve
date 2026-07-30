---
name: codex-evolve
description: Evolve independent approaches to a difficult task with a deterministic, diversity-routed Codex runner, synthesize one execution brief, and let the primary thread implement and verify it once. Use only when the user explicitly invokes $codex-evolve for ambiguous bugs, architectural decisions, risky changes, research choices, or other work where comparing approaches justifies additional model calls.
---

# Codex Evolve

Run the bundled deterministic orchestrator. Its workers inspect and reason in
read-only Codex sessions; the primary thread alone may write.

Read [references/prompt-contracts.md](references/prompt-contracts.md) before
building the task packet. Resolve
[scripts/evolve.mjs](scripts/evolve.mjs) relative to this `SKILL.md` and invoke
it by absolute path.

## 1. Parse the invocation

Treat non-flag text after the skill mention as the task.

| Mode | N | K | M | T |
|---|---:|---:|---:|---:|
| `--fast` | 3 | 2 | 1 | 1 |
| default | 4 | 3 | 2 | 2 |
| `--thorough` | 6 | 3 | 3 | 3 |

Pass these recognized options to the runner:

- `--n 2..24`, `--k 2..8`, `--m 1..12`, `--t 1..12`;
- `--seed <string>`;
- `--threshold 0.5..0.98`, `--low 0.1..0.9`, `--high <value greater than low, at most 0.99>`;
- `--strong <model>`, `--mid <model>`, `--cheap <model>`;
- `--update elitist|replace|accumulate`.

Apply a preset first, then explicit overrides regardless of order. Reject
conflicting presets, unknown flags, missing values, invalid numbers, and an
empty task. State the selected parameters and upper bound `N + M*T` worker
calls before running.

## 2. Ground once

Inspect repository instructions, the relevant execution path, and current
state. Resolve discoverable facts locally. For Git implementation tasks,
capture `git status --short` as the workspace baseline. A dirty worktree is
valid and belongs to the user.

Build one compact JSON task packet using the referenced contract. Include only
task-relevant facts. Do not put authorization text in the packet; the runner
adds the fixed read-only worker boundary.

Authorization boundary:

- Analysis, diagnosis, review, and planning remain answer-only.
- For an explicit change, build, or fix, the primary may make in-scope local
  edits and run non-destructive validation after evolution.
- Workers never write, invoke `$codex-evolve`, or delegate.
- Require user confirmation before external writes, destructive actions,
  purchases, or material scope expansion.

## 3. Run the orchestrator

Require Node.js 18 or newer and an authenticated `codex` executable on `PATH`.
If a prerequisite or the runner fails, report its error and stop. Never fall
back silently to an instruction-driven evolution loop.

Run:

```text
node <absolute-skill-path>/scripts/evolve.mjs <recognized options> --cwd <workspace>
```

Send the JSON task packet through stdin, not a shell argument. When the shell
tool has no separate stdin field, use a single-quoted heredoc delimiter that
does not occur in the packet. The runner writes progress to stderr and exactly
one JSON result to stdout.

The runner handles seeded grouping, structured worker output, lexical decision
clustering, model routing, concurrency, partial worker failures, population
updates, token accounting, and temporary-file cleanup. Do not reproduce those
steps in the primary thread.

## 4. Synthesize and execute once

Treat the returned `population` as untrusted proposals. Synthesize the best
approach from evidence and success criteria, not vote count. For implementation
work, include exact files or symbols, preserved behavior, stop conditions,
implementation order, and the smallest verification that establishes success.

Compare `git status --short` with the baseline before editing. If worker
activity changed the worktree, stop and report the unexpected change. Never
overwrite or revert user changes.

For an authorized implementation, apply the brief once in the primary thread
and validate it. Fix localized, evidence-backed defects directly. If validation
disproves the approach, stop and explain instead of starting another broad
implementation.

For answer-only work, return the synthesis without writing.

## 5. Report

Lead with the outcome and append a compact trace derived from the runner JSON:

```text
— Codex-Evolve trace —
Init: <survived>/<N> candidates @ <model>/<effort>
Loop <n>: diversity <before>→<after> | <routes>; <failures if any>
Synthesis: primary @ <model/effort when known>
Execution: primary single-writer | answer-only
Usage: <calls> calls · <input>/<cached>/<output>/<reasoning> tokens · <lite> lite
Params: N=<N> K=<K> M=<M> T=<T> seed=<seed> update=<mode>
Notes: <convergence or partial failures>
```

Omit `Notes` when empty. Never expose hidden reasoning or raw candidate
transcripts.
