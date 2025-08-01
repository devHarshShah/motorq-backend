// src/app.ts
import express, { Request, Response } from 'express';
import { errorHandler } from './middlewares/errorHandler';
import vehicleRoutes from './routes/vehicle.routes';

const app = express();
const port = process.env.PORT || 8000;

app.use(errorHandler);
app.use('/api', vehicleRoutes);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
