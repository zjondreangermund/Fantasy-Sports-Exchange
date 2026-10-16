// Every event remains individually available in Inbox. Device alerts are
// grouped, with a durable five-minute quiet window after a successful push.
export const PUSH_QUIET_SECONDS = 300;

export function groupPushDeliveries(deliveries: any[]): any[][] {
  const groups = new Map<number, any[]>();
  for (const delivery of deliveries) {
    const id = Number(delivery.subscriptionId);
    const group = groups.get(id) || [];
    group.push(delivery);
    groups.set(id, group);
  }
  return [...groups.values()].map(group => group.sort((a, b) => Number(a.id) - Number(b.id)));
}

export function pushBatchMessage(batch: any[]) {
  if (!batch.length) throw new Error('Empty push batch');
  if (batch.length === 1) return batch[0];
  const titles = [...new Set(batch.map(item => String(item.title || 'Fantasy Arena update')))];
  return {
    ...batch[0],
    title: `${batch.length} Fantasy Arena updates`,
    message: `${titles.slice(0, 3).join(' • ')}${titles.length > 3 ? ' • …' : ''}. Open Inbox to see every update.`,
    dedupeKey: 'digest',
  };
}
