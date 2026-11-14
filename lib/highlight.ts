export interface Segment {
  text: string;
  /** Index into the flags list, or null for plain text. */
  flag: number | null;
}

/** Splits text into plain and highlighted runs, one run per red-flag quote that can be found. */
export function highlight(text: string, quotes: string[]): Segment[] {
  const ranges: Array<{ start: number; end: number; flag: number }> = [];
  const lower = text.toLowerCase();

  quotes.forEach((quote, flag) => {
    const needle = quote.trim();
    if (needle.length < 3) return;
    let start = text.indexOf(needle);
    if (start < 0) start = lower.indexOf(needle.toLowerCase());
    if (start < 0) return;
    const end = start + needle.length;
    if (ranges.some((r) => start < r.end && end > r.start)) return;
    ranges.push({ start, end, flag });
  });

  ranges.sort((a, b) => a.start - b.start);
  const segments: Segment[] = [];
  let position = 0;
  for (const range of ranges) {
    if (range.start > position) segments.push({ text: text.slice(position, range.start), flag: null });
    segments.push({ text: text.slice(range.start, range.end), flag: range.flag });
    position = range.end;
  }
  if (position < text.length) segments.push({ text: text.slice(position), flag: null });
  return segments;
}
