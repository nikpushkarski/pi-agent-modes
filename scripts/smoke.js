import assert from "node:assert/strict";
import { fixture, TEST_SETTINGS } from "../test/support.js";
import { SECTION } from "../src/extension.ts";
import { loadRecord } from "../src/config.ts";
import { runHostSmoke } from "./host-smoke.js";

const project = await fixture();
let skippedProject;
try {
  skippedProject = await fixture();
  const app = project.app({ confirms: [true, true], inputs: [TEST_SETTINGS.quickCheck, TEST_SETTINGS.fullTest] });
  await app.start();
  assert.equal(app.dialogs.filter((dialog) => dialog.kind === "input").length, 2, "Setup must ask two command questions");
  assert.match(app.dialogs[0].message, /save tokens and subscription usage/, "Setup must explain Default's purpose");
  assert.deepEqual((await loadRecord(project.agentDir, project.root)).settings, TEST_SETTINGS, "Save only complete answers");
  assert.match(app.before()[SECTION], /Selected mode: Default/);
  await app.command("beast");
  assert.match(app.before()[SECTION], /Ralph loop for any request/);
  assert.match(app.before()[SECTION], /no fixed subagent cap/);
  assert.match(app.before()[SECTION], /whole suite as many times as needed/);
  await app.command("default");
  assert.doesNotMatch(app.before()[SECTION], /Spawn as many subagents as required/);

  const reopened = project.app({ mode: "print" });
  await reopened.start();
  assert.equal(reopened.dialogs.length, 0, "Headless startup must not ask setup questions");
  assert.match(reopened.before()[SECTION], /Selected mode: Default/, "Saved settings must survive a new host instance");

  const skipped = skippedProject.app({ confirms: [false], flags: { "agent-mode": "beast" } });
  await skipped.start();
  await skipped.command("beast");
  assert.deepEqual(skipped.before(), {}, "Neither a CLI flag nor a command may bypass skipped setup");
  assert.equal(skipped.selections.length, 0);
  assert.equal(skipped.statuses.at(-1).text, undefined);
  assert.ok(skipped.notifications.some(({ text }) => /This extension will do nothing/.test(text)));
  const afterSkip = skippedProject.app();
  await afterSkip.start();
  assert.equal(afterSkip.dialogs.length, 0, "Do not nag after a refusal");

  const untrusted = project.app({ trusted: false });
  await untrusted.start();
  assert.deepEqual(untrusted.before(), {}, "Saved settings must not bypass project trust");
  await app.command("off");
  assert.deepEqual(app.before(), {}, "Turning off must remove active mode rules");
  console.log("Smoke passed: setup, saved settings, Default/Beast policies, refusal gating, headless startup, trust, and off.");
  const hostArgument = process.argv.indexOf("--pi-root");
  if (hostArgument !== -1) {
    assert.ok(process.argv[hostArgument + 1], "--pi-root needs the installed Pi package path");
    await runHostSmoke(process.argv[hostArgument + 1]);
  }
} finally {
  try { await project.cleanup(); } finally { if (skippedProject) await skippedProject.cleanup(); }
}
