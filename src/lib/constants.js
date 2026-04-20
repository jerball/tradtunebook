export const TUNE_TYPES = [
  "reel",
  "jig",
  "slip jig",
  "hornpipe",
  "polka",
  "slide",
  "mazurka",
  "waltz",
  "march",
  "air",
  "barndance"
];

export function formatAgo(iso) {
  if (!iso) return "never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}
