# Bus Tracker – Processeur GTFS

Ce bloc a pour responsabilité la génération des trajets actifs, sur la base de données GTFS.  
Pour des raisons de pragmatisme, un processeur peut prendre en charge plusieurs sources GTFS.

## Utilisation

1. Installation des dépendances : `npm install`
2. Construction de l'application : `npm run build`
3. Lancement de l'application : `npm run start -- <configuration>`

| Configuration | Couverture                |
| ------------- | ------------------------- |
| astuce        | Astuce (tous exploitants) |
| bordeaux      | TBM                       |
| deepmob       | DeepMob                   |
| lia           | LiA                       |
| nomad         | NOMAD Car + NOMAD Train   |
