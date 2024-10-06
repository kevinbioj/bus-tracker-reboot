# Bus Tracker

**Bus Tracker** est une application web de dataviz sur le thème des transports en commun.

En exploitant les données ouvertes des opérateurs de transport, elle propose sous la forme d'une carte l'ensemble des trajets en cours sur une zone géographique délimitée.

## Architecture

L'application est divisée en trois blocs :

- [le producteur :](./gtfs-processor/) génère régulièrement la liste des trajets actifs sur la base de données GTFS et GTFS-RT ;
- le serveur : il compile les données provenant des différents producteurs, enregistre les activités, et propose la compilation aux utilisateurs ;
- le client : une simple application web pour visualiser toutes ces données.

## Licence

Ce projet est proposé dans le cadre de la licence [**GNU General Public License 3.0**](./LICENSE) et à tous les droits et devoirs qui en découlent.
