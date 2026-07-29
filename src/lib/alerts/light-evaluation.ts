export const LIGHT_EVALUATION_START_HOUR = 6;
export const LIGHT_EVALUATION_END_HOUR = 18;
export const LIGHT_EVALUATION_TIME_ZONE = "Asia/Manila";

const MANILA_HOUR_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: LIGHT_EVALUATION_TIME_ZONE,
  hour: "2-digit",
  hourCycle: "h23",
});

export function isWithinLightEvaluationWindow(date: Date): boolean {
  if (Number.isNaN(date.getTime())) return false;

  const hourPart = MANILA_HOUR_FORMATTER.formatToParts(date).find(
    (part) => part.type === "hour"
  );
  if (!hourPart) return false;

  const hour = Number(hourPart.value);
  return (
    Number.isInteger(hour) &&
    hour >= LIGHT_EVALUATION_START_HOUR &&
    hour < LIGHT_EVALUATION_END_HOUR
  );
}
