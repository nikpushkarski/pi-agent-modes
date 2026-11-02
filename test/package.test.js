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
  const checks = workflow.split("\n  release:\n")[0];
  assert.match(workflow, /\n  push:/);
  assert.match(workflow, /\n  pull_request:/);
  assert.doesNotMatch(workflow, /pull_request_target/);
  assert.doesNotMatch(checks, /secrets\.|: write/);
  assert.match(checks, /\npermissions:\n  contents: read\n/);
  assert.match(checks, /ubuntu-latest/);
  assert.match(checks, /windows-latest/);
  assert.match(checks, /run: npm run test:smoke/);
  assert.match(checks, /run: npm test/);
  assert.match(checks, /run: npm run test:release/);
});

test("publishing is gated on all checks and restricted to main pushes in the upstream repo", async () => {
  const workflow = await read(".github/workflows/test.yml");
  const release = workflow.split("\n  release:\n")[1];
  assert.ok(release, "A separate release job is required");
  assert.match(release, /needs: \[test, release-check\]/);
  assert.match(release, /if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main' && github\.repository == 'nikpushkarski\/pi-agent-modes'/);
  assert.match(release, /group: release-main\n      cancel-in-progress: false/);
  assert.match(release, /permissions:\n      contents: write\n      id-token: write/);
  assert.doesNotMatch(release, /issues: write|pull-requests: write|NPM_TOKEN|NODE_AUTH_TOKEN/);
  assert.match(release, /fetch-depth: 0/);
  assert.match(release, /node-version: 24/);
  assert.match(release, /run: npm ci --ignore-scripts/);
  assert.match(release, /run: npm run release/);
  assert.match(release, /GITHUB_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/);
});
