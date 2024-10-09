import type { Source } from "../source.js";

export function padSourceId(source: Source) {
  return source.id.padStart(16, " ");
}
