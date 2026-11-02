import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const MAX_CONFIG_BYTES = 8192;
export const MAX_COMMAND_LENGTH = 500;

/** A folder's settings never apply to its parent, children, or other projects. */
export async function projectKey(cwd) {
  let canonical = await realpath(cwd);
  if (process.platform === "win32") canonical = canonical.toLowerCase();
  return createHash("sha256").update(canonical).digest("hex");
}

export async function configPath(agentDir, cwd) {
  return join(agentDir, "agent-modes", "projects", `${await projectKey(cwd)}.json`);
}

export function parseCommand(answer) {
  if (typeof answer !== "string" || !answer.trim()) {
    throw new Error("Enter a command, or type none if you do not have one.");
  }
  const value = answer.trim();
  if (value.length > MAX_COMMAND_LENGTH || /[\x00-\x1f\x7f]/.test(value)) {
    throw new Error("Use one line, up to 500 characters. Do not include passwords or tokens.");
  }
  return value.toLowerCase() === "none" ? null : value;
}

function validCommand(command) {
  return command === null || (typeof command === "string" && parseCommand(command) === command);
}

export function validateRecord(record) {
  if (!record || record.version !== 1) throw new Error("Unknown settings format.");
  if (record.status === "skipped" && Object.keys(record).every((key) => ["version", "status"].includes(key))) {
    return record;
  }
  if (record.status === "configured" && record.settings &&
      Object.keys(record).every((key) => ["version", "status", "settings"].includes(key)) &&
      Object.keys(record.settings).every((key) => ["quickCheck", "fullTest"].includes(key)) &&
      validCommand(record.settings.quickCheck) && validCommand(record.settings.fullTest)) {
    return record;
  }
  throw new Error("Invalid mode settings.");
}

export async function loadRecord(agentDir, cwd) {
  const file = await configPath(agentDir, cwd);
  let handle;
  try {
    handle = await open(file, "r");
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw error;
  }
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > MAX_CONFIG_BYTES) throw new Error("Mode settings are too large or not a file.");
    const buffer = Buffer.alloc(MAX_CONFIG_BYTES + 1);
    let bytes = 0;
    while (bytes < buffer.length) {
      const read = await handle.read(buffer, bytes, buffer.length - bytes, null);
      if (!read.bytesRead) break;
      bytes += read.bytesRead;
    }
    if (bytes > MAX_CONFIG_BYTES) throw new Error("Mode settings are too large.");
    return validateRecord(JSON.parse(buffer.subarray(0, bytes).toString("utf8")));
  } finally {
    await handle.close();
  }
}

/** Save only complete answers, atomically. A skipped record contains no mode rules. */
export async function saveRecord(agentDir, cwd, record) {
  validateRecord(record);
  const file = await configPath(agentDir, cwd);
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
}
