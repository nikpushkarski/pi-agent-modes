import { parseCommand } from "./config.ts";

export const SETUP_MESSAGE = `Default aims to save tokens and subscription usage. It uses one main agent, adds up to four helpers only when useful, and runs your quick check once. Other tests need your request.

Beast allows Ralph loops, as many useful subagents as the tools support, and any tests as often as needed. It can use much more of your allowance. Permissions and stop requests still apply.

Answer two questions for this project. Nothing runs now. Settings stay in Pi's local data folder; project files are not changed. Do not put passwords or tokens in your commands.

Skip or press Escape to leave setup. Without saved settings, this extension does nothing: no mode rules, no mode picker, and no footer label. You can set it up later with /agent-mode setup.`;

async function askCommand(ctx, title, example) {
  while (true) {
    const answer = await ctx.ui.input(`${title}\nExample: ${example}`, "Type your command, or none if you do not have one.");
    if (answer === undefined || !answer.trim()) return undefined;
    try {
      return { command: parseCommand(answer) };
    } catch (error) {
      ctx.ui.notify(error.message, "warning");
    }
  }
}

/** Answers are kept in memory until the user reviews and saves both of them. */
export async function askSetup(ctx) {
  if (!await ctx.ui.confirm("Set up agent modes for this project?", SETUP_MESSAGE)) return undefined;
  const quick = await askCommand(ctx, "1 of 2: What command runs your quick check?", "npm run test:smoke");
  if (!quick) return undefined;
  const full = await askCommand(ctx, "2 of 2: What command runs all your tests?", "npm run test:full");
  if (!full) return undefined;
  const settings = { quickCheck: quick.command, fullTest: full.command };
  const saved = await ctx.ui.confirm("Save these settings?", [
    `Quick check: ${settings.quickCheck ?? "none"}`,
    `All tests: ${settings.fullTest ?? "none"}`,
    "",
    "Default: save usage; run only the quick check unless you ask for more.",
    "Beast: allow Ralph loops, as many useful helpers as needed, and repeated tests.",
    "",
    "Save for this project only. Nothing runs now.",
  ].join("\n"));
  return saved ? { version: 1, status: "configured", settings } : undefined;
}
