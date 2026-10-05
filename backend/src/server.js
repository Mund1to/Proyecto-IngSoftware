import cors from 'cors';
import express from 'express';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_request, response) => {
  response.json({ service: 'sipu-backend', status: 'ok' });
});

app.listen(port, () => {
  console.log(`SIPU backend listening on port ${port}`);
});
