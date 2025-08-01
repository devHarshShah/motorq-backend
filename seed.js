const { PrismaClient, VehicleType, SlotStatus, SessionStatus, BillingType } = require('./src/generated/prisma');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clear existing data (optional - remove if you want to keep existing data)
  console.log('🧹 Cleaning existing data...');
  await prisma.billing.deleteMany();
  await prisma.session.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.slot.deleteMany();
  await prisma.staff.deleteMany();

  // Seed Staff
  console.log('👥 Seeding staff...');
  const staff = await Promise.all([
    prisma.staff.create({
      data: {
        employeeId: 'EMP001',
        name: 'John Smith',
        phone: '+1-555-0101',
      },
    }),
    prisma.staff.create({
      data: {
        employeeId: 'EMP002',
        name: 'Sarah Johnson',
        phone: '+1-555-0102',
      },
    }),
    prisma.staff.create({
      data: {
        employeeId: 'EMP003',
        name: 'Mike Davis',
        phone: '+1-555-0103',
      },
    }),
    prisma.staff.create({
      data: {
        employeeId: 'EMP004',
        name: 'Lisa Wilson',
        phone: '+1-555-0104',
      },
    }),
  ]);

  // Seed Vehicles
  console.log('🚗 Seeding vehicles...');
  const vehicles = await Promise.all([
    // Cars
    prisma.vehicle.create({
      data: { numberPlate: 'ABC123', type: VehicleType.CAR },
    }),
    prisma.vehicle.create({
      data: { numberPlate: 'XYZ789', type: VehicleType.CAR },
    }),
    prisma.vehicle.create({
      data: { numberPlate: 'DEF456', type: VehicleType.CAR },
    }),
    prisma.vehicle.create({
      data: { numberPlate: 'GHI321', type: VehicleType.CAR },
    }),
    prisma.vehicle.create({
      data: { numberPlate: 'JKL654', type: VehicleType.CAR },
    }),
    
    // Bikes
    prisma.vehicle.create({
      data: { numberPlate: 'BIKE001', type: VehicleType.BIKE },
    }),
    prisma.vehicle.create({
      data: { numberPlate: 'BIKE002', type: VehicleType.BIKE },
    }),
    prisma.vehicle.create({
      data: { numberPlate: 'BIKE003', type: VehicleType.BIKE },
    }),
    
    // EVs
    prisma.vehicle.create({
      data: { numberPlate: 'EV001', type: VehicleType.EV },
    }),
    prisma.vehicle.create({
      data: { numberPlate: 'EV002', type: VehicleType.EV },
    }),
    prisma.vehicle.create({
      data: { numberPlate: 'TESLA01', type: VehicleType.EV },
    }),
    
    // Handicap Accessible
    prisma.vehicle.create({
      data: { numberPlate: 'HAC001', type: VehicleType.HANDICAP_ACCESSIBLE },
    }),
    prisma.vehicle.create({
      data: { numberPlate: 'HAC002', type: VehicleType.HANDICAP_ACCESSIBLE },
    }),
  ]);

  // Seed Slots
  console.log('🅿️ Seeding parking slots...');
  const slots = [];
  
  // Ground floor car slots
  for (let i = 1; i <= 15; i++) {
    slots.push(
      prisma.slot.create({
        data: {
          location: `G-${i.toString().padStart(2, '0')}`,
          type: VehicleType.CAR,
          status: i <= 8 ? SlotStatus.AVAILABLE : i <= 12 ? SlotStatus.OCCUPIED : SlotStatus.MAINTENANCE,
        },
      })
    );
  }

  // Basement 1 car slots
  for (let i = 1; i <= 20; i++) {
    slots.push(
      prisma.slot.create({
        data: {
          location: `B1-${i.toString().padStart(2, '0')}`,
          type: VehicleType.CAR,
          status: i <= 12 ? SlotStatus.AVAILABLE : i <= 18 ? SlotStatus.OCCUPIED : SlotStatus.MAINTENANCE,
        },
      })
    );
  }

  // Bike slots
  for (let i = 1; i <= 10; i++) {
    slots.push(
      prisma.slot.create({
        data: {
          location: `BIKE-${i.toString().padStart(2, '0')}`,
          type: VehicleType.BIKE,
          status: i <= 6 ? SlotStatus.AVAILABLE : i <= 8 ? SlotStatus.OCCUPIED : SlotStatus.MAINTENANCE,
        },
      })
    );
  }

  // EV charging slots
  for (let i = 1; i <= 8; i++) {
    slots.push(
      prisma.slot.create({
        data: {
          location: `EV-${i.toString().padStart(2, '0')}`,
          type: VehicleType.EV,
          status: i <= 4 ? SlotStatus.AVAILABLE : i <= 6 ? SlotStatus.OCCUPIED : SlotStatus.MAINTENANCE,
        },
      })
    );
  }

  // Handicap accessible slots
  for (let i = 1; i <= 4; i++) {
    slots.push(
      prisma.slot.create({
        data: {
          location: `HAC-${i.toString().padStart(2, '0')}`,
          type: VehicleType.HANDICAP_ACCESSIBLE,
          status: i <= 2 ? SlotStatus.AVAILABLE : SlotStatus.OCCUPIED,
        },
      })
    );
  }

  const createdSlots = await Promise.all(slots);

  // Seed Sessions
  console.log('📝 Seeding parking sessions...');
  const sessions = [];
  const now = new Date();
  
  // Get occupied slots for active sessions
  const occupiedSlots = createdSlots.filter(slot => slot.status === SlotStatus.OCCUPIED);
  
  // Create active sessions for occupied slots
  for (let i = 0; i < occupiedSlots.length && i < vehicles.length; i++) {
    const slot = occupiedSlots[i];
    const vehicle = vehicles.find(v => v.type === slot.type) || vehicles[i];
    const staffMember = staff[i % staff.length];
    
    // Random entry time between 1-8 hours ago
    const entryTime = new Date(now.getTime() - Math.random() * 8 * 60 * 60 * 1000);
    
    sessions.push(
      prisma.session.create({
        data: {
          vehicleId: vehicle.id,
          slotId: slot.id,
          staffId: staffMember.id,
          entryTime: entryTime,
          status: SessionStatus.ACTIVE,
          billingType: Math.random() > 0.3 ? BillingType.HOURLY : BillingType.DAY_PASS,
        },
      })
    );
  }

  // Create some completed sessions
  for (let i = 0; i < 10; i++) {
    const vehicle = vehicles[i % vehicles.length];
    const availableSlot = createdSlots.find(slot => 
      slot.status === SlotStatus.AVAILABLE && slot.type === vehicle.type
    );
    
    if (availableSlot) {
      const staffMember = staff[i % staff.length];
      
      // Random entry time between 1-7 days ago
      const entryTime = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);
      // Exit time between 1-12 hours after entry
      const exitTime = new Date(entryTime.getTime() + (1 + Math.random() * 11) * 60 * 60 * 1000);
      
      sessions.push(
        prisma.session.create({
          data: {
            vehicleId: vehicle.id,
            slotId: availableSlot.id,
            staffId: staffMember.id,
            entryTime: entryTime,
            exitTime: exitTime,
            status: SessionStatus.COMPLETED,
            billingType: Math.random() > 0.4 ? BillingType.HOURLY : BillingType.DAY_PASS,
          },
        })
      );
    }
  }

  const createdSessions = await Promise.all(sessions);

  // Seed Billing
  console.log('💳 Seeding billing records...');
  const billingRecords = [];
  
  for (const session of createdSessions) {
    const isHourly = session.billingType === BillingType.HOURLY;
    let amount;
    
    if (isHourly) {
      // Calculate hours parked (minimum 1 hour)
      const endTime = session.exitTime || now;
      const hoursParked = Math.max(1, Math.ceil((endTime.getTime() - session.entryTime.getTime()) / (1000 * 60 * 60)));
      
      // Different hourly rates based on vehicle type
      const hourlyRate = session.vehicle?.type === VehicleType.EV ? 3.5 :
                        session.vehicle?.type === VehicleType.BIKE ? 1.0 :
                        session.vehicle?.type === VehicleType.HANDICAP_ACCESSIBLE ? 2.0 : 2.5;
      
      amount = hoursParked * hourlyRate;
    } else {
      // Day pass rates
      amount = session.vehicle?.type === VehicleType.EV ? 25 :
               session.vehicle?.type === VehicleType.BIKE ? 8 :
               session.vehicle?.type === VehicleType.HANDICAP_ACCESSIBLE ? 15 : 20;
    }
    
    billingRecords.push(
      prisma.billing.create({
        data: {
          sessionId: session.id,
          type: session.billingType,
          amount: Math.round(amount * 100) / 100, // Round to 2 decimal places
          isPaid: session.status === SessionStatus.COMPLETED ? Math.random() > 0.2 : false, // 80% of completed sessions are paid
        },
      })
    );
  }

  await Promise.all(billingRecords);

  console.log('✅ Database seeding completed successfully!');
  console.log(`Created:
  - ${staff.length} staff members
  - ${vehicles.length} vehicles
  - ${createdSlots.length} parking slots
  - ${createdSessions.length} parking sessions
  - ${billingRecords.length} billing records`);
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });