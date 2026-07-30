# Codex Evolve

Deterministic, diversity-routed problem solving for Codex.

> Codex Evolve is an independent Codex-native adaptation inspired by
> [Squeeze-Evolve](https://github.com/squeeze-evolve/squeeze-evolve). It is not
> affiliated with or endorsed by the Squeeze-Evolve maintainers.

Codex Evolve launches independent read-only Codex workers, clusters their
structured decisions, routes recombination according to disagreement, and lets
the primary thread implement the surviving approach once. A bundled Node runner
controls grouping, routing, population updates, and usage accounting.

## Requirements

- Codex CLI installed and authenticated
- Node.js 18.3 or newer

No API server, Python runtime, MCP server, or separate API key is required.

## Install

### Plugin (recommended)

```bash
codex plugin marketplace add ukint-vs/codex-evolve --ref main
codex plugin add codex-evolve@codex-evolve
```

To pin this release candidate, replace `main` with `v0.2.0-rc.2`.

### Skill only

Install only the skill with the cross-agent
[Skills CLI](https://github.com/vercel-labs/skills):

```bash
npx skills add ukint-vs/codex-evolve/plugins/codex-evolve/skills/codex-evolve --agent codex -g -y
```

Or ask Codex to install it:

```text
$skill-installer install https://github.com/ukint-vs/codex-evolve/tree/main/plugins/codex-evolve/skills/codex-evolve
```

Both methods make `$codex-evolve` available in a new Codex session. Do not
install both copies at once.

## Use

```text
$codex-evolve --fast diagnose this failing test
$codex-evolve --seed cache-v1 choose and implement the safest caching strategy
$codex-evolve --thorough --update accumulate design the next quantization experiment
```

## Options

```text
$codex-evolve [preset] [population options] [routing options] [model options] <task>
```

| Mode | Candidates `N` | Group size `K` | Groups `M` | Loops `T` | Maximum worker calls |
|---|---:|---:|---:|---:|---:|
| `--fast` | 3 | 2 | 1 | 1 | 4 |
| default | 4 | 3 | 2 | 2 | 8 |
| `--thorough` | 6 | 3 | 3 | 3 | 15 |

| Option | Meaning | Default or range |
|---|---|---|
| `--n` | Independent strong-model candidates | 2–24 |
| `--k` | Candidates in each group | 2–8 |
| `--m` | Groups per evolution loop | 1–12 |
| `--t` | Maximum evolution loops | 1–12 |
| `--seed` | Reproducible grouping seed | task text |
| `--threshold` | Decision similarity cutoff | 0.8; range 0.5–0.98 |
| `--low` | Cheap-route disagreement cutoff | 0.5; range 0.1–0.9 |
| `--high` | Strong-route disagreement cutoff | 0.8; greater than low, at most 0.99 |
| `--strong` | Strong model override | `gpt-5.6-sol` |
| `--mid` | Mid model override | `gpt-5.6-terra` |
| `--cheap` | Cheap model override | `gpt-5.6-terra` |
| `--timeout` | Per-worker timeout in seconds | 600; range 30–3600 |
| `--update` | Population update rule | `elitist`, `replace`, or `accumulate` |

Explicit numeric options override the selected preset regardless of argument
order. Presets cannot be combined. Invalid or unknown options fail before
workers start.

The runner also accepts `--cwd DIRECTORY` (supplied by the skill) and
`-h`/`--help`.

The worker-call upper bound is `N + M*T`. Consensus groups require no
recombination call, and evolution stops early after convergence. The seed makes
grouping and routing reproducible for identical candidate data; model outputs
remain stochastic.

Groups contain at most `K` unique candidates. If an update leaves fewer than
`K` candidates, the group shrinks instead of duplicating members and biasing
the disagreement ratio.

## Routing and updates

| Group disagreement | Route |
|---|---|
| One decision cluster | Keep the central candidate; no worker call |
| Ratio `≤ low` | cheap model, low reasoning |
| Ratio `> low` and `< high` | mid model, high reasoning |
| Ratio `≥ high` | strong model, high reasoning |

Update rules:

- `elitist` (default): merge parents and children, keep supported cluster
  representatives, and cap the population at `N`;
- `replace`: replace parents with valid children, retaining parents only when
  every child fails;
- `accumulate`: retain the growing pool during evolution and select at most `N`
  representative finalists.

Every worker runs through `codex exec --ephemeral --ignore-user-config
--sandbox read-only` with a strict JSON schema. The primary thread captures the
worktree baseline, synthesizes the finalists, and performs at most one
authorized implementation. The runner reports worker starts and completions,
prints a heartbeat every 30 seconds, times out stalled workers, and cancels all
remaining work on SIGINT or SIGTERM.

## Algorithm fidelity

| Capability | Codex Evolve |
|---|---|
| Strong-model initialization | Implemented |
| Seeded uniform grouping | Implemented |
| Diversity fitness | Implemented with decision-text similarity |
| Lite consensus aggregation | Implemented with a medoid pick |
| Cheap/mid/strong recombination | Implemented with GPT-5.6 profiles |
| Replace and accumulate updates | Implemented |
| Token-level group confidence | Not available from Codex worker output |
| Fitness-weighted selection | Deferred until a scalar confidence signal exists |
| Latency-matched GPU pools | Outside the local Codex plugin runtime |

The paper explicitly permits answer diversity when token log probabilities are
unavailable. Codex Evolve does not claim reproduction of the paper's benchmark,
accuracy, cost, or throughput results.

## Structure

```text
.github/workflows/ci.yml
.agents/plugins/marketplace.json
plugins/codex-evolve/
├── .codex-plugin/plugin.json
└── skills/codex-evolve/
    ├── SKILL.md
    ├── agents/openai.yaml
    ├── references/prompt-contracts.md
    └── scripts/evolve.mjs
tests/evolve.test.mjs
```

Run the deterministic checks with:

```bash
node --test tests/evolve.test.mjs
```

The prompts follow OpenAI's
[GPT-5.6 prompting best practices](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-5.6#prompting-best-practices):
lean task context, one authorization boundary, explicit success criteria,
structured output, and evidence-backed verification.

## Relationship to Squeeze-Evolve

[Squeeze-Evolve](https://github.com/squeeze-evolve/squeeze-evolve) introduced
the evolutionary inference pattern used here: strong initialization, fitness
signals, selection, routed recombination, and population updates.

Codex Evolve adapts that pattern to repository inspection, local Codex
workers, diversity routing, and a primary-thread single-writer rule. It is not
configuration-compatible with the upstream Python, NVIDIA Dynamo, or Claude
Code implementations.

## License

Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
