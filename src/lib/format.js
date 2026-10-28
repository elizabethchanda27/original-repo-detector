export function formatDate(iso) {
  if (!iso) return "date not recorded";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "date not recorded";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(date);
}

export function formatNumber(value) {
  if (value == null) return "unknown";
  return Number(value).toLocaleString("en-US");
}
