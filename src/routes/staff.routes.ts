import { Router } from 'express';
import { getStaff } from '../controllers/staff.controller';

const router = Router();

router.get('/staff', getStaff);

export default router;