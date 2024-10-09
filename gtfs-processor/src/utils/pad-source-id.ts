import type { Source } from "../configuration.js";

export function padSourceId(source: Source) {
  return source.id.padStart(16, " ");
}
