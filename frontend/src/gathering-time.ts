/** Gentle, human wording for when a gathering starts. */
export function startsInText(startsAtIso: string, durationMinutes: number, now = new Date()): string {
  const start = new Date(startsAtIso);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const diffMs = start.getTime() - now.getTime();
  if (now >= start && now < end) return "Happening now";
  const mins = Math.round(diffMs / 60_000);
  if (mins <= 1) return "Starting now";
  if (mins < 60) return `Starts in ${mins} minutes`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours === 1 ? "Starts in 1 hour" : `Starts in ${hours} hours`;
  const days = Math.round(hours / 24);
  if (days === 1) {
    const time = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `Tomorrow at ${time}`;
  }
  if (days < 7) {
    const day = start.toLocaleDateString(undefined, { weekday: "long" });
    const time = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `${day} at ${time}`;
  }
  return `In ${days} days`;
}
