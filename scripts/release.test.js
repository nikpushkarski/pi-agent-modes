import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { analyzeCommits } from "@semantic-release/commit-analyzer";
import { generateNotes } from "@semantic-release/release-notes-generator";
import config from "../release.config.js";

const logger = { log() {} };
const pluginOptions = (name) => config.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === name)[1];
const analyzerOptions = pluginOptions("@semantic-release/commit-analyzer");

for (const [message, expected] of [
  ["fix: correct mode selection", "patch"],
  ["perf: reduce setup overhead", "patch"],
  ["docs: simplify README", "patch"],
  ["docs(readme): clarify installation", "patch"],
  ["feat: add a new mode", "minor"],
  ["feat!: replace mode configuration", "major"],
  ["docs!: remove legacy instructions", "major"],
  ["fix: change configuration\n\nBREAKING CHANGE: old settings are no longer supported", "major"],
  ["chore: maintain release tooling", null],
  ["ci: adjust test matrix", null],
  ["test: add regression coverage", null],
  ["Update README", null],
]) {
  test(`${message.split("\n")[0]} selects ${expected ?? "no release"}`, async () => {
    const actual = await analyzeCommits(analyzerOptions, {
      cwd: process.cwd(),
      commits: [{ hash: "abc1234", message }],
      logger,
    });
    assert.equal(actual, expected);
  });
}

test("the largest release type wins across commits", async () => {
  const actual = await analyzeCommits(analyzerOptions, {
    cwd: process.cwd(),
    commits: [
      { hash: "abc1234", message: "docs: update README" },
      { hash: "def5678", message: "feat: add a mode" },
    ],
    logger,
  });
  assert.equal(actual, "minor");
});

test("documentation changes appear in generated GitHub release notes", async () => {
  const notes = await generateNotes(pluginOptions("@semantic-release/release-notes-generator"), {
    cwd: process.cwd(),
    commits: [{ hash: "abc1234567890", message: "docs: simplify README" }],
    lastRelease: { version: "0.2.1", gitTag: "v0.2.1" },
    nextRelease: { version: "0.2.2", gitTag: "v0.2.2" },
    options: { repositoryUrl: "https://github.com/nikpushkarski/pi-agent-modes.git" },
    logger,
  });
  assert.match(notes, /Documentation/);
  assert.match(notes, /simplify README/);
  assert.match(notes, /v0\.2\.1\.\.\.v0\.2\.2/);
});

test("releases target main, retain existing tag format, and publish publicly", async () => {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.deepEqual(config.branches, ["main"]);
  assert.equal(config.tagFormat, "v${version}");
  assert.equal(pkg.publishConfig.access, "public");
  assert.deepEqual(config.plugins.map((plugin) => Array.isArray(plugin) ? plugin[0] : plugin), [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/npm",
    "@semantic-release/github",
  ]);
});

test("GitHub publishing does not require issue or pull-request write access", () => {
  const options = pluginOptions("@semantic-release/github");
  assert.equal(options.successComment, false);
  assert.equal(options.failComment, false);
  assert.equal(options.failTitle, false);
  assert.equal(options.releasedLabels, false);
});
