import { getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
// Keep runtime helpers in TypeScript so Pi's loader can refresh them on /reload.
// Native ESM .js imports can stay cached even when Pi reloads this entry point.
import { registerAgentModes } from "./extension.ts";

export default function agentModes(pi: ExtensionAPI) {
  registerAgentModes(pi, { agentDir: getAgentDir() });
}
