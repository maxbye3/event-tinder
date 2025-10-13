import express from 'express';
import 'dotenv/config';
import { createAgentResponse } from './agentResponse.js';

const app = express();
const port = process.env.PORT ?? 3001;

app.get('/api/agent-response', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    res.status(500).json({ error: 'Missing OPENAI_API_KEY environment variable.' });
    return;
  }

  try {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const payload = await createAgentResponse({ apiKey, query });

    console.log('[openai] response', JSON.stringify(payload, null, 2));
    res.status(200).json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('OpenAI request failed:', message);
    res.status(500).json({ error: message });
  }
});

app.get('/', (_req, res) => {
  res.send('Express backend is running. Use GET /api/agent-response to fetch data.');
});

app.listen(port, () => {
  console.log(`Server ready on http://localhost:${port}`);
});
