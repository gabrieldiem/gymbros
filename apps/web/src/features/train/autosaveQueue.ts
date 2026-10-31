export type SaveStatus = 'idle' | 'saving' | 'error';

const FLUSH_ATTEMPTS = 3;

type Options<T, R> = {
  save: (value: T) => Promise<R>;
  onSaved: (result: R) => void;
  onStatus: (status: SaveStatus) => void;
  debounceMs: number;
  retryMs: number;
};

/**
 * Debounced, serialized saving of the latest value: at most one request in flight, the newest
 * value always wins, failures retry. Plain TypeScript so it can be tested without React.
 */
export class AutosaveQueue<T, R> {
  private latest: T | undefined;
  private dirty = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private inFlight: Promise<void> | null = null;
  private readonly options: Options<T, R>;

  constructor(options: Options<T, R>) {
    this.options = options;
  }

  /** Remember the newest value and save it after a quiet period. */
  push(value: T): void {
    this.latest = value;
    this.dirty = true;
    this.schedule(this.options.debounceMs);
  }

  /** Save anything pending now. Rejects if it still can't be saved after a few attempts. */
  async flush(): Promise<void> {
    this.cancelTimer();
    for (let attempt = 0; attempt < FLUSH_ATTEMPTS && (this.inFlight || this.dirty); attempt++) {
      await (this.inFlight ?? this.send());
    }
    if (this.dirty) throw new Error('Could not save the latest changes');
  }

  dispose(): void {
    this.cancelTimer();
  }

  private schedule(delayMs: number): void {
    this.cancelTimer();
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (!this.inFlight) void this.send();
    }, delayMs);
  }

  private cancelTimer(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  private send(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    this.dirty = false;
    this.options.onStatus('saving');
    const request = this.options
      .save(this.latest as T)
      .then((result) => {
        this.options.onSaved(result);
        this.options.onStatus('idle');
      })
      .catch(() => {
        this.dirty = true;
        this.options.onStatus('error');
        this.schedule(this.options.retryMs);
      })
      .finally(() => {
        this.inFlight = null;
        if (this.dirty && !this.timer) void this.send();
      });
    this.inFlight = request;
    return request;
  }
}
