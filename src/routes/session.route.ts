import { Router } from 'express';
import { 
  getSessions, 
  getActiveSessions, 
  endParkingSession, 
  getSessionById,
  getSessionsByVehicle 
} from '../controllers/session.controller';

const router = Router();

router.get('/sessions', getSessions);
router.get('/sessions/active', getActiveSessions);
router.get('/sessions/:sessionId', getSessionById);
router.get('/sessions/vehicle/:numberPlate', getSessionsByVehicle);
router.patch('/sessions/:sessionId/end', endParkingSession);

export default router;