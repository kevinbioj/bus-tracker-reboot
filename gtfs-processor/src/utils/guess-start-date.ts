import { Temporal } from "temporal-polyfill";

/**
 * "Devine" la date de départ d'une course en fonction de multiples paramètres.
 * Sert de paliatif lorsque les données temps-réel ne la fournissent pas, mais
 * reste néanmoins limitée : on ne peut supporter que les courses allant
 * jusqu'au lendemain midi maximum (exit les Blablacar & co. à travers l'Europe).
 * @param startTime Heure de début d'une course.
 * @param startModulus Décalage de jours (si heure >= 24:xx:xx).
 * @param at Horodatage auquel deviner la date de départ.
 * @returns Une date de départ probable pour la course.
 */
export function guessStartDate(
  startTime: Temporal.PlainTime,
  startModulus: number,
  at = Temporal.Now.zonedDateTimeISO(),
) {
  const atDate = at.toPlainDate();
  if (at.hour < 12 && (startModulus > 0 || startTime.hour > 20)) {
    return atDate.subtract({ days: 1 });
  }
  return atDate;
}
