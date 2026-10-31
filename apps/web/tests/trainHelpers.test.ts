import { describe, expect, it } from 'vitest';

import type { Exercise } from '../src/api/train';
import { searchExercises } from '../src/features/train/exerciseSearch';
import { formatElapsed, formatPrevious, lineItemText } from '../src/features/train/format';
import { countPlates, platesPerSide } from '../src/features/train/plates';
import { formatNumber, translate } from '../src/i18n/translate';

const EXERCISES: Exercise[] = [
  {
    id: 'squat',
    name: 'Back squat',
    group: 'Legs',
    type: 'w',
    barbell: true,
    ppl: 'legs',
    aliases_es: ['sentadilla trasera', 'sentadilla'],
  },
  {
    id: 'latpull',
    name: 'Lat pulldown',
    group: 'Back',
    type: 'w',
    barbell: false,
    ppl: 'pull',
    aliases_es: ['jalón al pecho'],
  },
  {
    id: 'pullup',
    name: 'Pull-up',
    group: 'Back',
    type: 'bw',
    barbell: false,
    ppl: 'pull',
    aliases_es: ['dominadas'],
  },
  {
    id: 'run',
    name: 'Treadmill run',
    group: 'Cardio',
    type: 'c',
    barbell: false,
    ppl: null,
    aliases_es: ['cinta'],
  },
];

function ex(index: number): Exercise {
  const exercise = EXERCISES[index];
  if (!exercise) throw new Error(`no exercise ${index}`);
  return exercise;
}

const en = { t: translate.bind(null, 'en'), n: (v: number) => formatNumber('en', v) };
const es = { t: translate.bind(null, 'es'), n: (v: number) => formatNumber('es', v) };

describe('platesPerSide', () => {
  it('loads the heaviest plates first', () => {
    expect(platesPerSide(140)).toEqual({ perSide: [25, 25, 10], leftoverKg: 0 });
    expect(platesPerSide(102.5)).toEqual({ perSide: [25, 15, 1.25], leftoverKg: 0 });
  });

  it('is just the bar at or under 20 kg', () => {
    expect(platesPerSide(20).perSide).toEqual([]);
    expect(platesPerSide(10).perSide).toEqual([]);
  });

  it('reports what standard plates cannot make', () => {
    expect(platesPerSide(21)).toEqual({ perSide: [], leftoverKg: 1 });
  });

  it('counts plates', () => {
    expect(countPlates([25, 25, 10])).toEqual([
      [25, 2],
      [10, 1],
    ]);
  });
});

describe('searchExercises', () => {
  it('matches English names and Spanish aliases, ignoring accents and case', () => {
    expect(searchExercises(EXERCISES, 'sentadilla').map((e) => e.id)).toEqual(['squat']);
    expect(searchExercises(EXERCISES, 'JALON').map((e) => e.id)).toEqual(['latpull']);
    expect(searchExercises(EXERCISES, 'pull').map((e) => e.id)).toEqual(['latpull', 'pullup']);
    expect(searchExercises(EXERCISES, '')).toHaveLength(4);
    expect(searchExercises(EXERCISES, 'zzz')).toEqual([]);
  });
});

describe('formatElapsed', () => {
  it('formats minutes and hours', () => {
    expect(formatElapsed(65_000)).toBe('1:05');
    expect(formatElapsed(3_723_000)).toBe('1:02:03');
    expect(formatElapsed(-5)).toBe('0:00');
  });
});

describe('formatPrevious', () => {
  const set = (
    load_kg: number | null,
    reps: number | null,
    minutes: number | null = null,
    km: number | null = null,
  ) => ({
    load_kg,
    reps,
    minutes,
    km,
    done: true,
  });
  it('shows load × reps, bodyweight and cardio', () => {
    expect(formatPrevious(ex(0), set(102.5, 5), es.n)).toBe('102,5 × 5');
    expect(formatPrevious(ex(2), set(0, 10), en.n)).toBe('BW × 10');
    expect(formatPrevious(ex(2), set(10, 6), en.n)).toBe('+10 × 6');
    expect(formatPrevious(ex(3), set(null, null, 25, 4.2), en.n)).toBe('25 min, 4.2 km');
    expect(formatPrevious(ex(0), undefined, en.n)).toBe('–');
  });
});

describe('lineItemText', () => {
  it('renders API line items in each language', () => {
    const item = (key: string, vars: Record<string, string | number> = {}) => ({
      key,
      vars,
      points: 0,
    });
    expect(lineItemText(item('ln_show'), EXERCISES, en.t, en.n)).toBe('Showed up');
    expect(lineItemText(item('ln_sets', { n: 1 }), EXERCISES, en.t, en.n)).toBe('1 completed set');
    expect(lineItemText(item('ln_sets', { n: 12 }), EXERCISES, es.t, es.n)).toBe(
      '12 sets completados',
    );
    expect(lineItemText(item('ln_vol', { kg: 3880 }), EXERCISES, es.t, es.n)).toBe(
      '3.880 kg movidos',
    );
    expect(lineItemText(item('ln_leg_event', { n: 4 }), EXERCISES, es.t, es.n)).toBe(
      'Leg day x2: 4 sets de piernas',
    );
    expect(
      lineItemText(
        item('ln_pr', { exercise_id: 'squat', load_kg: 137.5, reps: 5 }),
        EXERCISES,
        es.t,
        es.n,
      ),
    ).toBe('Nuevo PR: Back squat 137,5 kg × 5');
    expect(
      lineItemText(
        item('ln_pr', { exercise_id: 'pullup', load_kg: 10, reps: 6 }),
        EXERCISES,
        en.t,
        en.n,
      ),
    ).toBe('New PR: Pull-up +10 kg × 6');
    expect(lineItemText(item('ln_goal', { n: 3 }), EXERCISES, en.t, en.n)).toBe(
      'Weekly goal hit: 3 of 3',
    );
    expect(lineItemText(item('ln_streak', { weeks: 1 }), EXERCISES, en.t, en.n)).toBe(
      'Goal streak: 1 week',
    );
    expect(lineItemText(item('ln_better', { pct: 8 }), EXERCISES, en.t, en.n)).toBe(
      'Better than last time (+8%)',
    );
    expect(lineItemText(item('ln_future_thing'), EXERCISES, en.t, en.n)).toBe('Bonus');
  });
});
