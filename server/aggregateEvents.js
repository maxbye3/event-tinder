const normalize = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

const parseDate = (value) => {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateIso = (date) => date.toISOString().slice(0, 10);

export const aggregateEvents = (events) => {
  const groups = new Map();

  for (const event of events ?? []) {
    if (event == null || typeof event !== 'object') continue;

    const keyParts = [
      normalize(event.title),
      normalize(event.venue),
      normalize(event.address),
      normalize(event.description),
    ];

    const key = keyParts.join('|');

    if (!groups.has(key)) {
      groups.set(key, {
        base: { ...event },
        dates: new Set(),
        times: new Set(),
        images: [],
      });
    }

    const group = groups.get(key);

    if (event.date) {
      group.dates.add(event.date);
    }

    if (typeof event.time === 'string' && event.time.trim().length > 0) {
      group.times.add(event.time.trim());
    }

    if (event.image) {
      group.images.push(event.image);
    }
  }

  const aggregated = [];

  for (const { base, dates, times, images } of groups.values()) {
    const uniqueDates = Array.from(dates);
    const parsedDates = uniqueDates
      .map((raw) => ({ raw, parsed: parseDate(raw) }))
      .filter((entry) => entry.parsed);

    let dateLabel = base.date ?? null;

    if (parsedDates.length > 0) {
      parsedDates.sort((a, b) => a.parsed - b.parsed);
      const start = parsedDates[0];
      const end = parsedDates[parsedDates.length - 1];
      dateLabel =
        start.parsed.getTime() === end.parsed.getTime()
          ? start.raw
          : `${formatDateIso(start.parsed)} - ${formatDateIso(end.parsed)}`;
    } else if (uniqueDates.length > 0) {
      const sorted = [...uniqueDates].sort();
      dateLabel =
        sorted.length === 1 ? sorted[0] : `${sorted[0]} - ${sorted[sorted.length - 1]}`;
    }

    const uniqueTimes = Array.from(times);
    let timeLabel = base.time ?? null;
    if (uniqueTimes.length === 1) {
      timeLabel = uniqueTimes[0];
    } else if (uniqueTimes.length > 1) {
      timeLabel = uniqueTimes.join(', ');
    }

    aggregated.push({
      ...base,
      date: dateLabel ?? base.date ?? 'Unknown',
      time: timeLabel ?? base.time ?? 'TBA',
      imageCandidates: images,
    });
  }

  return aggregated;
};
