// src/app.ts
import express, { Request, Response } from 'express';
import cors from 'cors';
import { errorHandler } from './middlewares/errorHandler';
import vehicleRoutes from './routes/vehicle.routes';
import slotRoutes from './routes/slot.route';
import sessionRoutes from './routes/session.route';

const app = express();
const port = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());
app.use(errorHandler);
app.use('/api', vehicleRoutes);
app.use('/api', slotRoutes);
app.use('/api', sessionRoutes);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
