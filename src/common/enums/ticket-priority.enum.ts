export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export const PRIORITY_LADDER: TicketPriority[] = [
  TicketPriority.LOW,
  TicketPriority.MEDIUM,
  TicketPriority.HIGH,
  TicketPriority.CRITICAL,
];

export function nextPriority(current: TicketPriority): TicketPriority | null {
  const idx = PRIORITY_LADDER.indexOf(current);
  if (idx < 0 || idx === PRIORITY_LADDER.length - 1) return null;
  return PRIORITY_LADDER[idx + 1];
}
