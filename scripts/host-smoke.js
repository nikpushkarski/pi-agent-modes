import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { stripVTControlCharacters } from "node:util";

/** Exercise the installed Pi loader and input renderer, without starting a model or using real settings. */
export async function runHostSmoke(piRoot) {
  const host = (file) => import(pathToFileURL(join(piRoot, file)).href);
  const { loadExtensions, clearExtensionCache } = await host("dist/core/extensions/loader.js");
  const { ExtensionInputComponent } = await host("dist/modes/interactive/components/extension-input.js");
  const { initTheme } = await host("dist/modes/interactive/theme/theme.js");
  initTheme("dark", false);
  const directory = await mkdtemp(join(tmpdir(), "pi-modes-host-smoke-"));
  try {
    await cp(fileURLToPath(new URL("../src/", import.meta.url)), join(directory, "src"), { recursive: true });
    await writeFile(join(directory, "package.json"), JSON.stringify({ type: "module" }));
    const entry = join(directory, "probe.ts");
    await writeFile(entry, 'import { askSetup } from "./src/setup.ts";\nexport default function(pi) { pi.registerCommand("probe", { handler: async (_args, ctx) => askSetup(ctx) }); }\n');
    const loadQuestion = async () => {
      clearExtensionCache();
      const loaded = await loadExtensions([entry], directory);
      assert.deepEqual(loaded.errors, [], "Pi must load the setup code without errors");
      let question;
      await loaded.extensions[0].commands.get("probe").handler("", {
        ui: {
          confirm: async () => true,
          input: async (title, placeholder) => { question = { title, placeholder }; return undefined; },
        },
      });
      assert.ok(question, "The real Pi-loaded extension must ask the quick-check question");
      return question;
    };
    const first = await loadQuestion();
    const input = new ExtensionInputComponent(first.title, first.placeholder, () => {}, () => {});
    try {
      for (const typed of ["", "npm test"]) {
        if (typed) input.handleInput(typed);
        const lines = input.render(80).map((line) => stripVTControlCharacters(line).trim());
        const titleLine = lines.findIndex((line) => line.startsWith("1 of 2:"));
        assert.ok(titleLine >= 0, "The rendered question must be visible");
        assert.equal(lines[titleLine + 1], "Example: npm run test:smoke", "Pi must render the example directly below the question, even while typing");
      }
    } finally {
      input.dispose();
    }
    // Reproduce a local edit followed by /reload in the SAME process. A fresh
    // process or a mocked title check cannot catch stale transitive module imports.
    const setupPath = join(directory, "src/setup.ts");
    const setup = await readFile(setupPath, "utf8");
    assert.ok(setup.includes('"npm run test:smoke"'));
    await writeFile(setupPath, setup.replace('"npm run test:smoke"', '"npm run test:reload-fixture"'));
    const reloaded = await loadQuestion();
    assert.match(reloaded.title, /Example: npm run test:reload-fixture/, "Pi reload must pick up edits to the setup module, not keep the old example");
    console.log("Host smoke passed: real Pi input rendering and same-process setup reload.");
  } finally {
    clearExtensionCache();
    await rm(directory, { recursive: true, force: true });
  }
}
