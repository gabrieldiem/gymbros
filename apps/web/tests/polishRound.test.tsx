import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PostedExercise, WorkoutPostVars } from '../src/api/social';
import type { CrewColor } from '../src/api/types';
import { createQueryClient } from '../src/api/queryClient';
import { ColumnHandle } from '../src/features/admin/ColumnHandle';
import { useColumnWidth } from '../src/features/admin/useColumnWidth';
import { editChanges } from '../src/features/crew/editChanges';
import { EditedTag } from '../src/features/crew/EditedTag';
import { Providers } from '../src/Providers';
import { makeMe, mockApi, renderApp } from './renderApp';
import { CATALOG } from './trainFixtures';

const bench = (load: number): PostedExercise => ({
  exercise_id: 'bench',
  sets: [{ load_kg: load, reps: 5, minutes: null, km: null }],
});
const post = (overrides: Partial<WorkoutPostVars>) =>
  ({
    name: 'Evening',
    gym: 'Home',
    points: 140,
    exercises: [bench(70)],
    edited: true,
    original: { name: 'Evening', gym: 'Home', points: 140, exercises: [bench(70)] },
    ...overrides,
  }) as unknown as WorkoutPostVars;

describe('What an edit changed', () => {
  it('finds nothing when it’s back to how it was', () => {
    expect(editChanges(post({}))).toEqual([]);
  });

  it('lists the name, gym, sets and points that differ', () => {
    const changes = editChanges(
      post({ original: { name: 'Morning', gym: null, points: 100, exercises: [bench(60)] } }),
    );
    expect(changes.map((c) => c.kind)).toEqual(['name', 'gym', 'sets', 'points']);
  });

  it('tells added exercises from removed ones, custom ones by their name', () => {
    const sled = { exercise_id: 'custom', custom_name: 'Sled', sets: [] };
    const tyre = { exercise_id: 'custom', custom_name: 'Tyre', sets: [] };
    const changes = editChanges(
      post({
        exercises: [tyre],
        original: { name: 'Evening', gym: 'Home', points: 140, exercises: [sled] },
      }),
    );
    expect(changes).toEqual([
      { kind: 'added', exercise: tyre },
      { kind: 'removed', exercise: sled },
    ]);
  });

  it('has nothing to say on a post edited before this was kept', () => {
    expect(
      editChanges(post({ original: undefined } as unknown as Partial<WorkoutPostVars>)),
    ).toEqual([]);
  });
});

describe('The Edited tag', () => {
  const show = (vars: WorkoutPostVars) => {
    mockApi({ 'GET /api/me': [200, makeMe()] });
    render(
      <Providers client={createQueryClient()}>
        <EditedTag post={vars} exercises={CATALOG.exercises} />
      </Providers>,
    );
  };

  it('says exactly what changed, opening on a tap for phones', async () => {
    show(post({ original: { name: 'Morning', gym: 'Home', points: 100, exercises: [bench(60)] } }));
    const tag = await screen.findByRole('button', { name: 'Edited' });
    expect(tag).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(tag);
    expect(tag).toHaveAttribute('aria-expanded', 'true');
    const info = within(screen.getByRole('group', { name: 'What changed' }));
    expect(info.getByText('Name: Morning → Evening')).toBeInTheDocument();
    expect(info.getByText(/^Bench press: .+ → .+/)).toBeInTheDocument();
    expect(info.getByText('Points: 100 → 140')).toBeInTheDocument();
  });

  it('says so when there’s nothing to compare with', async () => {
    show(post({ original: undefined } as unknown as Partial<WorkoutPostVars>));
    expect(await screen.findByText('Changed after it was posted.')).toBeInTheDocument();
  });
});

describe('The color picker', () => {
  const open = async (color: string) => {
    const fetchMock = mockApi({
      'GET /api/me': [200, makeMe({ color: color as CrewColor })],
      'PATCH /api/me': (body) => [200, makeMe(body as object)],
    });
    renderApp('/me');
    await userEvent.click(await screen.findByRole('button', { name: /^Your profile/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Profile and settings' }));
    return { fetchMock, sheet: within(await screen.findByRole('dialog')) };
  };

  it('marks a custom color as custom, and says which', async () => {
    const { sheet } = await open('#3e8bff');
    const custom = await sheet.findByRole('button', { name: 'Pick any color' });
    expect(custom).toHaveAttribute('aria-pressed', 'true');
    expect(sheet.getByText('Your own color: #3e8bff')).toBeVisible();
  });

  it('doesn’t when a palette color is chosen', async () => {
    const { sheet } = await open('volt');
    const custom = await sheet.findByRole('button', { name: 'Pick any color' });
    expect(custom).toHaveAttribute('aria-pressed', 'false');
    expect(sheet.queryByText(/^Your own color/)).toBeNull();
  });

  it('saves a typed color only when you say so', async () => {
    const { fetchMock, sheet } = await open('volt');
    await userEvent.click(await sheet.findByRole('button', { name: 'Pick any color' }));
    const code = sheet.getByLabelText('Color code');
    fireEvent.change(code, { target: { value: '#123456' } });
    const patches = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH');
    expect(patches()).toHaveLength(0);
    await userEvent.click(sheet.getByRole('button', { name: 'Use this color' }));
    expect(JSON.parse(String(patches()[0]?.[1]?.body))).toEqual({ color: '#123456' });
  });
});

describe('Resizing a backoffice column', () => {
  afterEach(() => localStorage.clear());
  const LIMITS = { name: 'test-column', initial: 200, min: 100, max: 300 };

  function Column() {
    const [width, setWidth] = useColumnWidth(LIMITS);
    return <ColumnHandle label="Width" width={width} limits={LIMITS} onChange={setWidth} />;
  }
  const handle = () => screen.getByRole('separator', { name: 'Width' });

  it('moves with the arrow keys, within its limits, and remembers', () => {
    const { unmount } = render(<Column />);
    expect(handle()).toHaveAttribute('aria-valuenow', '200');
    fireEvent.keyDown(handle(), { key: 'ArrowRight' });
    expect(handle()).toHaveAttribute('aria-valuenow', '216');
    fireEvent.keyDown(handle(), { key: 'End' });
    fireEvent.keyDown(handle(), { key: 'ArrowRight' });
    expect(handle()).toHaveAttribute('aria-valuenow', '300');
    unmount();
    render(<Column />);
    expect(handle()).toHaveAttribute('aria-valuenow', '300');
  });

  it('follows a drag, and a double click puts it back', () => {
    render(<Column />);
    const element = handle();
    element.setPointerCapture = vi.fn();
    act(() => {
      fireEvent.pointerDown(element, { clientX: 500, pointerId: 1 });
      fireEvent.pointerMove(element, { clientX: 540, pointerId: 1 });
      fireEvent.pointerUp(element, { pointerId: 1 });
    });
    expect(handle()).toHaveAttribute('aria-valuenow', '240');
    fireEvent.pointerMove(element, { clientX: 900, pointerId: 1 });
    expect(handle()).toHaveAttribute('aria-valuenow', '240');
    fireEvent.doubleClick(element);
    expect(handle()).toHaveAttribute('aria-valuenow', '200');
  });
});
