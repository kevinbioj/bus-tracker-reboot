const liaTniLines = ["12", "13", "15", "18", "21"];

/** @type {import('../src/source').Source[]} */
const resources = [
  {
    id: "lia",
    staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/1e666e24-58ee-46b9-8952-ea2755ba88f2",
    realtimeResourceHrefs: [
      "https://gtfs.bus-tracker.fr/gtfs-rt/lia/vehicle-positions",
      "https://gtfs.bus-tracker.fr/gtfs-rt/lia/trip-updates",
    ],
    allowJourney: (journey) => liaTniLines.includes(journey.trip.route.id),
    getNetworkRef: () => "LIA",
    getOperatorRef: (journey) => (liaTniLines.includes(journey?.trip.route.id) ? "TNI" : "CTPO"),
  },
];

export default resources;
