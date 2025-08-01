import express from 'express';
import {
  getBillingRecords,
  getBillingStatistics,
  getRevenueOverTime,
  calculateBillingPreview,
  updatePaymentStatus,
  getBillingById,
  getPricingConfig,
  getUnpaidBills,
  getPeakHourAnalysis
} from '../controllers/billing.controller';

const router = express.Router();

// Get all billing records with optional filtering
router.get('/', getBillingRecords);

// Get billing statistics and analytics
router.get('/statistics', getBillingStatistics);

// Get revenue over time (trends)
router.get('/revenue-trends', getRevenueOverTime);

// Get unpaid bills summary
router.get('/unpaid', getUnpaidBills);

// Get pricing configuration
router.get('/pricing-config', getPricingConfig);

// Get peak hour analysis
router.get('/peak-hours', getPeakHourAnalysis);

// Calculate billing preview for active session
router.get('/preview/:sessionId', calculateBillingPreview);

// Get billing record by ID
router.get('/:billingId', getBillingById);

// Mark billing as paid/unpaid
router.patch('/:billingId/payment', updatePaymentStatus);

export default router;