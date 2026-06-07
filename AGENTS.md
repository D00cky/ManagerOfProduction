# AGENTS.md

## Working Agreement

This project follows XP practices with a strict TDD workflow. Every agent working in this repository must preserve the behavior already covered by tests and must add tests before adding or changing production behavior.

## TDD Rules

- Write a failing test before implementing a new feature, bug fix, or rule change.
- Keep each test focused on one observable behavior.
- Implement the smallest production change that makes the test pass.
- Refactor only after the tests are green.
- Do not add broad abstractions until duplication or complexity is demonstrated by tests.
- When modifying existing behavior, update or add regression tests first so the intended change is explicit.
- Do not leave skipped tests unless the reason and follow-up condition are documented next to the test.

## XP / Pair Programming Rules

- Work in small, reviewable increments.
- Explain tradeoffs briefly before larger edits.
- Prefer simple design, clear names, and direct code over speculative architecture.
- Keep feedback loops short: run the smallest relevant test set first, then broader checks.
- Treat tests as shared documentation of business rules.
- If a requirement is ambiguous and a reasonable assumption would affect data, security, or permissions, ask before coding.

## Quality Bar

- New domain logic must have unit tests.
- API routes and permission-sensitive flows must have integration tests.
- User-critical workflows must have E2E tests before being considered complete.
- Permission and data-scope rules must be tested for both allowed and denied access.
- Bugs must include a regression test that fails before the fix.
- A change is not complete until relevant tests and type checks have been run, or the reason they could not be run is reported.
- After a successful implementation with green validation, commit the completed change with a clear message.

## Project-Specific Rules

- Fiscal users can only see OS assigned to their own `fiscalId`.
- Monitor users can only see authorized polos; default scope is their own polo.
- Supervisor users can access all polos and administrative features.
- OS deletion is logical cancellation through status `Cancelada`; do not physically delete normal OS records.
- Finalizing an OS requires a saved tabulation.
- Sidebar and API access must derive from the permission model.
- FFR concept calculation must keep `X`, `null`, text fields, and weight `0` out of both obtained and possible totals.

## Documentation / Roadmap Rules

- Treat `/home/d00cky/Downloads/ARQUITETURA_FFR_PLANEJAMENTO.md` as roadmap architecture, not current implementation.
- Documentation must clearly separate `implemented`, `demo-only`, and `future roadmap` behavior.
- Render free-tier SQLite, `DEMO_AUTH_ENABLED`, seeded users, seeded OS, and `Example/demo-os.xlsx` are demo/test conveniences only.
- Do not describe the app as production-ready for analytics/conformidade until persistent PostgreSQL (and any required analytics schema) is implemented and validated.
- If a future feature from the architecture document is implemented, add tests first and then move it from roadmap wording into implemented wording.

## Implementation Order

1. Add or update tests for the intended behavior.
2. Run the focused tests and confirm they fail for the expected reason when practical.
3. Implement the minimal production code.
4. Run focused tests again.
5. Run broader checks before handoff: unit tests, type check, and relevant integration or E2E tests.
