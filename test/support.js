import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { registerAgentModes } from "../src/extension.ts";
import { saveRecord } from "../src/config.ts";

export const TEST_SETTINGS = { quickCheck: "node scripts/quick.js", fullTest: "npm test" };

export async function fixture({ configured = false } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "pi-agent-modes-"));
  const root = join(directory, "project");
  const agentDir = join(directory, "agent-data");
  await mkdir(root);
  const put = async (name, content) => {
    const file = join(root, name);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, content);
    return file;
  };
  if (configured) await saveRecord(agentDir, root, { version: 1, status: "configured", settings: TEST_SETTINGS });
  return {
    root, agentDir, put,
    app: (options) => harness(root, { agentDir, ...options }),
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}

export function harness(cwd, { agentDir, mode = "tui", trusted = true, flags = {}, choice, confirms = [], inputs = [] } = {}) {
  const handlers = new Map();
  const commands = new Map();
  const registeredFlags = new Map();
  const notifications = [];
  const statuses = [];
  const selections = [];
  const dialogs = [];
  const state = { choice, trusted, idle: true, confirms: [...confirms], inputs: [...inputs] };
  const pi = {
    on: (name, handler) => handlers.set(name, handler),
    registerCommand: (name, command) => commands.set(name, command),
    registerFlag: (name, flag) => registeredFlags.set(name, flag),
    getFlag: (name) => flags[name],
  };
  const ctx = {
    cwd, mode, hasUI: mode === "tui" || mode === "rpc",
    isProjectTrusted: () => state.trusted,
    isIdle: () => state.idle,
    ui: {
      select: async (title, choices) => {
        selections.push({ title, choices });
        return state.choice;
      },
      confirm: async (title, message) => {
        dialogs.push({ kind: "confirm", title, message });
        return state.confirms.shift();
      },
      input: async (title, placeholder) => {
        dialogs.push({ kind: "input", title, placeholder });
        return state.inputs.shift();
      },
      notify: (text, level) => notifications.push({ text, level }),
      setStatus: (key, text) => statuses.push({ key, text }),
    },
  };
  registerAgentModes(pi, { agentDir });
  return {
    ctx, state, commands, registeredFlags, notifications, statuses, selections, dialogs,
    start: (reason = "startup") => handlers.get("session_start")({ reason }, ctx),
    command: (args = "") => commands.get("agent-mode").handler(args, ctx),
    before(sections = {}) {
      const event = { systemPromptOptions: { sections }, systemPrompt: "BASELINE" };
      handlers.get("before_agent_start")(event, ctx);
      return event.systemPromptOptions.sections;
    },
  };
}
