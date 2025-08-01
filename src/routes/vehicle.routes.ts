import { Router } from 'express';
import { getVehicles, createVehicleEntry } from '../controllers/vehicle.controller';

const router = Router();

router.get('/vehicles', getVehicles);
router.post('/vehicles/entry', createVehicleEntry);

export default router;