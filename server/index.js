import express from 'express';
import 'dotenv/config';
import { getTodayDcEvents } from './todayDcEvents.js';
import { getTodayLondonEvents } from './todayLondonEvents.js';

const app = express();
const port = process.env.PORT ?? 3001;

app.get('/api/today-dc-events', async (req, res) => {
  try {
    const payload = await getTodayDcEvents({ date: req.query.date, phase: req.query.phase });
    res.status(200).json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Today DC request failed:', message);
    res.status(500).json({ error: message });
  }
});

app.get('/api/today-london-events', async (req, res) => {
  try {
    const payload = await getTodayLondonEvents({ date: req.query.date, phase: req.query.phase });
    res.status(200).json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Today London request failed:', message);
    res.status(500).json({ error: message });
  }
});

app.get('/', (_req, res) => {
  res.send('Express backend is running. Use GET /api/today-dc-events or /api/today-london-events to fetch data.');
});

app.listen(port, () => {
  console.log(`Server ready on http://localhost:${port}`);
});
