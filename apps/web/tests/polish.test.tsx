import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { timeLeftParts } from '../src/components/timeLeft';
import { TimedEventChip } from '../src/components/TimedEvent';
import { useKeyboardFit } from '../src/components/useKeyboardFit';
import { RestTimer } from '../src/features/train/RestTimer';
import { I18nProvider } from '../src/i18n/I18nProvider';
import { makeMe, mockApi, renderApp } from './renderApp';
import { useRef } from 'react';

function matchMediaIs(matches: boolean) {
  vi.stubGlobal('matchMedia', () => ({
    matches,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

describe('Server status', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sits in the side rail on desktop', async () => {
    matchMediaIs(true);
    mockApi({ 'GET /api/me': [200, makeMe()], 'GET /api/health': [200, { database: 'up' }] });
    renderApp('/me');
    const status = await screen.findByText('Server online');
    expect(status.closest('nav')).not.toBeNull();
    expect(status.closest('footer')).toBeNull();
    expect(screen.getAllByRole('status').filter((s) => s.dataset.state)).toHaveLength(1);
  });

  it('sits under the page on mobile, where there is no rail', async () => {
    matchMediaIs(false);
    mockApi({ 'GET /api/me': [200, makeMe()], 'GET /api/health': [200, { database: 'up' }] });
    renderApp('/me');
    const status = await screen.findByText('Server online');
    expect(status.closest('footer')).not.toBeNull();
  });
});

describe('Rest timer', () => {
  const props = { defaultSeconds: 90, onStart: vi.fn(), onAdjust: vi.fn(), onSkip: vi.fn() };
  const rest = { endsAt: 1, totalMs: 90_000 };
  afterEach(() => vi.useRealTimers());

  it('offers to start when nothing is running', () => {
    render(
      <I18nProvider>
        <RestTimer {...props} rest={null} leftMs={0} />
      </I18nProvider>,
    );
    expect(screen.getByRole('button', { name: 'Rest 1:30' })).toBeVisible();
    expect(screen.queryByTestId('rest-flash')).toBeNull();
  });

  it('flashes the screen at zero, then the flash goes away', () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <I18nProvider>
        <RestTimer {...props} rest={rest} leftMs={1000} />
      </I18nProvider>,
    );
    expect(screen.queryByTestId('rest-flash')).toBeNull();
    rerender(
      <I18nProvider>
        <RestTimer {...props} rest={rest} leftMs={0} />
      </I18nProvider>,
    );
    expect(screen.getByTestId('rest-flash')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Rest is over. Next set.');
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.queryByTestId('rest-flash')).toBeNull();
  });
});

describe('Bottom sheets and the keyboard', () => {
  afterEach(() => vi.unstubAllGlobals());

  function Panel() {
    const ref = useRef<HTMLDivElement>(null);
    useKeyboardFit(ref);
    return <div ref={ref} data-testid="panel" />;
  }

  it('sit above the keyboard the visual viewport reports', () => {
    const listeners: (() => void)[] = [];
    const viewport = {
      height: window.innerHeight,
      offsetTop: 0,
      addEventListener: (_: string, listener: () => void) => listeners.push(listener),
      removeEventListener: () => undefined,
    };
    vi.stubGlobal('visualViewport', viewport);
    render(<Panel />);
    const panel = screen.getByTestId('panel');
    expect(panel.style.getPropertyValue('--keyboard')).toBe('0px');
    viewport.height = window.innerHeight - 300;
    act(() => listeners.forEach((listener) => listener()));
    expect(panel.style.getPropertyValue('--keyboard')).toBe('300px');
    expect(panel.style.getPropertyValue('--viewport-h')).toBe(`${window.innerHeight - 300}px`);
  });
});

describe('Timed event', () => {
  it('counts down in the two biggest units', () => {
    expect(timeLeftParts(3 * 86_400_000 + 4 * 3_600_000)).toEqual({ d: 3, h: 4, m: 0 });
    expect(timeLeftParts(5 * 3_600_000 + 12 * 60_000)).toEqual({ d: 0, h: 5, m: 12 });
    expect(timeLeftParts(30_000)).toEqual({ d: 0, h: 0, m: 1 });
  });

  it('says how long is left', () => {
    render(
      <I18nProvider>
        <TimedEventChip endsAt={new Date(Date.now() + 2 * 86_400_000 + 3_660_000).toISOString()} />
      </I18nProvider>,
    );
    expect(screen.getByText('Leg day x2')).toBeVisible();
    expect(screen.getByText(/^2 d 1 h left$/)).toBeVisible();
  });

  it('drops the countdown when the event has ended', () => {
    render(
      <I18nProvider>
        <TimedEventChip endsAt={new Date(Date.now() - 1000).toISOString()} />
      </I18nProvider>,
    );
    expect(screen.queryByText(/left$/)).toBeNull();
  });
});
