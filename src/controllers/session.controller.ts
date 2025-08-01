import { Request, Response } from "express";
import { PrismaClient, SessionStatus, SlotStatus } from "../generated/prisma";

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
    console.error("Error fetching sessions:", err);
    res.status(500).json({ error: "Internal Server Error" });
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
    console.error("Error fetching active sessions:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// End parking session (vehicle exit)
export const endParkingSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }

    // Check if session exists and is active
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        vehicle: true,
        slot: true,
        staff: true
      }
    });

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (session.status !== SessionStatus.ACTIVE) {
      return res.status(400).json({ error: "Session is not active" });
    }

    // End session and free up slot in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update session status and set exit time
      const updatedSession = await tx.session.update({
        where: { id: sessionId },
        data: {
          status: SessionStatus.COMPLETED,
          exitTime: new Date()
        },
        include: {
          vehicle: true,
          slot: true,
          staff: true
        }
      });

      // Mark slot as available
      await tx.slot.update({
        where: { id: session.slotId },
        data: { status: SlotStatus.AVAILABLE }
      });

      return updatedSession;
    });

    res.status(200).json({
      message: "Parking session ended successfully",
      session: result
    });

  } catch (err) {
    console.error("Error ending parking session:", err);
    res.status(500).json({ error: "Internal Server Error" });
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
      return res.status(404).json({ error: "Session not found" });
    }

    res.status(200).json(session);
  } catch (err) {
    console.error("Error fetching session:", err);
    res.status(500).json({ error: "Internal Server Error" });
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
    console.error("Error fetching sessions by vehicle:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};