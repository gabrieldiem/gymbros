import { useState } from 'react';

import { useMe } from '../../api/me';
import { useFeed } from '../../api/social';
import { useCatalog } from '../../api/train';
import { Button } from '../../components/Button';
import { Segmented } from '../../components/Segmented';
import { useI18n } from '../../i18n/context';
import styles from './CrewPage.module.css';
import { EventRow } from './EventRow';
import feedStyles from './Feed.module.css';
import { FeedCard } from './FeedCard';
import { HallOfFame } from './HallOfFame';
import { NudgePrompt } from './NudgePrompt';

type View = 'feed' | 'hof';

function Feed() {
  const { t } = useI18n();
  const feed = useFeed();
  const exercises = useCatalog().data?.exercises ?? [];
  if (feed.isError && !feed.data) {
    return (
      <div className={feedStyles.empty} role="alert">
        <p>{t('feed_failed')}</p>
        <Button variant="ghost" onClick={() => void feed.refetch()}>
          {t('retry')}
        </Button>
      </div>
    );
  }
  if (!feed.data) return <p role="status">{t('loading')}</p>;
  const pages = feed.data.pages;
  const items = pages.flatMap((p) => p.items);
  const inactive = pages[0]?.inactive ?? [];
  if (!items.length && !inactive.length)
    return <p className={feedStyles.empty}>{t('feed_empty')}</p>;
  return (
    <>
      <ul className={feedStyles.feed}>
        {inactive.map((i) => (
          <NudgePrompt key={i.member.user_id} member={i.member} days={i.days} />
        ))}
        {items.map((item) =>
          item.kind === 'workout' ? (
            <FeedCard key={item.id} item={item} exercises={exercises} />
          ) : (
            <EventRow key={item.id} item={item} />
          ),
        )}
      </ul>
      {feed.hasNextPage && (
        <div className={feedStyles.more}>
          <Button
            variant="ghost"
            onClick={() => void feed.fetchNextPage()}
            disabled={feed.isFetchingNextPage}
          >
            {t('load_more')}
          </Button>
        </div>
      )}
    </>
  );
}

export function CrewPage() {
  const { t } = useI18n();
  const [view, setView] = useState<View>('feed');
  const crewName = useMe().data?.crew?.name ?? '';
  const exercises = useCatalog().data?.exercises ?? [];
  return (
    <section aria-labelledby="page-title">
      <div className={styles.head}>
        <div>
          <h1 id="page-title">{view === 'feed' ? t('crew_title') : t('tab_hof')}</h1>
          <p className={styles.sub}>
            {view === 'feed' ? t('crew_sub', { crew: crewName }) : t('hof_sub')}
          </p>
        </div>
        <Segmented
          label={t('crew_view')}
          value={view}
          onChange={setView}
          options={[
            { value: 'feed', label: t('tab_feed') },
            { value: 'hof', label: t('tab_hof') },
          ]}
        />
      </div>
      {view === 'feed' ? <Feed /> : <HallOfFame exercises={exercises} />}
    </section>
  );
}
