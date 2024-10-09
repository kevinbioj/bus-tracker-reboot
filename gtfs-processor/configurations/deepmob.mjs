import redisOptions from "./redis/normandie.mjs";

/** @type {import('../src/source').Source[]} */
const sources = [
  {
    id: "deepmob",
    staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/62248658-0eba-4f4e-b367-aaea635ecd38",
    realtimeResourceHrefs: [
      "https://tud.geo3d.hanoverdisplays.com/api-1.0/gtfs-rt/vehicle-positions",
      "https://tud.geo3d.hanoverdisplays.com/api-1.0/gtfs-rt/trip-updates",
    ],
    getNetworkRef: () => "DEEPMOB",
  },
];

const configuration = {
  redisOptions,
  sources,
};

export default configuration;
