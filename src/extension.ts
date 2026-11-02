import { resolve } from "node:path";
import { loadRecord, saveRecord } from "./config.ts";
import { modeInstructions } from "./policies.ts";
import { askSetup } from "./setup.ts";

export const SECTION = "pi_agent_modes";
export const CHOICES = [
  "Default — save tokens and subscription usage",
  "Beast — keep working and test as needed",
];
const SKIPPED = { version: 1, status: "skipped" };

/** No policy is active until this project has completed setup. */
export function registerAgentModes(pi, { agentDir }) {
  let mode = "default";
  let settings;
  let project;
  const trusted = (ctx) => typeof ctx.isProjectTrusted === "function" && ctx.isProjectTrusted();
  const interactive = (ctx) => ctx.mode === "tui" && ctx.hasUI;
  const report = (ctx, text, level = "info") => {
    if (ctx.hasUI) ctx.ui.notify(text, level);
    else if (level !== "info") console.error(`[pi-agent-modes] ${text}`);
  };
  const status = (ctx) => {
    if (ctx.hasUI) ctx.ui.setStatus("pi-agent-modes", settings ? `mode:${mode}` : undefined);
  };
  const sameProject = (ctx) => project === resolve(ctx.cwd) && trusted(ctx);
  const off = (ctx) => {
    settings = undefined;
    mode = "default";
    status(ctx);
  };
  const setupNeeded = (ctx) => report(ctx,
    "Agent modes are off. Finish /agent-mode setup first. Without saved settings, this extension does nothing.", "warning");

  async function setup(ctx) {
    if (!interactive(ctx)) {
      report(ctx, "Open Pi in a terminal and run /agent-mode setup. Setup does not run in print, JSON, or RPC mode.", "warning");
      return false;
    }
    if (!sameProject(ctx)) {
      report(ctx, "Trust this project with /trust, then use /reload and /agent-mode setup. Agent modes are off here.", "warning");
      return false;
    }
    const answer = await askSetup(ctx);
    if (!answer) {
      if (settings) {
        report(ctx, "Setup cancelled. Your saved settings have not changed. Use /agent-mode off to turn them off.");
      } else {
        // Remember the refusal, not any partial answers. Do not nag on every launch.
        try {
          await saveRecord(agentDir, ctx.cwd, SKIPPED);
        } catch {
          report(ctx, "Could not remember that you skipped setup. Pi may ask again next time.", "warning");
        }
        report(ctx, "Setup skipped. No mode settings were saved. This extension will do nothing. Use /agent-mode setup when you want to try it.");
      }
      return false;
    }
    try {
      await saveRecord(agentDir, ctx.cwd, answer);
    } catch {
      report(ctx, "Could not save mode settings. No new settings were applied. Check that Pi's data folder is writable, then try setup again.", "warning");
      return false;
    }
    settings = answer.settings;
    mode = "default";
    status(ctx);
    report(ctx, "Settings saved for this project. Nothing has been run.");
    return true;
  }

  function selectMode(next, ctx) {
    if (next !== "default" && next !== "beast") {
      report(ctx, "Use /agent-mode setup, default, beast, off, or status.", "warning");
      return;
    }
    if (!sameProject(ctx)) off(ctx);
    if (!settings) {
      setupNeeded(ctx);
      return;
    }
    mode = next;
    status(ctx);
  }

  async function picker(ctx) {
    if (!settings) {
      setupNeeded(ctx);
      return;
    }
    if (!interactive(ctx)) {
      report(ctx, "Use /agent-mode default or /agent-mode beast. The picker only opens in a terminal.");
      return;
    }
    const choice = await ctx.ui.select("Which mode do you want?", CHOICES);
    if (choice) selectMode(choice === CHOICES[1] ? "beast" : "default", ctx);
  }

  pi.registerFlag("agent-mode", {
    type: "string",
    description: "Choose default or beast after project setup; skip the mode picker",
  });
  pi.registerCommand("agent-mode", {
    description: "Set up or change agent mode: setup, default, beast, off, status",
    getArgumentCompletions(prefix) {
      const items = ["setup", "default", "beast", "off", "status"]
        .filter((value) => value.startsWith(prefix))
        .map((value) => ({ value, label: value }));
      return items.length ? items : null;
    },
    async handler(args, ctx) {
      const next = args.trim().toLowerCase();
      if (!sameProject(ctx)) off(ctx);
      if (next === "status") {
        report(ctx, settings ? `Agent mode: ${mode}. Settings are saved for this project.` :
          "Agent modes are off. No mode rules are active. Use /agent-mode setup to start.");
        return;
      }
      if (!ctx.isIdle()) {
        report(ctx, "Stop the current run or wait for it to finish before changing mode or settings.", "warning");
        return;
      }
      if (next === "setup") {
        if (await setup(ctx)) await picker(ctx);
      } else if (next === "off") {
        off(ctx);
        try {
          await saveRecord(agentDir, ctx.cwd, SKIPPED);
          report(ctx, "Agent modes are off for this project. Saved mode settings were removed. Use /agent-mode setup to start again.");
        } catch {
          report(ctx, "Agent modes are off for this session, but the saved settings could not be removed. Check Pi's data folder before the next launch.", "warning");
        }
      } else if (!next) await picker(ctx);
      else selectMode(next, ctx);
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    project = resolve(ctx.cwd);
    off(ctx);
    const requested = pi.getFlag("agent-mode");
    if (requested !== undefined && requested !== "default" && requested !== "beast") {
      report(ctx, "Use --agent-mode default or --agent-mode beast. Agent modes are off for this session.", "warning");
      return;
    }
    // Never use project settings without the host's trust decision.
    if (!trusted(ctx)) {
      if (interactive(ctx) || requested !== undefined) {
        report(ctx, "Agent modes are off. Trust this project with /trust, then use /reload to set up modes.", "warning");
      }
      return;
    }
    let record;
    try {
      record = await loadRecord(agentDir, ctx.cwd);
    } catch {
      report(ctx, "Could not read mode settings. Agent modes are off. Run /agent-mode setup to save new settings.", "warning");
      return;
    }
    if (record?.status === "configured") settings = record.settings;
    else if (!record && interactive(ctx)) await setup(ctx);
    if (!settings) {
      if (requested !== undefined) setupNeeded(ctx);
      return;
    }
    status(ctx);
    if (requested !== undefined) selectMode(requested, ctx);
    else if (interactive(ctx)) await picker(ctx);
  });

  pi.on("before_agent_start", (event, ctx) => {
    if (!sameProject(ctx)) off(ctx);
    if (!settings) {
      // Remove only our own old section, without adding any instructions while off.
      if (event.systemPromptOptions.sections) delete event.systemPromptOptions.sections[SECTION];
      return;
    }
    const sections = event.systemPromptOptions.sections ??= {};
    sections[SECTION] = modeInstructions(mode, settings);
  });
}
