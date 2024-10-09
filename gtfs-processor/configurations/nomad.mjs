/** @type {import('../src/source').Source[]} */
const resources = [
  {
    id: "nomad-car",
    staticResourceHref: "https://gtfs.bus-tracker.fr/nomad.zip",
    realtimeResourceHrefs: [
      "https://api.atm.cityway.fr/dataflow/horaire-tc-tr/download?provider=NOMAD&dataFormat=GTFS-RT",
      "https://api.atm.cityway.fr/dataflow/vehicule-tc-tr/download?provider=NOMAD&dataFormat=GTFS-RT",
    ],
    getNetworkRef: () => "NOMAD-CAR",
  },
  {
    id: "nomad-train",
    staticResourceHref: "https://gtfs.bus-tracker.fr/nomad-train.zip",
    realtimeResourceHrefs: ["https://proxy.transport.data.gouv.fr/resource/sncf-ter-gtfs-rt-trip-updates"],
    getNetworkRef: () => "NOMAD-TRAIN",
  },
];

export default resources;
