import { Temporal } from "temporal-polyfill";

import type { Source } from "../source.js";
import { getStaleness } from "../utils/get-staleness.js";

import { initializeResource } from "./initialize-resource.js";

export async function updateGtfs(source: Source) {
  console.log("► Checking resource staleness for '%s'.", source.id);
  let shouldUpdate = false;
  if (typeof source.gtfs !== "undefined") {
    console.log(
      "\tⓘ Current values: [Last-Modified: '%s', ETag: '%s']",
      source.gtfs.lastModified ?? "None",
      source.gtfs.etag ?? "None",
    );

    try {
      const received = await getStaleness(source.staticResourceHref);
      console.log(
        "\tⓘ New values: [Last-Modified: '%s', ETag: '%s']",
        received.lastModified ?? "None",
        received.etag ?? "None",
      );

      shouldUpdate = source.gtfs.lastModified !== received.lastModified || source.gtfs.etag !== received.etag;
    } catch {
      console.warn("⚠ Failed to retrieve resource staleness, considering stale 1 hour after import.");
      shouldUpdate = Temporal.Now.instant().since(source.gtfs.importedAt).total("hours") >= 1;
    }
  } else {
    console.log("\tⓘ Resource has not loaded yet.");
    shouldUpdate = true;
  }
  if (shouldUpdate) {
    console.log("⚠ Updating resource.");
    return initializeResource(source, false);
  } else {
    console.log("✓ Resource does not need to be updated.\n");
  }
}
