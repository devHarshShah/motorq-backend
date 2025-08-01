import { Router } from 'express';
import { getVehicles } from '../controllers/vehicle.controller';

const router = Router();

router.get('/vehicles', getVehicles);

export default router;