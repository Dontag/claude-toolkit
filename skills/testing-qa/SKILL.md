---
name: testing-qa
description: Testing strategy and execution across stacks. Use when writing tests, fixing failing tests, setting up test infrastructure, handling flaky tests, or when the user mentions coverage, unit/integration/e2e testing, TDD, or QA.
---

# testing-qa

## Strategy
- **Pyramid**: many unit, fewer integration, few e2e. Integration tests (real DB via testcontainers, real HTTP via supertest/TestClient) give the best value per token — prioritize them for backend.
- Test behavior, not implementation: assert outputs/side-effects, not internal calls. Mock only true externals (network, clock, payments).
- Every bug fix ships with a regression test that failed before the fix — no exceptions.
- Coverage: aim ~80% on core logic; 100% on money/auth/permissions paths; don't chase coverage on glue code.

## Framework commands (detect from lockfile/config, don't ask)
| Stack | Runner | One-file run |
|---|---|---|
| JS/TS | Vitest / Jest | `npx vitest run path` / `npx jest path` |
| React | Testing Library | query by role/label, never by class |
| E2E web | Playwright | `npx playwright test --grep "name"` |
| Python | pytest | `pytest path::test_name -x -q` |
| Go | go test | `go test ./pkg/... -run TestName` |
| Java | JUnit 5 | `mvn -Dtest=Class#method test` |
| PHP | Pest/PHPUnit | `./vendor/bin/pest --filter name` |
| Flutter | flutter_test | `flutter test path` |
| RN | Jest + RNTL | `npx jest path` |

Run the narrowest scope first (single test → file → suite). Full suite only before declaring done.

## Writing good tests
- Name = behavior: `rejects expired token`, not `test1`. Arrange-Act-Assert with blank lines between.
- One behavior per test; table-driven/parameterized for input matrices.
- Builders/factories over fixtures for test data; make invalid states impossible to construct accidentally.
- Async: await everything; use fake timers for time logic; never `sleep()` to "wait for" state — poll or use events.

## Fixing failures (order of operations)
1. Read the failure message fully — it usually says exactly what's wrong.
2. Is the test wrong or the code wrong? Check git blame/ticket intent before "fixing" a correct test.
3. Reproduce locally in isolation (single test). If it passes alone but fails in suite → shared state; find the leaking test.
4. Never fix by deleting assertions, widening tolerances, or adding `skip` — flag instead if truly obsolete.

## Flaky tests
Causes in order of likelihood: time/timezone deps → test-order/shared state → real network → race in async waits → random data without seed. Fix by injecting clocks, isolating state per test, seeding randomness. Quarantine (tag + track in a ticket) rather than retry-loops.

## E2E discipline
Cover the 3–5 critical user journeys only (signup, login, core action, payment). Stable selectors: `data-testid` or roles. Run against ephemeral env in CI; screenshots/traces on failure.
