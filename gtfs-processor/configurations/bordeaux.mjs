import redisOptions from "./redis/nouvelle-aquitaine.mjs";

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
  },
];

const configuration = {
  redisOptions,
  sources,
};

export default configuration;
