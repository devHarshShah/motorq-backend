// src/app.ts
import express, { Request, Response } from 'express';
import { errorHandler } from './middlewares/errorHandler';

const app = express();
const port = process.env.PORT || 8000;

app.get('/', (req: Request, res: Response) => {
  res.send('Hello from Express with TypeScript!');
});

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
