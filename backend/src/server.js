import cors from 'cors';
import express from 'express';
import healthRouter from './routes/health.routes.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/api/health', healthRouter);

app.listen(port, () => {
  console.log(`SIPU backend listening on port ${port}`);
});
