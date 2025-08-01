import { Router } from 'express';
import {
  getNotifications,
  getNotificationsCount,
  markNotificationAsRead,
  getNotificationsByVehicle,
  triggerNotificationCheck,
  notificationStream
} from '../controllers/notification.controller';

const router = Router();

// Get all current notifications
// Query params: ?type=new (for new notifications only)
router.get('/notifications', getNotifications);

// Get notification count (for badges/indicators)
router.get('/notifications/count', getNotificationsCount);

// Server-Sent Events for real-time notifications
router.get('/notifications/stream', notificationStream);

// Manual trigger for notification check (admin/testing)
router.post('/notifications/check', triggerNotificationCheck);

// Mark notification as read
router.patch('/notifications/:sessionId/read', markNotificationAsRead);

// Get notifications by vehicle number plate
router.get('/notifications/vehicle/:numberPlate', getNotificationsByVehicle);

export default router;