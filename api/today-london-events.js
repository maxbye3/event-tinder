import { getTodayLondonEvents } from '../server/todayLondonEvents.js';

export default async function handler(request, response) {
  try {
    const payload = await getTodayLondonEvents({
      date: request.query?.date,
      phase: request.query?.phase,
    });
    response.status(200).json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Today London request failed:', message);
    response.status(500).json({ error: message });
  }
}
