import { useState } from 'react';
import { useNavigate } from 'react-router';

import {
  useActiveWorkout,
  useCatalog,
  useDiscardWorkout,
  useFinishWorkout,
  useStartWorkout,
  useWeek,
  type FinishResult,
} from '../../api/train';
import { ErrorBlock, LoadingBlock } from '../../components/QueryState';
import { useI18n } from '../../i18n/context';
import { FinishSheet } from './FinishSheet';
import { PastDaySheet } from './PastDaySheet';
import { RoutinePicker } from './RoutinePicker';
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
  const [result, setResult] = useState<FinishResult | null>(null);
  const [pastDay, setPastDay] = useState<string | null>(null);
  const [pickingDay, setPickingDay] = useState(false);

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
      },
      { onSuccess: () => setPastDay(null) },
    );

  const workout = active.data;
  const handleFinish = async (flush: () => Promise<void>) => {
    if (!workout) return;
    try {
      await flush();
    } catch {
      return; // the logger already shows "Couldn't save. Retrying."
    }
    finish.mutate(workout.id, { onSuccess: setResult });
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
          onFinish={(flush) => void handleFinish(flush)}
          onDiscard={() => discard.mutate(workout.id)}
        />
      ) : (
        <RoutinePicker
          catalog={catalog.data}
          week={week.data}
          starting={start.isPending}
          error={start.error}
          pastDay={pastDay}
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
