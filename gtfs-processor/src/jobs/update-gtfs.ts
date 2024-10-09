import { Temporal } from "temporal-polyfill";

import type { Source } from "../configuration.js";
import { getStaleness } from "../utils/get-staleness.js";
import { padSourceId } from "../utils/pad-source-id.js";

import { loadGtfs } from "./load-gtfs.js";

export async function updateGtfs(source: Source) {
  const sourceId = padSourceId(source);
  const updateLog = console.draft("%s ► Checking GTFS resource staleness.", sourceId);

  if (typeof source.gtfs === "undefined") {
    updateLog("%s ℹ Resource has not loaded yet (error?), performing a load attempt.", sourceId);
    return loadGtfs(source, true);
  }

  if (source.gtfs.lastModified === null && source.gtfs.etag === null) {
    const delta = Temporal.Now.instant().since(source.gtfs.importedAt).total("minutes");
    if (delta >= 60) {
      updateLog("%s ℹ Current resource is older than 60 minutes (no staleness data): updating resource.", sourceId);
      return loadGtfs(source, false);
    }
    updateLog("%s ℹ Current resource is fresh enough (no staleness data).", sourceId);
    return;
  }

  try {
    updateLog("%s ► Fetching resource staleness at '%s'.", sourceId, source.staticResourceHref);
    const staleness = await getStaleness(source.staticResourceHref);

    if (source.gtfs.lastModified !== staleness.lastModified || source.gtfs.etag !== staleness.etag) {
      updateLog("%s ℹ Fetched staleness is different than current: updating resource.", sourceId);
      return;
    } else {
      updateLog("%s ℹ Fetched staleness matches current staleness.", sourceId);
    }
  } catch {
    const delta = Temporal.Now.instant().since(source.gtfs.importedAt).total("minutes");
    if (delta >= 60) {
      updateLog(
        "%s ⚠ Failed to fetch resource staleness, and current resource is older than 60 minutes: updating resource.",
        sourceId,
      );
      return loadGtfs(source, false);
    }
    updateLog("%s ⚠ Failed to fetch resource staleness, but current resource looks fresh enough.", sourceId);
    return;
  }
  //   const hasLastModifiedOrEtag = !!(source.gtfs.lastModified ?? source.gtfs.etag);

  //   if (hasLastModifiedOrEtag) {
  //     console.log(
  //       "\tⓘ Current values: [Last-Modified: '%s', ETag: '%s']",
  //       source.gtfs.lastModified ?? "None",
  //       source.gtfs.etag ?? "None",
  //     );

  //     try {
  //       const received = await getStaleness(source.staticResourceHref).catch(() => ({
  //         lastModified: null,
  //         etag: null,
  //       }));
  //       console.log(
  //         "\tⓘ New values: [Last-Modified: '%s', ETag: '%s']",
  //         received?.lastModified ?? "None",
  //         received?.etag ?? "None",
  //       );

  //       shouldUpdate = source.gtfs.lastModified !== received?.lastModified || source.gtfs.etag !== received?.etag;
  //     } catch {
  //       console.warn("\t⚠ Failed to retrieve resource staleness, considering stale 1 hour after import.");
  //       shouldUpdate = Temporal.Now.instant().since(source.gtfs.importedAt).total("minutes") >= 60;
  //     }
  //   } else {
  //     console.log("\tⓘ Current resource has no staleness data, considering stale 1 hour after import.");
  //     shouldUpdate = Temporal.Now.instant().since(source.gtfs.importedAt).total("minutes") >= 60;
  //   }
  // } else {
  //   console.log("\tⓘ Resource has not loaded yet.");
  //   shouldUpdate = true;
  // }

  // if (!shouldUpdate) {
  //   console.log("✓ Resource does not need to be updated.\n");
  //   return;
  // }
  // return load-gtfs(source, false);
}
