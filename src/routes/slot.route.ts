import { Router } from 'express';
import { getAvailableSlotsByType, getAllSlots, getSlotStatistics, updateSlotMaintenanceStatus, manuallyAssignSlotToSession } from '../controllers/slot.controller';

const router = Router();

router.get('/slots', getAllSlots);
router.get('/slots/statistics', getSlotStatistics);
router.get('/slots/available/:type', getAvailableSlotsByType);
router.patch('/slots/:slotId/maintenance', updateSlotMaintenanceStatus);
router.post('/slots/:slotId/assign', manuallyAssignSlotToSession);

export default router;