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

  const inferItineraryEdition = (payload) => {
    const haystack = payload.map((event) => [
      event?.title,
      event?.venue,
      event?.address,
      event?.source,
      event?.description,
      event?.url,
    ].filter(Boolean).join(' ')).join(' ');

    if (/\b(london|uk|united kingdom|westminster|southbank|barbican|shoreditch|soho|camden|hackney|greenwich|londonist)\b/i.test(haystack)) {
      return { cityName: 'London', edition: 'London Edition' };
    }

    if (/\b(washington|dc|district of columbia|smithsonian|georgetown|dupont|capitol hill|downtown dc)\b/i.test(haystack)) {
      return { cityName: 'DC', edition: 'DC Edition' };
    }

    return { cityName: '', edition: '' };
  };

  const createEmailBody = (payload) => {
    const { cityName, edition } = inferItineraryEdition(payload);
    return [
      `Here is my ${cityName ? `${cityName} ` : ''}Event Tinder itinerary:`,
      '',
      payload.map(formatEvent).join('\n\n'),
      '',
      `Built with Event Tinder${edition ? ` ${edition}` : ''}`,
    ].join('\n');
  };

  const copyToClipboard = async (value) => {
    if (!global.navigator?.clipboard?.writeText) {
      return false;
    }

    try {
      await global.navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  };

  const send = async (itineraryItems) => {
    const payload = Array.isArray(itineraryItems) ? itineraryItems : [];
    if (payload.length === 0) {
      return false;
    }

    const body = createEmailBody(payload);
    await copyToClipboard(body);

    const { cityName } = inferItineraryEdition(payload);
    const subject = `${cityName ? `${cityName} ` : ''}Event Tinder Itinerary`;
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const link = global.document.createElement('a');
    link.href = mailtoUrl;
    link.target = '_blank';
    link.rel = 'noreferrer noopener';
    global.document.body.appendChild(link);
    link.click();
    link.remove();
    return true;
  };

  global.EmailItinerary = Object.freeze({
    send,
  });
})(window);
