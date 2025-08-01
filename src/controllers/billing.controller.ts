import { Request, Response } from 'express';
import { PrismaClient } from '../generated/prisma';
import BillingService from '../services/billing.service';

const prisma = new PrismaClient();

// Get all billing records with optional filtering
export const getBillingRecords = async (req: Request, res: Response) => {
  try {
    const { isPaid, vehicleType, billingType, startDate, endDate } = req.query;

    const whereClause: any = {};

    if (isPaid !== undefined) {
      whereClause.isPaid = isPaid === 'true';
    }

    if (billingType && (billingType === 'HOURLY' || billingType === 'DAY_PASS')) {
      whereClause.type = billingType;
    }

    if (startDate && endDate) {
      whereClause.createdAt = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      };
    }

    if (vehicleType && ['CAR', 'BIKE', 'EV', 'HANDICAP_ACCESSIBLE'].includes(vehicleType as string)) {
      whereClause.session = {
        vehicle: {
          type: vehicleType as string
        }
      };
    }

    const billingRecords = await prisma.billing.findMany({
      where: whereClause,
      include: {
        session: {
          include: {
            vehicle: true,
            slot: true,
            staff: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json(billingRecords);
  } catch (err: any) {
    console.error('Error fetching billing records:', err);
    res.status(500).json({ error: err?.message || 'Internal Server Error' });
  }
};

// Get billing statistics and analytics
export const getBillingStatistics = async (req: Request, res: Response) => {
  try {
    const statistics = await BillingService.getBillingStatistics();
    res.status(200).json(statistics);
  } catch (err: any) {
    console.error('Error fetching billing statistics:', err);
    res.status(500).json({ error: err?.message || 'Internal Server Error' });
  }
};

// Get revenue over time
export const getRevenueOverTime = async (req: Request, res: Response) => {
  try {
    const { period = 'day', limit = 30 } = req.query;
    const revenueData = await BillingService.getRevenueOverTime(
      period as string, 
      parseInt(limit as string) || 30
    );
    res.status(200).json(revenueData);
  } catch (err: any) {
    console.error('Error fetching revenue over time:', err);
    res.status(500).json({ error: err?.message || 'Internal Server Error' });
  }
};

// Calculate billing preview for active session
export const calculateBillingPreview = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { useSlabPricing = false } = req.query;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        vehicle: true,
        slot: true,
        staff: true
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Session is not active' });
    }

    const billingCalculation = BillingService.calculateBilling(
      session, 
      new Date(), 
      useSlabPricing === 'true'
    );

    res.status(200).json({
      sessionId,
      preview: billingCalculation,
      currentTime: new Date(),
      entryTime: session.entryTime
    });
  } catch (err: any) {
    console.error('Error calculating billing preview:', err);
    res.status(500).json({ error: err?.message || 'Internal Server Error' });
  }
};

// Mark billing as paid/unpaid
export const updatePaymentStatus = async (req: Request, res: Response) => {
  try {
    const { billingId } = req.params;
    const { isPaid } = req.body;

    if (typeof isPaid !== 'boolean') {
      return res.status(400).json({ error: 'isPaid must be a boolean value' });
    }

    const updatedBilling = await BillingService.updateBillingPaymentStatus(billingId, isPaid);

    res.status(200).json({
      message: `Billing marked as ${isPaid ? 'paid' : 'unpaid'}`,
      billing: updatedBilling
    });
  } catch (err: any) {
    console.error('Error updating payment status:', err);
    res.status(500).json({ error: err?.message || 'Internal Server Error' });
  }
};

// Get billing record by ID
export const getBillingById = async (req: Request, res: Response) => {
  try {
    const { billingId } = req.params;

    const billing = await prisma.billing.findUnique({
      where: { id: billingId },
      include: {
        session: {
          include: {
            vehicle: true,
            slot: true,
            staff: true
          }
        }
      }
    });

    if (!billing) {
      return res.status(404).json({ error: 'Billing record not found' });
    }

    res.status(200).json(billing);
  } catch (err: any) {
    console.error('Error fetching billing record:', err);
    res.status(500).json({ error: err?.message || 'Internal Server Error' });
  }
};

// Get pricing configuration
export const getPricingConfig = async (req: Request, res: Response) => {
  try {
    const pricingConfig = BillingService.getPricingConfig();
    res.status(200).json(pricingConfig);
  } catch (err: any) {
    console.error('Error fetching pricing config:', err);
    res.status(500).json({ error: err?.message || 'Internal Server Error' });
  }
};

// Get unpaid bills summary
export const getUnpaidBills = async (req: Request, res: Response) => {
  try {
    const unpaidBills = await prisma.billing.findMany({
      where: { isPaid: false },
      include: {
        session: {
          include: {
            vehicle: true,
            slot: true,
            staff: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const totalUnpaidAmount = unpaidBills.reduce((sum, bill) => sum + bill.amount, 0);

    res.status(200).json({
      unpaidBills,
      totalUnpaidAmount,
      count: unpaidBills.length
    });
  } catch (err: any) {
    console.error('Error fetching unpaid bills:', err);
    res.status(500).json({ error: err?.message || 'Internal Server Error' });
  }
};

// Get peak hour analysis
export const getPeakHourAnalysis = async (req: Request, res: Response) => {
  try {
    const { date } = req.query;
    const peakHourData = await BillingService.getPeakHourAnalysis(date as string);
    res.status(200).json(peakHourData);
  } catch (err: any) {
    console.error('Error fetching peak hour analysis:', err);
    res.status(500).json({ error: err?.message || 'Internal Server Error' });
  }
};