# Codex Evolve

Evidence-routed multi-agent problem solving for Codex.

> Codex Evolve is an independent Codex-native adaptation inspired by
> [Squeeze-Evolve](https://github.com/squeeze-evolve/squeeze-evolve). It is not
> affiliated with or endorsed by the Squeeze-Evolve maintainers.

Codex Evolve asks independent read-only workers to propose solutions, routes
recombination according to their disagreement, and lets the primary Codex
thread implement the surviving approach once. It is packaged as a local Codex
skill and requires no API server or Python runtime.

## Install

Copy the skill into your personal Codex skills directory:

```bash
mkdir -p ~/.codex/skills/codex-evolve
rsync -a skills/codex-evolve/ ~/.codex/skills/codex-evolve/
```

Start a new Codex session after installation.

## Use

```text
$codex-evolve --fast diagnose this failing test
$codex-evolve choose and implement the safest architecture
$codex-evolve --thorough design the next quantization experiment
```

## Options

```text
$codex-evolve [--fast | --thorough] [--n N] [--k K] [--m M] [--t T] <task>
```

| Mode | Candidates `N` | Group size `K` | Groups `M` | Loops `T` | Maximum worker calls |
|---|---:|---:|---:|---:|---:|
| `--fast` | 3 | 2 | 1 | 1 | 4 |
| default | 4 | 3 | 2 | 2 | 8 |
| `--thorough` | 6 | 3 | 3 | 3 | 15 |

| Option | Meaning | Range |
|---|---|---:|
| `--n` | Independent strong-model candidates | 2–24 |
| `--k` | Candidates in each recombination group | 2–8 |
| `--m` | Groups recombined per evolution loop | 1–12 |
| `--t` | Maximum evolution loops | 1–12 |

Explicit numeric options override the selected preset regardless of argument
order. Presets cannot be combined. Unknown flags, missing values, and values
outside their ranges fail before workers start.

The worker-call upper bound is `N + M*T`. Consensus groups require no
recombination call, and evolution stops early when all surviving candidates
converge, so actual usage can be lower.

Routing is fixed:

| Group disagreement | Route |
|---|---|
| One decision cluster | Keep the central candidate; no worker call |
| Ratio `≤ 0.5` | `gpt-5.6-terra`, low reasoning |
| Ratio `> 0.5` and `< 0.8` | `gpt-5.6-terra`, high reasoning |
| Ratio `≥ 0.8` | `gpt-5.6-sol`, high reasoning |

Candidate workers are always read-only. For tasks that explicitly request a
change, build, or fix, the primary Codex thread implements and validates the
selected approach. Analysis, diagnosis, review, and planning tasks remain
answer-only.

## Structure

```text
skills/codex-evolve/
├── SKILL.md
├── agents/openai.yaml
└── references/prompt-contracts.md
```

The prompt contracts follow OpenAI's
[GPT-5.6 prompting best practices](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-5.6#prompting-best-practices):
lean task context, one authorization boundary, explicit success criteria, and
evidence-backed verification.

## Relationship to Squeeze-Evolve

[Squeeze-Evolve](https://github.com/squeeze-evolve/squeeze-evolve) introduced
the evolutionary inference pattern that inspired this project: sample strong
candidates, measure answer diversity, and route recombination to an appropriate
model tier.

Codex Evolve reimplements that idea around Codex skills, local repository
inspection, read-only subagents, and a primary-thread single-writer rule. It is
not configuration-compatible with the upstream Python, NVIDIA Dynamo, or
Claude Code implementations.

## License

Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
