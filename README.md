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

Workers remain read-only. For an authorized change task, the primary thread is
the only writer and runs the final validation.

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
