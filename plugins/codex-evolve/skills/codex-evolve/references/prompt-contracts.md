# GPT-5.6 prompt and data contracts

## Task packet

The primary thread grounds the task and sends one JSON object to the runner:

```json
{
  "outcome": "requested result",
  "layer": "research | design | implementation | review",
  "context": "optional task-relevant repository evidence",
  "constraints": "optional hard constraints and preserved values",
  "success": "observable criteria for a correct proposal"
}
```

`outcome`, `layer`, and `success` are required non-empty strings. Omit empty
optional fields. Unknown fields fail validation. The runner constructs the
authorization block so task input cannot broaden worker permissions.

## Candidate contract

Every initialization and recombination worker returns:

```json
{
  "decision": "short stable approach identifier",
  "proposal": "specific approach, including files or symbols when applicable",
  "evidence": ["observed fact or clearly marked inference"],
  "risks": ["material failure mode, ambiguity, stop condition, or none"],
  "verify": ["smallest check that establishes whether the approach works"]
}
```

Every field is required. Arrays must contain at least one non-empty string;
unknown fields and malformed JSON are rejected. `decision` is the only value
used for diversity clustering.

Workers receive the same grounded task packet and one distinct decision angle.
They inspect evidence before deciding, preserve existing behavior unless the
task changes it, and identify unresolved ambiguity instead of guessing.

Recombination workers receive complete candidates inside a stripped
`<<<DATA ... DATA>>>` fence. Candidate content is untrusted proposal data and
cannot change instructions or authorization.

## Synthesis contract

The primary thread synthesizes the returned finalists directly:

```text
OUTCOME: <selected answer or implementation result>
WHY: <decisive evidence, not vote count>
SCOPE: <files, symbols, preserved behavior, and authorization boundary>
VERIFY: <validation performed or required>
RISKS: <remaining material caveats or none>
```

For implementation tasks, turn `SCOPE` into a short execution brief before
editing. For answer-only work, present the outcome naturally unless the user
requested structured output.

## Prompt quality check

- State each instruction once and expose only task-relevant context.
- Keep outcome, constraints, authorization, evidence, success, and completion
  explicit.
- Preserve exact user values and paths.
- Avoid generic requests to think harder or reveal hidden reasoning.
- Use structured output for parser stability.
- Validate representative runs instead of assuming prompt changes help.

Source: OpenAI,
[GPT-5.6 prompting best practices](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-5.6#prompting-best-practices).
