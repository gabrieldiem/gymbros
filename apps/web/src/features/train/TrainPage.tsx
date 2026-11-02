import { useState } from 'react';
import { useNavigate } from 'react-router';

import {
  useActiveWorkout,
  useCatalog,
  useDiscardWorkout,
  useFinishWorkout,
  useStartWorkout,
  useWeek,
  useWorkoutTemplates,
  type FinishResult,
} from '../../api/train';
import { useGyms } from '../../api/gyms';
import { ErrorBlock, LoadingBlock } from '../../components/QueryState';
import { useToast } from '../../components/toast';
import { useI18n } from '../../i18n/context';
import { FinishSheet } from './FinishSheet';
import { PastDaySheet } from './PastDaySheet';
import { RoutinePicker } from './RoutinePicker';
import type { Draft } from './useWorkoutDraft';
import { WorkoutLogger } from './WorkoutLogger';

export function TrainPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const catalog = useCatalog();
  const active = useActiveWorkout();
  const week = useWeek();
  const start = useStartWorkout();
  const finish = useFinishWorkout();
  const discard = useDiscardWorkout();
  const showToast = useToast();
  useWorkoutTemplates(); // Kept on the phone, so a routine can start with no signal.
  const [result, setResult] = useState<FinishResult | null>(null);
  const [pastDay, setPastDay] = useState<string | null>(null);
  const [pickingDay, setPickingDay] = useState(false);
  // Undefined until you choose: the default gym, which the server knows.
  const [chosenGym, setChosenGym] = useState<string | null | undefined>(undefined);
  const defaultGym = useGyms().data?.find((gym) => gym.is_default)?.name ?? null;

  if ((catalog.isError && !catalog.data) || (active.isError && active.data === undefined)) {
    return (
      <ErrorBlock
        message="train_failed"
        onRetry={() => void Promise.all([catalog.refetch(), active.refetch()])}
      />
    );
  }
  if (!catalog.data || active.data === undefined) {
    return <LoadingBlock />;
  }

  const handleStart = (routineId: string | null) =>
    start.mutate(
      {
        ...(routineId ? { routine_id: routineId } : { routine_id: null, name: t('wk_default') }),
        ...(pastDay ? { performed_on: pastDay } : {}),
        ...(chosenGym !== undefined ? { gym: chosenGym } : {}),
      },
      {
        onSuccess: () => {
          setPastDay(null);
          setChosenGym(undefined);
        },
      },
    );

  const workout = active.data;
  const handleFinish = (flush: () => Promise<void>, draft: Draft) => {
    if (!workout) return;
    finish.mutate(
      { workout, draft, flush },
      {
        onSuccess: (outcome) => {
          if (outcome.queued) showToast(t('offline_queued'));
          else setResult(outcome.result);
        },
      },
    );
  };

  return (
    <>
      {workout ? (
        <WorkoutLogger
          key={workout.id}
          workout={workout}
          catalog={catalog.data}
          week={week.data}
          finishing={finish.isPending}
          finishError={finish.error}
          discarding={discard.isPending}
          onFinish={handleFinish}
          onDiscard={() => discard.mutate(workout.id)}
        />
      ) : (
        <RoutinePicker
          catalog={catalog.data}
          week={week.data}
          starting={start.isPending}
          error={start.error}
          pastDay={pastDay}
          gym={chosenGym === undefined ? defaultGym : chosenGym}
          onGym={setChosenGym}
          onStart={handleStart}
          onPickPastDay={() => setPickingDay(true)}
          onClearPastDay={() => setPastDay(null)}
        />
      )}
      {pickingDay && week.data && (
        <PastDaySheet
          days={week.data.past_days}
          onPick={(day) => {
            setPastDay(day);
            setPickingDay(false);
          }}
          onClose={() => setPickingDay(false)}
        />
      )}
      {result && (
        <FinishSheet
          result={result}
          exercises={catalog.data.exercises}
          onClimb={() => navigate('/climb', { state: { climb: result.climb } })}
          onClose={() => setResult(null)}
        />
      )}
    </>
  );
}
