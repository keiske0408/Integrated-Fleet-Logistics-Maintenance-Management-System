---
name: superpowers
description: >-
  Provides advanced agentic problem solving, task decomposition, autonomous verification,
  rapid prototyping, and deep root-cause debugging superpowers. Use when tackling complex
  multi-step tasks, investigating challenging bugs, or executing large refactors.
---

# Superpowers Skill

This skill equips the agent with high-leverage workflows and engineering superpowers: systematic task decomposition, hypothesis-driven debugging, proactive edge-case discovery, and autonomous end-to-end verification.

---

## 1. The Autonomous Execution Loop

When executing complex tasks or features, follow the 4-phase superpower cycle:

```
[ Understand & Probe ] ➔ [ Hypothesize & Plan ] ➔ [ Implement Leanly ] ➔ [ Verify & Guard ]
```

1. **Understand & Probe**:
   - Inspect active schemas, contracts, and existing utilities before writing new code.
   - Trace data flow from storage/DB up to API endpoints and UI view layer.
2. **Hypothesize & Plan**:
   - Formulate clear, falsifiable hypotheses for bugs or architectural additions.
   - Identify which domain constraints (e.g. `docs/FLEET_DOMAIN_RULES.md`) apply.
3. **Implement Leanly**:
   - Adhere strictly to the anti-slop rules (2+ rule for abstractions, minimal surface area).
   - Reuse existing primitives and schemas.
4. **Verify & Guard**:
   - Write or execute automated tests.
   - Run type checks and linters (`npx tsc --noEmit`, `npm run lint`).
   - Validate negative paths (unauthorized access, boundary conditions, malformed input).

---

## 2. Hypothesis-Driven Root Cause Debugging

When unexpected behavior occurs:

1. **Reproduce First**:
   - Capture exact failing state with a minimal unit or integration test before touching code.
2. **Formulate Invariants**:
   - Pinpoint what was assumed vs what actually held true (e.g. type coercion, async timing, missing middleware).
3. **Structured Instrumentation**:
   - Use `logger.debug('[module]', ...)` with contextual payloads to inspect variables.
   - Never rely on bare `console.log`.
   - Remove instrumentation once root cause is diagnosed and fixed.
4. **Permanent Regression Guard**:
   - Keep the failing test case permanently in the test suite to ensure the bug never regresses.

---

## 3. High-Leverage Task Decomposition

For large, multi-faceted requests:

- Break work into atomic, independently testable slices (Database ➔ Core Domain ➔ API Middleware ➔ UI Components).
- Keep pull-request/diff sizes compact and reviewable.
- Ensure every step leaves the codebase in a compilable, lint-clean, test-passing state.
