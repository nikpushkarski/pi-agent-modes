# Pi Agent Modes

Choose how much work Pi should do for a task.

| Mode | Use it when | What it does |
| --- | --- | --- |
| **Default** | You want to save tokens or subscription usage. | Starts with one main agent. Adds up to four helpers only when useful. Runs your quick check once; other tests need your request. |
| **Beast** | You want Pi to keep working and check the result fully. | Allows Ralph loops, as many useful subagents as the tools support, and any tests as often as needed. |

Default aims to use less of your allowance. It cannot guarantee savings. Beast can use much more time and tokens. Both modes respect stop requests, permissions, and safety rules.

Requires Pi 1.5.0 or newer and Node.js 22.19 or newer.

## Install

From npm:

```sh
pi install npm:@nikpushkarski/pi-agent-modes
```

Alternatively, install from the public [GitHub repository](https://github.com/nikpushkarski/pi-agent-modes):

```sh
pi install git:github.com/nikpushkarski/pi-agent-modes
```

Then start Pi in your project folder, or run `/reload` in an open session.

### Local development

From a local checkout:

```sh
pi install /absolute/path/to/pi-agent-modes
```

Quote the path if it contains spaces. Pi loads a local checkout in place. You do not need to reinstall after editing it; use `/reload`.

Install from only one source at a time. When switching from a local or GitHub install to npm, remove the previous source first to avoid loading the extension twice.

## Set up a project

On the first **interactive session in each project folder**, the extension offers setup. It cannot ask questions during `pi install`, or in print, JSON, or RPC mode.

Setup explains both modes, then asks two questions:

1. **What command runs your quick check?** For example, `npm run test:smoke`.
2. **What command runs all your tests?** For example, `npm run test:full`.

Use the commands your project actually has. Type `none` if a check does not exist. Review your answers, then choose whether to save them. Nothing runs during setup. Do not put passwords or tokens in a command.

**You can say no or press Escape. Without saved settings, the extension does nothing:**

- No mode rules are added to the agent's instructions.
- No mode picker or footer label is shown.
- `/agent-mode beast` and `--agent-mode beast` cannot bypass setup.

Partial answers are thrown away. The extension only remembers that you skipped this folder, so it will not ask again on every launch. To try later, run:

```text
/agent-mode setup
```

Each folder has its own setup. Start Pi from the project root. Settings are not inherited by child folders or other projects.

Pi must trust the project before modes can be set up or used. If needed, use `/trust`, then `/reload`. The extension does not grant trust for you.

## Use

After setup, choose Default or Beast at session startup. Default is first; Escape leaves Default active.

| Command | What it does |
| --- | --- |
| `/agent-mode` | Opens the mode picker. Escape keeps the current mode. |
| `/agent-mode default` | Uses the saved low-usage rules. |
| `/agent-mode beast` | Allows more iterations, helpers, and tests. |
| `/agent-mode setup` | Runs setup again. Cancelling keeps any settings you already saved. |
| `/agent-mode off` | Removes this project's saved mode settings and turns the extension off. |
| `/agent-mode status` | Shows whether modes are off, Default, or Beast. |

Use these commands to keep the mode and footer in sync. The extension does not read plain-text requests such as “use Beast.” Wait for an active run to finish, or stop it, before changing modes or settings.

Setup answers are saved. The selected mode is not. New, resumed, forked, and reloaded sessions ask you to choose a mode again, without repeating setup.

### Default

For code changes, Pi runs the saved quick check once after integration. It may rerun that check to verify a failure was fixed. Other tests, builds, and full validation need your request.

Pi still adds regression tests when needed. It keeps searches and output short, and uses helper agents only when their benefit is worth the extra work and tokens.

### Beast

A **Ralph loop** means inspect → implement → test → fix → repeat.

Beast allows that loop for any request. It also allows any test, build, or full suite as many times as needed, without another request. There is no fixed subagent cap from this mode; real tool and runtime limits still apply.

For code changes, Pi should reach the goal and pass full validation on the final code before it claims completion. It must fix causes, not weaken tests to make them pass. Missing checks and blocked work must stay visible.

A question, plan, or documentation edit does not need a large test run just because Beast is on. Pi must stop if you cancel or a real blocker needs your help.

These are instructions for the agent, not a forced background loop. The extension does not run tests, spawn agents, add subagent tools, restart a stopped agent, or verify results itself.

## Automation

Finish setup in a terminal first. Then you can select a mode without the picker:

```sh
pi --agent-mode default --print "Explain this code"
pi --agent-mode beast --print "Fix this bug and check the result"
```

Print, JSON, and RPC sessions never open setup or picker dialogs. They stay off without saved settings. With settings, they use Default unless you pass the flag. RPC clients can also use the explicit mode commands.

The flag is reapplied when a session starts or reloads in that Pi process. It does not replace setup or project trust.

If settings cannot be read, modes stay off and Pi shows a warning. Headless warnings use stderr, not the JSON output stream. An error does not stop Pi or guarantee a failed process exit.

## Where settings live

Settings are saved locally under Pi's agent directory:

```text
~/.pi/agent/agent-modes/projects/<folder-hash>.json
```

A custom Pi agent directory is supported. The file contains your two commands, or only a note that setup was skipped. It does not store the project path. Folder aliases that point to the same real folder share settings.

The extension does not edit `AGENTS.md`, create files in your project, or save credentials. Its selected rules replace conflicting project-level test and delegation defaults, but leave other project rules in place. Higher-priority instructions and approval limits still apply.

Upgrading from 0.1.0 requires setup. An existing Beast Markdown file no longer turns the extension on. The old `--beast-file` option and manual overlay examples were removed; setup now supplies both modes.

## Develop

No install or build step is needed for the source checkout:

```sh
npm run test:smoke
npm test
```

Smoke checks cover setup, saving, mode changes, skipping, trust, headless startup, and turning off. The broader tests cover cancellation at every step, failed saves, bad settings, folder isolation, and session resets. Tests use temporary folders, not your real Pi settings. CI runs them on Linux and Windows.

To also check the real Pi input renderer and same-process reload, point the smoke check at an installed Pi 1.5.0 package folder:

```sh
npm run test:smoke -- --pi-root /path/to/node_modules/@earendil-works/pi-coding-agent
```

This check uses temporary source copies and makes no model calls. It checks that the example stays visible while typing, then edits the copy and checks that Pi loads the new text without restarting. Runtime helpers use `.ts` files so Pi can reload them instead of reusing cached native JavaScript imports.

For a manual check, use a temporary project folder. Skip setup and confirm the extension stays off. Run `/agent-mode setup`, save two commands, and try both modes. Reload to check that answers remain saved but the mode picker returns. Try `/agent-mode off` and confirm that no mode rules or footer label remain.

## Publish

Maintainer checklist for `@nikpushkarski/pi-agent-modes`:

1. Update `package.json` and `CHANGELOG.md` for the release. Each published npm version must be unique.
2. Run `npm run test:smoke` and `npm test`, then inspect `npm pack --dry-run` to confirm the package contents.
3. Commit and push the release changes to [GitHub](https://github.com/nikpushkarski/pi-agent-modes), and confirm CI passes.
4. Run `npm login` locally, then check that `npm whoami` reports `nikpushkarski`.
5. Publish with `npm publish --access public`. Create a matching Git tag and GitHub release, such as `v0.2.1` for version `0.2.1`.
6. Verify installation from npm in a clean Pi environment, including setup, mode switching, `/reload`, and `/agent-mode off`.

Keep the `pi-package` keyword. It makes the published npm package eligible for the [Pi package gallery](https://pi.dev/packages). Listing and its timing are controlled by the gallery.

No publishing tokens or automatic release jobs are included.

## Remove

Use the command matching your installation source:

```sh
# npm
pi remove npm:@nikpushkarski/pi-agent-modes

# GitHub
pi remove git:github.com/nikpushkarski/pi-agent-modes

# Local checkout
pi remove /absolute/path/to/pi-agent-modes
```

Then reload or restart Pi. Uninstalling leaves local settings in place. Use `/agent-mode off` before uninstalling if you want to remove this project's saved commands.

## Support

Report bugs or request features in [GitHub Issues](https://github.com/nikpushkarski/pi-agent-modes/issues).

## License

MIT. See [LICENSE](LICENSE).
