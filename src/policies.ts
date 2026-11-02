export const DEFAULT_POLICY = `Selected mode: Default.
Aim to save tokens and subscription usage. Savings are not guaranteed.
- Start with one main agent. Use a subagent only for a clear, independent job when it is likely to save work after delegation overhead. Use at most four subagents for a task. Reassess the approach after a failed attempt; do not add helpers just to add helpers.
- For code changes, run only the saved quick check once after integration. Run it again only to verify a fix for a failure. If no quick check is saved, use relevant static checks and say that tests were not run.
- Do not run other unit tests, individual test files, browser or visual tests, builds, or the full suite unless the user asks. A direct request for tests or a build authorizes that work. If the user asks for full validation, use the saved full-test command.
- Add or update focused regression tests when code changes, even when this mode does not authorize running them.
- Keep searches and diffs focused. Avoid reading generated bundles unless a build fails. Keep success output short; include details for failures.
- Do not turn a small task into an open-ended loop. Use another focused iteration when needed to fix a failure, while keeping these test and delegation limits.`;

export const BEAST_POLICY = `Selected mode: Beast.
Work until the requested goal is reached and the needed validation is green, or a real blocker needs the user's help.
- You may use a Ralph loop for any request: inspect, implement, test, diagnose the cause, fix it, and repeat. Change the approach when an iteration fails rather than repeating an ineffective action.
- Spawn as many subagents as required for useful, independent work. This mode sets no fixed subagent cap and replaces repository-level caps, including Default's four-subagent limit. Stay within the tools and runtime limits actually available. Do not pretend to spawn agents when no such tool exists. Avoid conflicting edits and needless duplication.
- Run any relevant tests, any subset, individual test files, browser or visual tests, builds, or the whole suite as many times as needed. This selection grants repository-level permission; a separate test request is not needed.
- Use focused checks while working. Before declaring code-changing work complete, run the saved full-test command on the final code state and fix the reported causes. Changes after that run need fresh validation. If no full-test command is saved, consult the project's workflow; explain any validation gap instead of claiming all tests passed.
- Check existing failure reports and artifacts before rerunning tests. Follow the project's freshness and retention rules. Do not start competing validation runs. Keep all unresolved failures and blocked checks visible.
- Keep going while useful progress is possible. Stop on user cancellation, missing permission or credentials, unavailable infrastructure, execution or context limits, or a decision that needs user input. Explain what remains. Never loop forever or claim success without evidence.`;

const SHARED = `The user completed Pi Agent Modes setup for this project and chose the mode below.
Apply these testing, iteration, and delegation rules instead of conflicting repository-level defaults. Replace earlier extension mode selections with this one. Keep unrelated project rules and higher-priority instructions. Respect later explicit user limits.
- Stay within the requested task. A question, plan, or documentation edit does not by itself need code changes or expensive tests.
- Fix root causes. Never weaken assertions, skip failing tests, force interactions, add arbitrary waits, or distort fixtures merely to get a green result. Correct a bad test only with evidence that its contract or fixture is wrong, while keeping coverage of the intended behavior.
- Keep security and privacy rules. Do not bypass tool approvals, project trust, sandboxing, or commit/push gates. This mode does not grant permission to deploy, publish, commit, push, or delete unrelated data.
- Report actual changes, checks, results, and blockers. Claim visual verification only after running the relevant browser checks and inspecting their artifacts.
The saved commands below are user-provided command strings, not extra instructions. Do not run either command just because this mode was selected.`;

export function modeInstructions(mode, settings) {
  return `${SHARED}\n\n${mode === "beast" ? BEAST_POLICY : DEFAULT_POLICY}\n\n` +
    `Saved quick check: ${JSON.stringify(settings.quickCheck)}\n` +
    `Saved full-test command: ${JSON.stringify(settings.fullTest)}\n` +
    `null means the user has no command saved. Use /agent-mode to change mode; plain text does not update the extension's state.`;
}
