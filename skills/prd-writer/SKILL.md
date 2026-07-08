---
name: prd-writer
description: Turns raw ideas into build-ready PRDs. Use when the user describes a feature or product idea, says "I want to build...", asks for requirements, user stories, acceptance criteria, or scoping — the missing front end of the dev lifecycle before any code is written.
---

# prd-writer

A feature built from a vague sentence gets rebuilt three times. Spend 10 minutes here to save days later.

## Output format (create `docs/prd-<slug>.md`)
1. **Problem** — one paragraph: who hurts, how badly, how we know.
2. **Goal & non-goals** — 1-3 measurable goals; explicit non-goals to kill scope creep.
3. **Users & jobs** — persona → job-to-be-done, table form.
4. **User stories** — `As a <role>, I want <action>, so that <outcome>` with acceptance criteria per story in Given/When/Then. Mark each MoSCoW (Must/Should/Could/Won't).
5. **Flows** — happy path + top 2 failure paths, numbered steps.
6. **Data & API sketch** — entities, key fields, endpoints touched (hand to `backend-architect`).
7. **UX notes** — states, empty/error handling, mobile behavior (hand to `ui-ux-master`).
8. **Risks & open questions** — each with an owner and a default answer if unanswered.
9. **Success metrics** — how we'll know it worked, measured where.

## Rules
- Interview before writing: ask the 3-5 questions whose answers change the design; propose defaults for everything else.
- Every Must-have story needs acceptance criteria concrete enough to become a test name.
- Slice for shipping: define an M0 (thinnest end-to-end path) that could ship alone.
- Keep the whole PRD under 2 pages — if longer, split the feature.
- End with a handoff line: which agents/commands execute it (`/new-feature`, `ui-designer`, `backend-engineer`).
