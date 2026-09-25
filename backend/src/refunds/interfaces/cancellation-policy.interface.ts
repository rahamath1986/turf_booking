export interface CancellationRuleTier {
  minHoursBefore: number; // e.g. 24, 12, 4, 0
  refundPercentage: number; // e.g. 100, 75, 50, 0
  fixedFee?: number; // Optional flat deduction
  description?: string;
}

export interface TurfCancellationPolicyConfig {
  turfId?: string;
  freeCancellationHours: number;
  fixedCancellationFee: number;
  rules: CancellationRuleTier[];
  description?: string;
}

export interface CancellationCalculationResult {
  bookingId: string;
  totalPrice: number;
  amountPaid: number;
  hoursRemaining: number;
  cancellationFee: number;
  refundAmount: number;
  refundPercentage: number;
  refundType: 'FULL' | 'PARTIAL' | 'NONE';
  policyApplied: string;
  isEligibleForRefund: boolean;
}

export const DEFAULT_CANCELLATION_POLICY: TurfCancellationPolicyConfig = {
  freeCancellationHours: 24,
  fixedCancellationFee: 0,
  rules: [
    {
      minHoursBefore: 24,
      refundPercentage: 100,
      fixedFee: 0,
      description:
        'Full refund (100%) if cancelled at least 24 hours prior to game time.',
    },
    {
      minHoursBefore: 12,
      refundPercentage: 75,
      fixedFee: 0,
      description:
        'Partial refund (75%) if cancelled between 12 and 24 hours prior to game time.',
    },
    {
      minHoursBefore: 4,
      refundPercentage: 50,
      fixedFee: 100,
      description:
        'Partial refund (50% minus ₹100 fee) if cancelled between 4 and 12 hours prior to game time.',
    },
    {
      minHoursBefore: 0,
      refundPercentage: 0,
      fixedFee: 0,
      description:
        'No refund (0%) if cancelled less than 4 hours prior to game time.',
    },
  ],
  description:
    'Standard Platform Cancellation Policy with tiered cancellation windows.',
};
