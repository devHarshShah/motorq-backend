import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

type VehicleType = 'CAR' | 'BIKE' | 'EV' | 'HANDICAP_ACCESSIBLE';
type BillingType = 'HOURLY' | 'DAY_PASS';

interface SlabPricing {
  minHours: number;
  maxHours: number;
  rate: number;
}

interface Session {
  vehicle: {
    type: VehicleType;
  };
  billingType: BillingType;
  entryTime: Date | string;
}

interface BillingCalculation {
  amount: number;
  durationHours: number;
  vehicleType: VehicleType;
  billingType: BillingType;
}

interface BillingStatistics {
  totalRevenue: number;
  totalBills: number;
  paidBills: number;
  unpaidBills: number;
  revenueByType: {
    billingType: string;
    revenue: number;
    count: number;
  }[];
  revenueByVehicleType: {
    vehicleType: string;
    totalRevenue: number;
    totalBills: number;
    paidRevenue: number;
    paidBills: number;
  }[];
}

interface RevenueOverTime {
  period: string;
  revenue: number;
  transactions: number;
  paidRevenue: number;
  paidTransactions: number;
}

interface PeakHourData {
  hour: number;
  entriesCount: number;
  exitsCount: number;
  revenue: number;
  avgOccupancy: number;
  totalDuration: number;
  vehicleBreakdown: {
    vehicleType: string;
    count: number;
  }[];
}

const PRICING_CONFIG = {
  HOURLY: {
    CAR: 50.00,
    BIKE: 20.00,
    EV: 60.00,
    HANDICAP_ACCESSIBLE: 40.00,
  },
  DAY_PASS: {
    CAR: 400.00,
    BIKE: 150.00,
    EV: 500.00,
    HANDICAP_ACCESSIBLE: 300.00,
  },
  SLAB_PRICING: {
    CAR: [
      { minHours: 0, maxHours: 1, rate: 50 },
      { minHours: 1, maxHours: 3, rate: 120 },
      { minHours: 3, maxHours: 6, rate: 200 },
      { minHours: 6, maxHours: Infinity, rate: 300 },
    ],
    BIKE: [
      { minHours: 0, maxHours: 1, rate: 20 },
      { minHours: 1, maxHours: 3, rate: 50 },
      { minHours: 3, maxHours: 6, rate: 80 },
      { minHours: 6, maxHours: Infinity, rate: 120 },
    ],
    EV: [
      { minHours: 0, maxHours: 1, rate: 60 },
      { minHours: 1, maxHours: 3, rate: 150 },
      { minHours: 3, maxHours: 6, rate: 250 },
      { minHours: 6, maxHours: Infinity, rate: 350 },
    ],
    HANDICAP_ACCESSIBLE: [
      { minHours: 0, maxHours: 1, rate: 40 },
      { minHours: 1, maxHours: 3, rate: 100 },
      { minHours: 3, maxHours: 6, rate: 160 },
      { minHours: 6, maxHours: Infinity, rate: 240 },
    ],
  },
};

class BillingService {
  static calculateDuration(entryTime: Date | string, exitTime: Date | string): number {
    const entry = new Date(entryTime);
    const exit = new Date(exitTime);
    const durationMs = exit.getTime() - entry.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
    return Math.max(0, durationHours);
  }

  static calculateHourlyBilling(vehicleType: VehicleType, durationHours: number, useSlabPricing: boolean = false): number {
    if (useSlabPricing) {
      return this.calculateSlabBilling(vehicleType, durationHours);
    }

    const hourlyRate = PRICING_CONFIG.HOURLY[vehicleType];
    if (!hourlyRate) {
      throw new Error(`Invalid vehicle type: ${vehicleType}`);
    }

    const ceiledHours = Math.ceil(durationHours);
    return hourlyRate * ceiledHours;
  }

  static calculateSlabBilling(vehicleType: VehicleType, durationHours: number): number {
    const slabs = PRICING_CONFIG.SLAB_PRICING[vehicleType];
    if (!slabs) {
      throw new Error(`Invalid vehicle type: ${vehicleType}`);
    }

    for (const slab of slabs) {
      if (durationHours >= slab.minHours && durationHours < slab.maxHours) {
        return slab.rate;
      }
    }

    return slabs[slabs.length - 1].rate;
  }

  static calculateDayPassBilling(vehicleType: VehicleType): number {
    const dayPassRate = PRICING_CONFIG.DAY_PASS[vehicleType];
    if (!dayPassRate) {
      throw new Error(`Invalid vehicle type: ${vehicleType}`);
    }
    return dayPassRate;
  }

  static calculateBilling(session: Session, exitTime: Date | string = new Date(), useSlabPricing: boolean = false): BillingCalculation {
    const { vehicle, billingType, entryTime } = session;
    const durationHours = this.calculateDuration(entryTime, exitTime);

    let amount = 0;

    if (billingType === 'HOURLY') {
      amount = this.calculateHourlyBilling(vehicle.type, durationHours, useSlabPricing);
    } else if (billingType === 'DAY_PASS') {
      amount = this.calculateDayPassBilling(vehicle.type);
    } else {
      throw new Error(`Invalid billing type: ${billingType}`);
    }

    return {
      amount: Math.round(amount * 100) / 100,
      durationHours: Math.round(durationHours * 100) / 100,
      vehicleType: vehicle.type,
      billingType,
    };
  }

  static async createBillingRecord(sessionId: string, amount: number, billingType: BillingType) {
    try {
      const billing = await prisma.billing.create({
        data: {
          sessionId,
          type: billingType,
          amount,
          isPaid: false,
        },
      });
      return billing;
    } catch (error: any) {
      throw new Error(`Failed to create billing record: ${error?.message || 'Unknown error'}`);
    }
  }

  static async updateBillingPaymentStatus(billingId: string, isPaid: boolean) {
    try {
      const billing = await prisma.billing.update({
        where: { id: billingId },
        data: { isPaid },
      });
      return billing;
    } catch (error: any) {
      throw new Error(`Failed to update billing payment status: ${error?.message || 'Unknown error'}`);
    }
  }

  static async getBillingStatistics(): Promise<BillingStatistics> {
    try {
      const [totalRevenue, totalBills, paidBills, unpaidBills, revenueByType] = await Promise.all([
        prisma.billing.aggregate({
          _sum: { amount: true },
        }),
        prisma.billing.count(),
        prisma.billing.count({ where: { isPaid: true } }),
        prisma.billing.count({ where: { isPaid: false } }),
        prisma.billing.groupBy({
          by: ['type'],
          _sum: { amount: true },
          _count: { id: true },
        }),
      ]);

      const revenueByVehicleType = await prisma.$queryRaw`
        SELECT v.type as vehicleType, 
               SUM(b.amount) as totalRevenue,
               COUNT(b.id) as totalBills,
               SUM(CASE WHEN b."isPaid" = true THEN b.amount ELSE 0 END) as paidRevenue,
               COUNT(CASE WHEN b."isPaid" = true THEN 1 END) as paidBills
        FROM "Billing" b
        JOIN "Session" s ON b."sessionId" = s.id
        JOIN "Vehicle" v ON s."vehicleId" = v.id
        GROUP BY v.type
      ` as any[];

      return {
        totalRevenue: totalRevenue._sum.amount || 0,
        totalBills,
        paidBills,
        unpaidBills,
        revenueByType: revenueByType.map((item: any) => ({
          billingType: item.type,
          revenue: item._sum.amount || 0,
          count: item._count.id,
        })),
        revenueByVehicleType: revenueByVehicleType.map((item: any) => ({
          vehicleType: item.vehicletype,
          totalRevenue: parseFloat(item.totalrevenue) || 0,
          totalBills: parseInt(item.totalbills) || 0,
          paidRevenue: parseFloat(item.paidrevenue) || 0,
          paidBills: parseInt(item.paidbills) || 0,
        })),
      };
    } catch (error: any) {
      throw new Error(`Failed to get billing statistics: ${error?.message || 'Unknown error'}`);
    }
  }

  static async getRevenueOverTime(period: string = 'day', limit: number = 30): Promise<RevenueOverTime[]> {
    try {
      let dateFormat: string;
      let intervalString: string;
      
      switch (period) {
        case 'hour':
          dateFormat = 'YYYY-MM-DD HH24:00:00';
          intervalString = `${limit} hours`;
          break;
        case 'day':
          dateFormat = 'YYYY-MM-DD';
          intervalString = `${limit} days`;
          break;
        case 'week':
          dateFormat = 'YYYY-"W"WW';
          intervalString = `${limit} weeks`;
          break;
        case 'month':
          dateFormat = 'YYYY-MM';
          intervalString = `${limit} months`;
          break;
        default:
          dateFormat = 'YYYY-MM-DD';
          intervalString = `${limit} days`;
      }

      // Create the query using proper SQL with string interpolation
      const query = `
        SELECT 
          TO_CHAR(b."createdAt", '${dateFormat}') as period,
          SUM(b.amount) as revenue,
          COUNT(b.id) as transactions,
          SUM(CASE WHEN b."isPaid" = true THEN b.amount ELSE 0 END) as paidRevenue,
          COUNT(CASE WHEN b."isPaid" = true THEN 1 END) as paidTransactions
        FROM "Billing" b
        WHERE b."createdAt" >= NOW() - INTERVAL '${intervalString}'
        GROUP BY TO_CHAR(b."createdAt", '${dateFormat}')
        ORDER BY period DESC
        LIMIT ${limit}
      `;

      const revenueData = await prisma.$queryRawUnsafe(query) as any[];

      return revenueData.map((item: any) => ({
        period: item.period,
        revenue: parseFloat(item.revenue) || 0,
        transactions: parseInt(item.transactions) || 0,
        paidRevenue: parseFloat(item.paidrevenue) || 0,
        paidTransactions: parseInt(item.paidtransactions) || 0,
      }));
    } catch (error: any) {
      throw new Error(`Failed to get revenue over time: ${error?.message || 'Unknown error'}`);
    }
  }

  static async getPeakHourAnalysis(date?: string): Promise<PeakHourData[]> {
    try {
      const targetDate = date ? new Date(date) : new Date();
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Get hourly entry data
      const hourlyEntries = await prisma.$queryRaw`
        SELECT 
          EXTRACT(HOUR FROM s."entryTime") as hour,
          COUNT(*) as entriesCount,
          SUM(b.amount) as revenue,
          v.type as vehicleType
        FROM "Session" s
        LEFT JOIN "Billing" b ON s.id = b."sessionId"
        LEFT JOIN "Vehicle" v ON s."vehicleId" = v.id
        WHERE s."entryTime" >= ${startOfDay} AND s."entryTime" <= ${endOfDay}
        GROUP BY EXTRACT(HOUR FROM s."entryTime"), v.type
        ORDER BY hour
      ` as any[];

      // Get hourly exit data
      const hourlyExits = await prisma.$queryRaw`
        SELECT 
          EXTRACT(HOUR FROM s."exitTime") as hour,
          COUNT(*) as exitsCount,
          AVG(EXTRACT(EPOCH FROM (s."exitTime" - s."entryTime"))/3600) as avgDuration
        FROM "Session" s
        WHERE s."exitTime" IS NOT NULL 
          AND s."exitTime" >= ${startOfDay} 
          AND s."exitTime" <= ${endOfDay}
        GROUP BY EXTRACT(HOUR FROM s."exitTime")
        ORDER BY hour
      ` as any[];

      // Get occupancy data for each hour
      const hourlyOccupancy = await prisma.$queryRaw`
        SELECT 
          hour_series.hour,
          COUNT(CASE 
            WHEN s."entryTime" <= (${startOfDay}::date + (hour_series.hour || ' hours')::interval)
            AND (s."exitTime" IS NULL OR s."exitTime" > (${startOfDay}::date + (hour_series.hour || ' hours')::interval))
            THEN 1 
          END) as occupancy
        FROM generate_series(0, 23) as hour_series(hour)
        LEFT JOIN "Session" s ON 
          s."entryTime" <= (${startOfDay}::date + (hour_series.hour || ' hours')::interval + interval '1 hour')
          AND (s."exitTime" IS NULL OR s."exitTime" > (${startOfDay}::date + (hour_series.hour || ' hours')::interval))
        GROUP BY hour_series.hour
        ORDER BY hour_series.hour
      ` as any[];

      // Process and combine the data
      const peakHourMap = new Map<number, PeakHourData>();

      // Initialize all hours (0-23)
      for (let i = 0; i < 24; i++) {
        peakHourMap.set(i, {
          hour: i,
          entriesCount: 0,
          exitsCount: 0,
          revenue: 0,
          avgOccupancy: 0,
          totalDuration: 0,
          vehicleBreakdown: []
        });
      }

      // Process entries data
      const vehicleBreakdownMap = new Map<number, Map<string, number>>();
      hourlyEntries.forEach((entry: any) => {
        const hour = parseInt(entry.hour);
        const existing = peakHourMap.get(hour)!;
        existing.entriesCount += parseInt(entry.entriescount || 0);
        existing.revenue += parseFloat(entry.revenue || 0);

        if (!vehicleBreakdownMap.has(hour)) {
          vehicleBreakdownMap.set(hour, new Map());
        }
        const vehicleMap = vehicleBreakdownMap.get(hour)!;
        const vehicleType = entry.vehicletype || 'UNKNOWN';
        vehicleMap.set(vehicleType, (vehicleMap.get(vehicleType) || 0) + parseInt(entry.entriescount || 0));
      });

      // Process exits data
      hourlyExits.forEach((exit: any) => {
        const hour = parseInt(exit.hour);
        const existing = peakHourMap.get(hour)!;
        existing.exitsCount = parseInt(exit.exitscount || 0);
        existing.totalDuration = parseFloat(exit.avgduration || 0);
      });

      // Process occupancy data
      hourlyOccupancy.forEach((occ: any) => {
        const hour = parseInt(occ.hour);
        const existing = peakHourMap.get(hour)!;
        existing.avgOccupancy = parseInt(occ.occupancy || 0);
      });

      // Convert vehicle breakdown maps to arrays
      vehicleBreakdownMap.forEach((vehicleMap, hour) => {
        const existing = peakHourMap.get(hour)!;
        existing.vehicleBreakdown = Array.from(vehicleMap.entries()).map(([vehicleType, count]) => ({
          vehicleType,
          count
        }));
      });

      return Array.from(peakHourMap.values()).sort((a, b) => a.hour - b.hour);
    } catch (error: any) {
      throw new Error(`Failed to get peak hour analysis: ${error?.message || 'Unknown error'}`);
    }
  }

  static getPricingConfig() {
    return PRICING_CONFIG;
  }
}

export default BillingService;