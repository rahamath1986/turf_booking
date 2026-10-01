const badgeStyles: Record<string, string> = {
  // Booking statuses
  CONFIRMED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  COMPLETED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  CANCELLED: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  PENDING_PAYMENT: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  NO_SHOW: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  HOLD: 'bg-purple-500/10 text-purple-400 border-purple-500/20',

  // Boolean states
  true: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  false: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  inactive: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  verified: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  unverified: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  rejected: 'bg-rose-500/10 text-rose-400 border-rose-500/20',

  // Payment statuses
  SUCCESS: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  FAILED: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  PROCESSING: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  REFUNDED: 'bg-purple-500/10 text-purple-400 border-purple-500/20',

  // Default
  default: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

interface BadgeProps {
  label: string;
  className?: string;
}

export default function Badge({ label, className = '' }: BadgeProps) {
  const style = badgeStyles[label] || badgeStyles.default;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${style} ${className}`}>
      {label.replace(/_/g, ' ')}
    </span>
  );
}
