export type IntervalHandle = ReturnType<typeof setInterval>;
export type TimeoutHandle = ReturnType<typeof setTimeout>;

interface TimerSlot<T> {
  current: T | null;
}

interface TimerList<T> {
  current: T[];
}

export function clearIntervalSlot(slot: TimerSlot<IntervalHandle>) {
  if (slot.current !== null) {
    clearInterval(slot.current);
    slot.current = null;
  }
}

export function clearIntervalSlots(...slots: TimerSlot<IntervalHandle>[]) {
  for (const slot of slots) {
    clearIntervalSlot(slot);
  }
}

export function replaceInterval(slot: TimerSlot<IntervalHandle>, fn: () => void, ms: number) {
  clearIntervalSlot(slot);
  slot.current = setInterval(fn, ms);
  return slot.current;
}

export function clearTimeoutList(list: TimerList<TimeoutHandle>) {
  for (const timeout of list.current) {
    clearTimeout(timeout);
  }
  list.current = [];
}

export function scheduleTimeout(list: TimerList<TimeoutHandle>, fn: () => void, ms: number) {
  const timeout = setTimeout(fn, ms);
  list.current.push(timeout);
  return timeout;
}
