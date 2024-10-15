import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { compress } from "hono/compress";
import { createClient } from "redis";
import { Temporal } from "temporal-polyfill";

import { registerActivity } from "./functions/register-activity.js";
import { createJourneyStore } from "./store/journey-store.js";
import type { VehicleJourney } from "./types/vehicle-journey.js";

console.log(`,-----.                  ,--------.                   ,--.                           ,---.                                       
|  |) /_ ,--.,--. ,---.  '--.  .--',--.--.,--,--.,---.|  |,-. ,---. ,--.--. ,-----. '   .-' ,---. ,--.--.,--.  ,--.,---. ,--.--. 
|  .-.  \\|  ||  |(  .-'     |  |   |  .--' ,-.  | .--'|     /| .-. :|  .--' '-----' \`.  \`-.| .-. :|  .--' \\  \`'  /| .-. :|  .--' 
|  '--' /'  ''  '.-'  \`)    |  |   |  |  \\ '-'  \\ \`--.|  \\  \\   --.|   |            .-'    \\   --.|  |     \\    / \\   --.|  |    
\`------'  \`----' \`----'     \`--'   \`--'   \`--\`--'\`---'\`--'\`--'\`----'\`--'            \`-----' \`----'\`--'      \`--'   \`----'\`--'    \n`);

const journeyStore = createJourneyStore();

console.log("► Connecting to Redis.");
const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

redis.subscribe("journeys", async (message) => {
  const vehicleJourney = JSON.parse(message) as VehicleJourney;

  const timeSince = Temporal.Now.instant().since(vehicleJourney.updatedAt);
  if (timeSince.total("minutes") >= 10) return;

  registerActivity(vehicleJourney);
  journeyStore.set(vehicleJourney.id, vehicleJourney);
});

const port = +(process.env.PORT ?? 3000);
console.log("► Listening on port %d.\n", port);

const hono = new Hono();
hono.use(compress());
hono.get("/journeys", (c) => {
  const journeys = journeyStore.values().toArray();
  return c.json({
    journeys,
    count: journeys.length,
    generatedAt: Temporal.Now.instant(),
  });
});
serve({ fetch: hono.fetch, port });
