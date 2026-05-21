export enum TicketStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  DONE = 'DONE',
}

export const TICKET_STATUS_ORDER: Record<TicketStatus, number> = {
  [TicketStatus.TODO]: 0,
  [TicketStatus.IN_PROGRESS]: 1,
  [TicketStatus.IN_REVIEW]: 2,
  [TicketStatus.DONE]: 3,
};

export function isForwardTransition(
  from: TicketStatus,
  to: TicketStatus,
): boolean {
  return TICKET_STATUS_ORDER[to] > TICKET_STATUS_ORDER[from];
}
