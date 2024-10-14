import { Temporal } from "temporal-polyfill";

/** @type {import('../src/configuration').Source[]} */
const sources = [
  {
    id: "bordeaux",
    staticResourceHref:
      "https://bdx.mecatran.com/utw/ws/gtfsfeed/static/bordeaux?apiKey=opendata-bordeaux-metropole-flux-gtfs-rt",
    realtimeResourceHrefs: [
      "https://bdx.mecatran.com/utw/ws/gtfsfeed/vehicles/bordeaux?apiKey=opendata-bordeaux-metropole-flux-gtfs-rt",
      "https://bdx.mecatran.com/utw/ws/gtfsfeed/realtime/bordeaux?apiKey=opendata-bordeaux-metropole-flux-gtfs-rt",
    ],
    getNetworkRef: () => "TBM",
    getOperatorRef: () => "KBDX",
    getVehicleRef: (vehicle) => vehicle?.id.split(":")[1],
  },
];

/** @type {import('../src/configuration').Configuration} */
const configuration = {
  computeInterval: Temporal.Duration.from({ seconds: 10 }),
  redisOptions: {
    url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
  },
  sources,
};

export default configuration;
