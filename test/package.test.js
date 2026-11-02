import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("package is discoverable by Pi and explicitly ships its runtime without host dependencies", async () => {
  const pkg = JSON.parse(await read("package.json"));
  assert.ok(pkg.keywords.includes("pi-package"));
  assert.ok(pkg.pi.extensions.length > 0);
  for (const entry of pkg.pi.extensions) {
    assert.ok(entry.startsWith("./src/"), "Runtime entries belong under the published src/ directory");
    await access(new URL(entry, root));
  }
  assert.ok(pkg.files.includes("src/"));
  // Setup replaces the old manual overlay examples. All setup and policy modules
  // must ship, while local answers, tests, and development scripts must not.
  for (const file of ["src/config.ts", "src/setup.ts", "src/policies.ts"]) {
    await access(new URL(file, root));
  }
  for (const entry of pkg.files) {
    assert.ok(!/agent-modes\/projects|test\/|scripts\/|\.env/.test(entry), "Do not publish local settings or development files");
  }
  assert.match(await read("src/index.ts"), /getAgentDir\(\)/, "Use Pi's current agent directory, not a machine-specific path");
  assert.ok(!pkg.dependencies?.["@earendil-works/pi-coding-agent"], "Pi supplies its host module");
  assert.equal(pkg.peerDependencies["@earendil-works/pi-coding-agent"], "*");
  for (const name of ["test:smoke", "test"]) assert.ok(pkg.scripts[name]);
  assert.ok(!pkg.scripts.postinstall, "Installing a prompt picker must not execute an install hook");
  await access(new URL("LICENSE", root));
});

test("CI validates PRs and pushes with read-only permissions on Linux and Windows", async () => {
  const workflow = await read(".github/workflows/test.yml");
  assert.match(workflow, /\n  push:/);
  assert.match(workflow, /\n  pull_request:/);
  assert.doesNotMatch(workflow, /pull_request_target|secrets\./);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /ubuntu-latest/);
  assert.match(workflow, /windows-latest/);
  assert.match(workflow, /run: npm run test:smoke/);
  assert.match(workflow, /run: npm test/);
});
