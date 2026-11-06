import history from "./softwareUpdateHistory.json";

// Insert-only seeding preserves Admin edits, deletions and read counters.
export const SOFTWARE_UPDATES = history.updates;

