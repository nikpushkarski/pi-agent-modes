# Changelog

## 0.2.1

- Show a command example below each setup question.
- Fix stale setup text after `/reload` by letting Pi reload the TypeScript helpers.
- Add an optional smoke check using Pi's real input renderer and same-process loader.

## 0.2.0

- Ask two setup questions on the first interactive visit to each project.
- Explain that Default aims to save tokens and subscription usage.
- Let Beast use Ralph loops, as many useful helpers as needed, and repeated tests.
- Keep modes off until setup is complete. Skipping saves no mode rules or partial answers.
- Save settings locally, with commands to set up again or turn modes off.
- Replace automatic Markdown detection and `--beast-file` with saved setup answers.
- Use shorter, simpler setup and usage text.

## 0.1.0

- Add opt-in Default/Beast startup selection for trusted projects.
- Add `/agent-mode`, a footer indicator, and CLI mode/file flags.
- Apply project-owned overlays without replacing other prompt sections.
- Keep headless startup non-blocking and reset consent on session lifecycle changes.
- Include temporary-fixture smoke/regression coverage and publishing guidance.
