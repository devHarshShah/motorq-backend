import { Router } from 'express';
import { getAvailableSlotsByType, getAllSlots, getSlotStatistics } from '../controllers/slot.controller';

const router = Router();

router.get('/slots', getAllSlots);
router.get('/slots/statistics', getSlotStatistics);
router.get('/slots/available/:type', getAvailableSlotsByType);

export default router;