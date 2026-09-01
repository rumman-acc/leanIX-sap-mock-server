// Barrel export for consumers that want to mount these tools on a transport other than the
// stdio one server.ts wires up (e.g. apps/api's remote Streamable HTTP endpoint) — deliberately
// does NOT re-export server.ts, which has a top-level side-effecting main() that starts a stdio
// server on import.
export { LeanIxClient, LeanIxClientConfig } from './leanix-client';
export { registerInventoryTools } from './tools/inventory.tools';
export { registerFactSheetTools } from './tools/fact-sheet.tools';
export { registerRelationTools } from './tools/relation.tools';
export { registerWorkspaceResource } from './resources/workspace.resource';
