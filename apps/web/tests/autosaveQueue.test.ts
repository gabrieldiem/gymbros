import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AutosaveQueue, type SaveStatus } from '../src/features/train/autosaveQueue';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(save: (value: number) => Promise<string>) {
  const saved: string[] = [];
  const statuses: SaveStatus[] = [];
  const queue = new AutosaveQueue<number, string>({
    save,
    onSaved: (r) => saved.push(r),
    onStatus: (s) => statuses.push(s),
    debounceMs: 500,
    retryMs: 3000,
  });
  return { queue, saved, statuses };
}

describe('AutosaveQueue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('collapses quick edits into one save of the latest value', async () => {
    const save = vi.fn(async (v: number) => `saved ${v}`);
    const { queue, saved } = setup(save);
    queue.push(1);
    queue.push(2);
    queue.push(3);
    await vi.advanceTimersByTimeAsync(500);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(3);
    expect(saved).toEqual(['saved 3']);
  });

  it('never runs two saves at once and sends the newest value next', async () => {
    const first = deferred<string>();
    const save = vi.fn((v: number) => (v === 1 ? first.promise : Promise.resolve(`saved ${v}`)));
    const { queue } = setup(save);
    queue.push(1);
    await vi.advanceTimersByTimeAsync(500);
    queue.push(2);
    await vi.advanceTimersByTimeAsync(500);
    expect(save).toHaveBeenCalledTimes(1);
    first.resolve('saved 1');
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith(2);
  });

  it('retries after a failure and reports the status', async () => {
    const save = vi
      .fn<(v: number) => Promise<string>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue('ok');
    const { queue, statuses } = setup(save);
    queue.push(1);
    await vi.advanceTimersByTimeAsync(500);
    expect(statuses).toEqual(['saving', 'error']);
    await vi.advanceTimersByTimeAsync(3000);
    expect(save).toHaveBeenCalledTimes(2);
    expect(statuses).toEqual(['saving', 'error', 'saving', 'idle']);
  });

  it('flush saves pending edits immediately', async () => {
    const save = vi.fn(async (v: number) => `saved ${v}`);
    const { queue } = setup(save);
    queue.push(7);
    await queue.flush();
    expect(save).toHaveBeenCalledWith(7);
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('flush rejects when the edits still cannot be saved', async () => {
    const save = vi.fn(async () => {
      throw new Error('offline');
    });
    const { queue } = setup(save);
    queue.push(1);
    await expect(queue.flush()).rejects.toThrow('Could not save');
    expect(save).toHaveBeenCalledTimes(3);
    queue.dispose();
  });
});
