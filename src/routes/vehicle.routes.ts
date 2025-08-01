import { Router } from 'express';
import { getVehicles, createVehicleEntry, searchVehiclesRealtime } from '../controllers/vehicle.controller';

const router = Router();

router.get('/vehicles', getVehicles);
router.get('/vehicles/search', searchVehiclesRealtime);
router.post('/vehicles/entry', createVehicleEntry);

export default router;