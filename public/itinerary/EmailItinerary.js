(function (global) {
  const safeText = (value, fallback = '') => {
    if (typeof value !== 'string') {
      return fallback;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  };

  const formatEvent = (event, index) => {
    const lines = [
      `${index + 1}. ${safeText(event.title, 'Saved event')}`,
    ];

    const dateTime = [safeText(event.date), safeText(event.time)].filter(Boolean).join(' • ');
    if (dateTime) {
      lines.push(dateTime);
    }

    const location = [safeText(event.venue), safeText(event.address)].filter(Boolean).join(', ');
    if (location) {
      lines.push(location);
    }

    const description = safeText(event.description);
    if (description) {
      lines.push(description);
    }

    const url = safeText(event.url);
    if (url) {
      lines.push(url);
    }

    return lines.join('\n');
  };

  const send = (itineraryItems) => {
    const payload = Array.isArray(itineraryItems) ? itineraryItems : [];
    if (payload.length === 0) {
      return;
    }

    const body = [
      'Here is my DC Event Tinder itinerary:',
      '',
      payload.map(formatEvent).join('\n\n'),
      '',
      'Built with Event Tinder DC Edition',
    ].join('\n');

    global.location.href = `mailto:?subject=${encodeURIComponent('DC Event Tinder Itinerary')}&body=${encodeURIComponent(body)}`;
  };

  global.EmailItinerary = Object.freeze({
    send,
  });
})(window);
