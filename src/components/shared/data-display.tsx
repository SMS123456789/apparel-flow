const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Colombo",
  month: "short",
  day: "numeric",
  year: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Colombo",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
const numberFormatter = new Intl.NumberFormat("en-US");
const percentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export const displayTimezone = "Sri Lanka time (UTC+05:30)";
export function formatCount(value: number) {
  return numberFormatter.format(value);
}
export function formatPercentage(value: string) {
  return `${percentFormatter.format(Number(value))}%`;
}
export function HumanDateTime({
  value,
  stacked = false,
}: {
  value: string;
  stacked?: boolean;
}) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <span>Time unavailable</span>;
  const day = dateFormatter.format(date),
    time = timeFormatter.format(date);
  return (
    <time
      dateTime={value}
      title={`Exact timestamp: ${value}`}
      aria-label={`${day}, ${time}, ${displayTimezone}`}
    >
      {stacked ? (
        <>
          <span className="block date-line">{day}</span>
          <span className="helper block">{time}</span>
        </>
      ) : (
        <>
          {day} · {time}
        </>
      )}
    </time>
  );
}
export function PercentageDisplay({ value }: { value: string }) {
  return (
    <span className="percentage" title={`Exact signed percentage: ${value}%`}>
      {formatPercentage(value)}
    </span>
  );
}
