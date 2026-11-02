import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { CHOICES, SECTION } from "../src/extension.ts";
import { configPath, loadRecord } from "../src/config.ts";
import { fixture, TEST_SETTINGS } from "./support.js";

async function withProject(run, options) {
  const project = await fixture(options);
  try { await run(project); } finally { await project.cleanup(); }
}
const answers = { confirms: [true, true], inputs: [TEST_SETTINGS.quickCheck, TEST_SETTINGS.fullTest] };

test("first run explains the cost tradeoff, asks two questions, reviews them, and saves locally", () => withProject(async (p) => {
  const app = p.app(answers);
  await app.start();
  assert.match(app.dialogs[0].message, /save tokens and subscription usage/);
  assert.match(app.dialogs[0].message, /Ralph loops/);
  assert.match(app.dialogs[0].message, /Without saved settings, this extension does nothing/);
  const questions = app.dialogs.filter((dialog) => dialog.kind === "input");
  assert.equal(questions.length, 2);
  assert.equal(questions[0].title.split("\n")[1], "Example: npm run test:smoke", "Keep the quick-check example visible on the second line, not just in the placeholder");
  assert.equal(questions[1].title.split("\n")[1], "Example: npm run test:full", "Keep the full-test example visible on the second line");
  assert.equal(app.dialogs.at(-1).title, "Save these settings?");
  assert.match(app.dialogs.at(-1).message, /node scripts\/quick.js/);
  assert.deepEqual(await loadRecord(p.agentDir, p.root), { version: 1, status: "configured", settings: TEST_SETTINGS });
  assert.equal(app.selections.length, 1);
  assert.match(app.before()[SECTION], /Selected mode: Default/);
  assert.equal(app.statuses.at(-1).text, "mode:default");
  const { readdir } = await import("node:fs/promises");
  assert.deepEqual(await readdir(p.root), [], "Setup must not edit project files");
}));

test("declining setup makes both commands and CLI flags inert; a legacy overlay cannot bypass consent", () => withProject(async (p) => {
  await p.put("docs/agent-modes/beast.md", "Legacy rules must not grant consent");
  const app = p.app({ confirms: [false], flags: { "agent-mode": "beast" } });
  await app.start();
  assert.deepEqual(app.before(), {});
  assert.equal(app.selections.length, 0);
  assert.equal(app.statuses.at(-1).text, undefined);
  assert.ok(app.notifications.some(({ text }) => /This extension will do nothing/.test(text)));
  const record = await loadRecord(p.agentDir, p.root);
  assert.deepEqual(record, { version: 1, status: "skipped" });
  for (const cmd of ["beast", "default", ""]) {
    await app.command(cmd);
    assert.deepEqual(app.before(), {});
  }
  const reopened = p.app({ flags: { "agent-mode": "beast" } });
  await reopened.start();
  assert.equal(reopened.dialogs.length, 0, "Do not ask again after refusal");
  assert.equal(reopened.selections.length, 0);
  assert.deepEqual(reopened.before(), {});
  reopened.state.confirms.push(true, true);
  reopened.state.inputs.push(...answers.inputs);
  await reopened.command("setup");
  assert.match(reopened.before()[SECTION], /Selected mode: Default/);
}));

test("Escape or a blank answer at any setup stage discards partial answers", async () => {
  for (const options of [
    {},
    { confirms: [true], inputs: [undefined] },
    { confirms: [true], inputs: [" "] },
    { confirms: [true], inputs: ["node partial.js", undefined] },
    { confirms: [true, false], inputs: ["node partial.js", "npm test"] },
  ]) {
    await withProject(async (p) => {
      const app = p.app(options);
      await app.start();
      assert.deepEqual(app.before(), {});
      assert.equal(app.selections.length, 0);
      assert.deepEqual(await loadRecord(p.agentDir, p.root), { version: 1, status: "skipped" });
      assert.ok(!JSON.stringify(await loadRecord(p.agentDir, p.root)).includes("partial"));
    });
  }
});

test("invalid command input is explained; choosing none is a valid answer, not skipped setup", () => withProject(async (p) => {
  const app = p.app({ confirms: [true, true], inputs: ["bad\ncommand", "none", "none"] });
  await app.start();
  assert.ok(app.notifications.some(({ text }) => /Use one line/.test(text)));
  assert.deepEqual((await loadRecord(p.agentDir, p.root)).settings, { quickCheck: null, fullTest: null });
  assert.match(app.before()[SECTION], /Selected mode: Default/);
  await app.command("beast");
  assert.match(app.before()[SECTION], /explain any validation gap/i);
}));

test("Default limits spending; Beast removes fixed delegation and testing caps without changing other sections", () => withProject(async (p) => {
  const app = p.app({ flags: { "agent-mode": "default" } });
  await app.start();
  const sections = app.before({ another_extension: "keep me" });
  assert.match(sections[SECTION], /save tokens and subscription usage/);
  assert.match(sections[SECTION], /at most four subagents/);
  assert.match(sections[SECTION], /quick check once after integration/);
  assert.match(sections[SECTION], /unless the user asks/);
  await app.command("beast");
  app.before(sections);
  assert.equal(sections.another_extension, "keep me");
  assert.match(sections[SECTION], /Ralph loop for any request/);
  assert.match(sections[SECTION], /Spawn as many subagents as required/);
  assert.match(sections[SECTION], /no fixed subagent cap/);
  assert.match(sections[SECTION], /whole suite as many times as needed/);
  assert.match(sections[SECTION], /Do not bypass tool approvals/);
  assert.doesNotMatch(sections[SECTION], /Use at most four subagents/);
  await app.command("default");
  assert.match(app.before()[SECTION], /Selected mode: Default/);
  assert.doesNotMatch(app.before()[SECTION], /Spawn as many subagents as required/);
  assert.equal(app.statuses.at(-1).text, "mode:default");
}, { configured: true }));

test("saved setup survives startup, reload, new, resume and fork, but Beast consent does not", () => withProject(async (p) => {
  const app = p.app({ choice: CHOICES[1] });
  await app.start();
  assert.match(app.before()[SECTION], /Selected mode: Beast/);
  for (const reason of ["startup", "reload", "new", "resume", "fork"]) {
    app.state.choice = undefined;
    await app.start(reason);
    assert.match(app.before()[SECTION], /Selected mode: Default/, reason);
    await app.command("beast");
  }
  assert.equal(app.selections.length, 6);
  assert.equal(app.dialogs.length, 0, "The setup questionnaire must not repeat for configured projects");
}, { configured: true }));

test("cancelling the mode picker keeps the active mode; busy sessions refuse changes", () => withProject(async (p) => {
  const app = p.app();
  await app.start();
  await app.command("beast");
  await app.command();
  assert.match(app.before()[SECTION], /Selected mode: Beast/);
  app.state.idle = false;
  for (const cmd of ["setup", "off", "default"]) await app.command(cmd);
  assert.match(app.before()[SECTION], /Selected mode: Beast/);
  assert.equal(app.dialogs.length, 0);
  assert.match(app.notifications.at(-1).text, /Stop the current run/);
}, { configured: true }));

test("off removes saved policy and prompt state; reconfiguration cancellation preserves existing settings", () => withProject(async (p) => {
  const app = p.app({ choice: CHOICES[1], confirms: [true, false], inputs: ["new quick", "new full"] });
  await app.start();
  const beforeFile = await readFile(await configPath(p.agentDir, p.root), "utf8");
  await app.command("setup");
  assert.equal(await readFile(await configPath(p.agentDir, p.root), "utf8"), beforeFile);
  assert.match(app.before()[SECTION], /Selected mode: Beast/);
  const sections = app.before({ other: "keep" });
  await app.command("off");
  assert.deepEqual(app.before(sections), { other: "keep" });
  assert.equal(app.statuses.at(-1).text, undefined);
  assert.deepEqual(await loadRecord(p.agentDir, p.root), { version: 1, status: "skipped" });
  const reopened = p.app();
  await reopened.start();
  assert.equal(reopened.dialogs.length, 0);
  assert.deepEqual(reopened.before(), {});
}, { configured: true }));

test("non-TUI sessions never ask setup questions or choose a mode without saved settings", async () => {
  for (const mode of ["print", "json", "rpc"]) {
    await withProject(async (p) => {
      const app = p.app({ mode });
      await app.start();
      assert.equal(app.dialogs.length, 0);
      assert.equal(app.selections.length, 0);
      assert.deepEqual(app.before(), {});
      assert.equal(await loadRecord(p.agentDir, p.root), undefined);
    });
    await withProject(async (p) => {
      for (const selected of [undefined, "default", "beast"]) {
        const app = p.app({ mode, flags: { "agent-mode": selected } });
        await app.start();
        assert.equal(app.dialogs.length, 0);
        assert.equal(app.selections.length, 0);
        assert.match(app.before()[SECTION], selected === "beast" ? /Selected mode: Beast/ : /Selected mode: Default/);
      }
    }, { configured: true });
  }
});

test("setup stays gated by trust; losing trust or changing cwd removes all mode rules", () => withProject(async (p) => {
  const untrusted = p.app({ trusted: false, flags: { "agent-mode": "beast" } });
  await untrusted.start();
  await untrusted.command("setup");
  assert.equal(untrusted.dialogs.length, 0);
  assert.deepEqual(untrusted.before(), {});
  const app = p.app({ choice: CHOICES[1] });
  await app.start();
  app.state.trusted = false;
  assert.deepEqual(app.before({ [SECTION]: "stale", other: "keep" }), { other: "keep" });
  app.state.trusted = true;
  await app.start();
  app.ctx.cwd = join(p.root, "elsewhere");
  assert.deepEqual(app.before(), {});
}, { configured: true }));

test("corrupt or unreadable settings leave the extension off without a silent reset", () => withProject(async (p) => {
  const file = await configPath(p.agentDir, p.root);
  await writeFile(file, "broken json");
  const app = p.app();
  await app.start();
  assert.deepEqual(app.before(), {});
  assert.equal(app.dialogs.length, 0);
  assert.match(app.notifications.at(-1).text, /Could not read mode settings/);
  assert.equal(await readFile(file, "utf8"), "broken json");
}, { configured: true }));

test("save failure does not enable partial setup", () => withProject(async (p) => {
  // Initialize without auto-setup, then block writes only after the settings read.
  // Reading through a file can return ENOENT on Windows but ENOTDIR on Linux.
  const app = p.app({ ...answers, mode: "print" });
  await app.start();
  assert.equal(app.dialogs.length, 0);
  await writeFile(p.agentDir, "not a directory");
  app.ctx.mode = "tui";
  app.ctx.hasUI = true;
  await app.command("setup");
  assert.equal(app.dialogs.filter(({ kind }) => kind === "input").length, 2);
  assert.equal(app.dialogs.at(-1).title, "Save these settings?");
  assert.deepEqual(app.before(), {});
  assert.equal(app.selections.length, 0);
  assert.match(app.notifications.at(-1).text, /Could not save mode settings/);
  assert.equal(await readFile(p.agentDir, "utf8"), "not a directory");
}));

test("project settings do not carry into another folder, and unrelated content does not alter them", () => withProject(async (p) => {
  const before = await loadRecord(p.agentDir, p.root);
  await p.put("content/new.md", "A valid unrelated article");
  assert.deepEqual(await loadRecord(p.agentDir, p.root), before);
  const child = join(p.root, "child");
  await mkdir(child);
  const app = p.app({ mode: "rpc", flags: { "agent-mode": "beast" } });
  app.ctx.cwd = child;
  await app.start();
  assert.deepEqual(app.before(), {});
  assert.equal(await loadRecord(p.agentDir, child), undefined);
}, { configured: true }));

test("unknown CLI modes stay off, unknown commands preserve mode, and completion includes setup", () => withProject(async (p) => {
  const invalid = p.app({ flags: { "agent-mode": "typo" } });
  await invalid.start();
  assert.deepEqual(invalid.before(), {});
  assert.equal(invalid.dialogs.length, 0);
  const app = p.app({ flags: { "agent-mode": "beast" } });
  await app.start();
  await app.command("typo");
  assert.match(app.before()[SECTION], /Selected mode: Beast/);
  assert.deepEqual(app.commands.get("agent-mode").getArgumentCompletions("set"), [{ value: "setup", label: "setup" }]);
}, { configured: true }));
