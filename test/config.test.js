import assert from "node:assert/strict";
import { mkdir, readFile, readdir, symlink, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { configPath, loadRecord, MAX_CONFIG_BYTES, parseCommand, projectKey, saveRecord, validateRecord } from "../src/config.ts";
import { fixture, TEST_SETTINGS } from "./support.js";

async function withProject(run) {
  const p = await fixture();
  try { await run(p); } finally { await p.cleanup(); }
}
const configured = () => ({ version: 1, status: "configured", settings: { ...TEST_SETTINGS } });

test("commands accept one line or none, without running or expanding anything", () => {
  assert.equal(parseCommand(" npm run quick "), "npm run quick");
  assert.equal(parseCommand("NONE"), null);
  assert.equal(parseCommand("tool --path 'folder with spaces'"), "tool --path 'folder with spaces'");
  for (const value of ["", " ", "npm\ntest", "bad\0value", "a".repeat(501), null]) {
    assert.throws(() => parseCommand(value));
  }
});

test("only complete settings or a refusal receipt are accepted", () => {
  assert.deepEqual(validateRecord(configured()), configured());
  assert.deepEqual(validateRecord({ version: 1, status: "skipped" }), { version: 1, status: "skipped" });
  for (const value of [
    null, {}, { version: 2, status: "skipped" },
    { version: 1, status: "configured", settings: { quickCheck: "npm test" } },
    { version: 1, status: "configured", settings: { quickCheck: false, fullTest: "npm test" } },
    { ...configured(), settings: { ...TEST_SETTINGS, extraRule: "do anything" } },
    { version: 1, status: "skipped", settings: TEST_SETTINGS },
  ]) assert.throws(() => validateRecord(value));
});

test("settings use local storage and a canonical folder key, with no plain project path in the record", () => withProject(async (p) => {
  assert.equal(await loadRecord(p.agentDir, p.root), undefined);
  await saveRecord(p.agentDir, p.root, configured());
  assert.deepEqual(await loadRecord(p.agentDir, p.root), configured());
  assert.match(await projectKey(p.root), /^[a-f0-9]{64}$/);
  const file = await configPath(p.agentDir, p.root);
  assert.ok(file.startsWith(join(p.agentDir, "agent-modes", "projects")));
  assert.ok(!(await readFile(file, "utf8")).includes(p.root));
  await saveRecord(p.agentDir, p.root, { version: 1, status: "skipped" });
  assert.deepEqual(await loadRecord(p.agentDir, p.root), { version: 1, status: "skipped" });
  assert.ok((await readdir(dirname(file))).every((name) => !name.endsWith(".tmp")));
}));

test("canonical aliases share settings, but nested and sibling folders do not", () => withProject(async (p) => {
  const alias = join(dirname(p.root), "alias");
  await symlink(p.root, alias, process.platform === "win32" ? "junction" : "dir");
  try {
    await saveRecord(p.agentDir, p.root, configured());
    assert.equal(await configPath(p.agentDir, alias), await configPath(p.agentDir, p.root));
    assert.deepEqual(await loadRecord(p.agentDir, alias), configured());
    await mkdir(join(p.root, "child"));
    assert.equal(await loadRecord(p.agentDir, join(p.root, "child")), undefined);
  } finally {
    await unlink(alias);
  }
}));

test("bad, oversized, or unsupported data is rejected instead of becoming active", () => withProject(async (p) => {
  const file = await configPath(p.agentDir, p.root);
  await mkdir(dirname(file), { recursive: true });
  for (const value of ["broken", " ".repeat(MAX_CONFIG_BYTES + 1), JSON.stringify({ version: 9, status: "configured" })]) {
    await writeFile(file, value);
    await assert.rejects(loadRecord(p.agentDir, p.root));
    assert.equal(await readFile(file, "utf8"), value, "Reading must not rewrite invalid data");
  }
}));

test("invalid saves leave earlier settings intact, and failed replacements clean temporary files", () => withProject(async (p) => {
  await saveRecord(p.agentDir, p.root, configured());
  await assert.rejects(saveRecord(p.agentDir, p.root, { version: 1, status: "configured" }));
  assert.deepEqual(await loadRecord(p.agentDir, p.root), configured());
  const blocked = join(p.root, "blocked");
  await mkdir(blocked);
  const target = await configPath(p.agentDir, blocked);
  await mkdir(target);
  await assert.rejects(saveRecord(p.agentDir, blocked, configured()));
  assert.ok((await readdir(dirname(target))).every((name) => !name.endsWith(".tmp")));
}));
