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

Install from only one source at a time. [Remove](#remove) the previous source before switching to avoid loading the extension twice.

## Set up a project

Start Pi from your project root. On the first **interactive session in that folder**, the extension explains both modes and asks:

1. **What command runs your quick check?** For example, `npm run test:smoke`.
2. **What command runs all your tests?** For example, `npm run test:full`.

Use your project's actual commands, or type `none` if a check does not exist. Review and save your answers; nothing runs during setup. Do not include passwords or tokens.

**Say no or press Escape to leave modes off:** no rules, picker, or footer label are added. Commands and flags cannot bypass setup. Partial answers are discarded, and the skipped folder is remembered. To try later, run:

```text
/agent-mode setup
```

Settings belong to this folder; child folders and other projects do not inherit them.

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

Beast allows **Ralph loops** (inspect → implement → test → fix → repeat) and any test or build as often as needed. It sets no fixed subagent cap; real tool and runtime limits still apply.

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

Unreadable settings leave modes off with a warning. In headless sessions, warnings go to stderr, not the JSON output stream. This does not guarantee a failed process exit.

## Where settings live

Settings are saved locally under Pi's agent directory:

```text
~/.pi/agent/agent-modes/projects/<folder-hash>.json
```

A custom Pi agent directory is supported. The file contains your two commands, or only a note that setup was skipped. It does not store the project path. Folder aliases that point to the same real folder share settings.

The extension does not edit `AGENTS.md`, create files in your project, or save credentials. Its selected rules replace conflicting project-level test and delegation defaults, but leave other project rules in place. Higher-priority instructions and approval limits still apply.

## Develop

To load a local checkout:

```sh
pi install /absolute/path/to/pi-agent-modes
```

Quote paths containing spaces. Pi loads the checkout in place; use `/reload` after editing, not reinstall. Remove any npm or GitHub install first.

No dependency install or build step is needed to run the tests:

```sh
npm run test:smoke
npm test
```

Tests cover setup, mode changes, persistence, trust, headless use, and failure handling. They use temporary folders, not your real Pi settings. CI runs on Linux and Windows.

To also check the real Pi input renderer and same-process reload, point the smoke check at an installed Pi 1.5.0 package folder:

```sh
npm run test:smoke -- --pi-root /path/to/node_modules/@earendil-works/pi-coding-agent
```

This optional check uses temporary source copies and makes no model calls.

## Remove

For an npm install:

```sh
pi remove npm:@nikpushkarski/pi-agent-modes
```

For GitHub or local installs, run `pi list` and pass the listed source to `pi remove`. Add `--local` if you installed with that flag. Then reload or restart Pi.

Uninstalling keeps saved mode settings. To delete this project's settings too, run `/agent-mode off` before uninstalling.

## Support

Report bugs or request features in [GitHub Issues](https://github.com/nikpushkarski/pi-agent-modes/issues).

## License

MIT. See [LICENSE](LICENSE).
