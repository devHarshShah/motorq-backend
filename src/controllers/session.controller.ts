import { Request, Response } from 'express';
import { PrismaClient, SessionStatus, SlotStatus } from '../generated/prisma';
import BillingService from '../services/billing.service';

const prisma = new PrismaClient();

// Get all sessions with optional filtering
export const getSessions = async (req: Request, res: Response) => {
  try {
    const { status, vehicleId, slotId, staffId } = req.query;

    const sessions = await prisma.session.findMany({
      where: {
        ...(status && { status: status as SessionStatus }),
        ...(vehicleId && { vehicleId: vehicleId as string }),
        ...(slotId && { slotId: slotId as string }),
        ...(staffId && { staffId: staffId as string })
      },
      include: {
        vehicle: true,
        slot: true,
        staff: true,
        billing: true
      },
      orderBy: {
        entryTime: 'desc'
      }
    });

    res.status(200).json(sessions);
  } catch (err) {
    console.error('Error fetching sessions:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Get active sessions
export const getActiveSessions = async (req: Request, res: Response) => {
  try {
    const activeSessions = await prisma.session.findMany({
      where: {
        status: SessionStatus.ACTIVE
      },
      include: {
        vehicle: true,
        slot: true,
        staff: true
      },
      orderBy: {
        entryTime: 'desc'
      }
    });

    res.status(200).json(activeSessions);
  } catch (err) {
    console.error('Error fetching active sessions:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// End parking session (vehicle exit)
export const endParkingSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { useSlabPricing = false } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Check if session exists and is active
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        vehicle: true,
        slot: true,
        staff: true,
        billing: true
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== SessionStatus.ACTIVE) {
      return res.status(400).json({ error: 'Session is not active' });
    }

    const exitTime = new Date();
    
    // Calculate billing amount
    const billingCalculation = BillingService.calculateBilling(session, exitTime, useSlabPricing);

    const result = await prisma.$transaction(async (tx) => {
      // Update session with exit time
      const updatedSession = await tx.session.update({
        where: { id: sessionId },
        data: {
          status: SessionStatus.COMPLETED,
          exitTime: exitTime
        },
        include: {
          vehicle: true,
          slot: true,
          staff: true
        }
      });

      // Create or update billing record
      let billing;
      if (session.billing) {
        billing = await tx.billing.update({
          where: { id: session.billing.id },
          data: { amount: billingCalculation.amount }
        });
      } else {
        billing = await tx.billing.create({
          data: {
            sessionId: sessionId,
            type: session.billingType,
            amount: billingCalculation.amount,
            isPaid: false
          }
        });
      }

      // Free up the slot
      await tx.slot.update({
        where: { id: session.slotId },
        data: { status: SlotStatus.AVAILABLE }
      });

      return { ...updatedSession, billing };
    });

    res.status(200).json({
      message: 'Parking session ended successfully',
      session: result,
      billing: {
        amount: billingCalculation.amount,
        durationHours: billingCalculation.durationHours,
        vehicleType: billingCalculation.vehicleType,
        billingType: billingCalculation.billingType
      }
    });
  } catch (err) {
    console.error('Error ending parking session:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Get session by ID
export const getSessionById = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        vehicle: true,
        slot: true,
        staff: true,
        billing: true
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.status(200).json(session);
  } catch (err) {
    console.error('Error fetching session:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Get sessions by vehicle number plate
export const getSessionsByVehicle = async (req: Request, res: Response) => {
  try {
    const { numberPlate } = req.params;

    const sessions = await prisma.session.findMany({
      where: {
        vehicle: {
          numberPlate: {
            equals: numberPlate,
            mode: 'insensitive'
          }
        }
      },
      include: {
        vehicle: true,
        slot: true,
        staff: true,
        billing: true
      },
      orderBy: {
        entryTime: 'desc'
      }
    });

    res.status(200).json(sessions);
  } catch (err) {
    console.error('Error fetching sessions by vehicle:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
