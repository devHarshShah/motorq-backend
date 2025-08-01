import { Request, Response } from 'express';
import NotificationService from '../services/notification.service';

const notificationService = NotificationService.getInstance();

// Get all current 6-hour+ duration alerts
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    
    let alerts;
    if (type === 'new') {
      alerts = await notificationService.getNewAlerts();
    } else {
      alerts = await notificationService.getCurrentAlerts();
    }

    res.status(200).json({
      success: true,
      count: alerts.length,
      data: alerts
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal Server Error' 
    });
  }
};

// Get notifications count (for frontend badge/indicator)
export const getNotificationsCount = async (req: Request, res: Response) => {
  try {
    const count = notificationService.getActiveAlertsCount();
    
    res.status(200).json({
      success: true,
      count
    });
  } catch (error) {
    console.error('Error fetching notifications count:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal Server Error' 
    });
  }
};

// Mark a specific alert as read/acknowledged
export const markNotificationAsRead = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ 
        success: false,
        error: 'Session ID is required' 
      });
    }

    const success = await notificationService.markAlertAsRead(sessionId);
    
    if (success) {
      res.status(200).json({
        success: true,
        message: 'Notification marked as read'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal Server Error' 
    });
  }
};

// Get notifications for a specific vehicle
export const getNotificationsByVehicle = async (req: Request, res: Response) => {
  try {
    const { numberPlate } = req.params;

    if (!numberPlate) {
      return res.status(400).json({ 
        success: false,
        error: 'Vehicle number plate is required' 
      });
    }

    const alerts = await notificationService.getAlertsByVehicle(numberPlate);
    
    res.status(200).json({
      success: true,
      count: alerts.length,
      data: alerts
    });
  } catch (error) {
    console.error('Error fetching notifications by vehicle:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal Server Error' 
    });
  }
};

// Manual trigger for checking long duration sessions (for testing/admin use)
export const triggerNotificationCheck = async (req: Request, res: Response) => {
  try {
    const alerts = await notificationService.triggerManualCheck();
    
    res.status(200).json({
      success: true,
      message: 'Manual notification check completed',
      count: alerts.length,
      data: alerts
    });
  } catch (error) {
    console.error('Error triggering manual notification check:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal Server Error' 
    });
  }
};

// Server-Sent Events endpoint for real-time notifications
export const notificationStream = async (req: Request, res: Response) => {
  try {
    // Set headers for SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial data
    const initialAlerts = await notificationService.getCurrentAlerts();
    res.write(`data: ${JSON.stringify({ type: 'initial', alerts: initialAlerts, count: initialAlerts.length })}\n\n`);

    // Set up periodic updates every 5 minutes
    const intervalId = setInterval(async () => {
      try {
        const alerts = await notificationService.getCurrentAlerts();
        res.write(`data: ${JSON.stringify({ type: 'update', alerts, count: alerts.length, timestamp: new Date() })}\n\n`);
      } catch (error) {
        console.error('Error in SSE update:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(intervalId);
      res.end();
    });

    req.on('aborted', () => {
      clearInterval(intervalId);
      res.end();
    });

  } catch (error) {
    console.error('Error setting up notification stream:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal Server Error' 
    });
  }
};