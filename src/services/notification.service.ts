import { PrismaClient, SessionStatus } from '../generated/prisma';
import BillingService from './billing.service';
import * as cron from 'node-cron';

const prisma = new PrismaClient();

interface DurationAlert {
  sessionId: string;
  vehicleNumberPlate: string;
  slotLocation: string;
  entryTime: Date;
  currentDurationHours: number;
  staffName: string;
  vehicleType: string;
  isNotified: boolean;
  notifiedAt?: Date;
}

class NotificationService {
  private static instance: NotificationService;
  private activeAlerts: Map<string, DurationAlert> = new Map();
  private cronJob: any = null;

  private constructor() {
    this.startMonitoring();
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private startMonitoring() {
    // Run every 30 minutes
    this.cronJob = cron.schedule('*/30 * * * *', async () => {
      console.log('Running 6-hour duration check...');
      await this.checkLongDurationSessions();
    });

    // Also run immediately on startup
    this.checkLongDurationSessions();
  }

  private async checkLongDurationSessions() {
    try {
      const activeSessions = await prisma.session.findMany({
        where: {
          status: SessionStatus.ACTIVE
        },
        include: {
          vehicle: true,
          slot: true,
          staff: true
        }
      });

      const currentTime = new Date();
      const alerts: DurationAlert[] = [];

      for (const session of activeSessions) {
        const durationHours = BillingService.calculateDuration(session.entryTime, currentTime);
        
        if (durationHours >= 6) {
          const existingAlert = this.activeAlerts.get(session.id);
          
          const alert: DurationAlert = {
            sessionId: session.id,
            vehicleNumberPlate: session.vehicle.numberPlate,
            slotLocation: session.slot.location,
            entryTime: session.entryTime,
            currentDurationHours: Math.round(durationHours * 100) / 100,
            staffName: session.staff.name,
            vehicleType: session.vehicle.type,
            isNotified: existingAlert ? existingAlert.isNotified : false,
            notifiedAt: existingAlert ? existingAlert.notifiedAt : undefined
          };

          // Mark as newly notified if this is the first time we detect this session
          if (!existingAlert) {
            alert.isNotified = true;
            alert.notifiedAt = currentTime;
            console.log(`🚨 New 6-hour alert: Vehicle ${alert.vehicleNumberPlate} in slot ${alert.slotLocation} - ${alert.currentDurationHours} hours`);
          }

          alerts.push(alert);
          this.activeAlerts.set(session.id, alert);
        } else {
          // Remove from alerts if duration is now less than 6 hours (session might have been extended)
          this.activeAlerts.delete(session.id);
        }
      }

      // Clean up alerts for sessions that are no longer active
      const activeSessionIds = new Set(activeSessions.map(s => s.id));
      this.activeAlerts.forEach((_, sessionId) => {
        if (!activeSessionIds.has(sessionId)) {
          this.activeAlerts.delete(sessionId);
        }
      });

    } catch (error) {
      console.error('Error checking long duration sessions:', error);
    }
  }

  async getCurrentAlerts(): Promise<DurationAlert[]> {
    // Refresh the current duration for all active alerts
    const currentTime = new Date();
    const updatedAlerts: DurationAlert[] = [];

    for (const alert of this.activeAlerts.values()) {
      const session = await prisma.session.findUnique({
        where: { id: alert.sessionId },
        include: {
          vehicle: true,
          slot: true,
          staff: true
        }
      });

      if (session && session.status === SessionStatus.ACTIVE) {
        const currentDuration = BillingService.calculateDuration(session.entryTime, currentTime);
        
        const updatedAlert: DurationAlert = {
          ...alert,
          currentDurationHours: Math.round(currentDuration * 100) / 100
        };
        
        updatedAlerts.push(updatedAlert);
      }
    }

    return updatedAlerts.sort((a, b) => b.currentDurationHours - a.currentDurationHours);
  }

  async getNewAlerts(): Promise<DurationAlert[]> {
    const allAlerts = await this.getCurrentAlerts();
    return allAlerts.filter(alert => alert.isNotified && alert.notifiedAt);
  }

  async markAlertAsRead(sessionId: string): Promise<boolean> {
    const alert = this.activeAlerts.get(sessionId);
    if (alert) {
      alert.isNotified = false;
      this.activeAlerts.set(sessionId, alert);
      return true;
    }
    return false;
  }

  async getAlertsByVehicle(numberPlate: string): Promise<DurationAlert[]> {
    const allAlerts = await this.getCurrentAlerts();
    return allAlerts.filter(alert => 
      alert.vehicleNumberPlate.toLowerCase().includes(numberPlate.toLowerCase())
    );
  }

  getActiveAlertsCount(): number {
    return this.activeAlerts.size;
  }

  stopMonitoring() {
    if (this.cronJob) {
      this.cronJob.destroy();
      this.cronJob = null;
    }
  }

  // Manual trigger for testing
  async triggerManualCheck(): Promise<DurationAlert[]> {
    await this.checkLongDurationSessions();
    return this.getCurrentAlerts();
  }
}

export default NotificationService;