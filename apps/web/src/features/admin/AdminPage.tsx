import { useState } from 'react';
import { Link } from 'react-router';

import {
  useAdminActions,
  useAdminCrews,
  useAdminMembers,
  useAdminOverview,
  type AdminCrew,
  type AdminMember,
} from '../../api/admin';
import { useLogout } from '../../api/auth';
import { useMe } from '../../api/me';
import { Avatar } from '../../components/Avatar';
import { Brand } from '../../components/Brand';
import { Button } from '../../components/Button';
import { CountUp } from '../../components/CountUp';
import { LanguageToggle } from '../../components/LanguageToggle';
import { QueryState } from '../../components/QueryState';
import { Segmented } from '../../components/Segmented';
import { TextField } from '../../components/TextField';
import { useI18n } from '../../i18n/context';
import type { MessageKey } from '../../i18n/en';
import { timeAgo } from '../../i18n/timeAgo';
import { useProfileLanguage } from '../../i18n/useLanguage';
import styles from './Admin.module.css';
import { CrewSheet, MemberSheet } from './AdminSheets';

type View = 'overview' | 'crews' | 'members' | 'log';

function Overview() {
  const { t, n } = useI18n();
  const query = useAdminOverview();
  return (
    <QueryState query={query} failed="admin_failed">
      {(data) => {
        const stats: [MessageKey, number][] = [
          ['admin_users', data.users],
          ['admin_crews', data.crews],
          ['admin_no_crew', data.users_without_crew],
          ['admin_workouts', data.workouts],
          ['admin_recent_workouts', data.recent_workouts],
          ['admin_recent_active', data.recent_active_users],
          ['admin_recent_points', data.recent_points],
        ];
        return (
          <dl className={`${styles.stats} stagger`}>
            {stats.map(([label, value]) => (
              <div key={label}>
                <dd>
                  <CountUp value={value} format={n} />
                </dd>
                <dt>{t(label)}</dt>
              </div>
            ))}
          </dl>
        );
      }}
    </QueryState>
  );
}

function Crews() {
  const { t, n } = useI18n();
  const query = useAdminCrews();
  const [editing, setEditing] = useState<AdminCrew | 'new' | null>(null);
  return (
    <>
      <div className={styles.toolbar}>
        <Button onClick={() => setEditing('new')}>{t('admin_new_crew')}</Button>
      </div>
      <QueryState query={query} failed="admin_failed">
        {(crews) =>
          crews.length === 0 ? (
            <p className={styles.muted}>{t('admin_no_crews')}</p>
          ) : (
            <ul className={`${styles.rows} stagger`}>
              {crews.map((crew) => (
                <li key={crew.id}>
                  <button type="button" className={styles.row} onClick={() => setEditing(crew)}>
                    <span className={styles.rowMain}>
                      <b>{crew.name}</b>
                      <small>{crew.time_zone}</small>
                    </span>
                    <code className={styles.code}>{crew.invite_code}</code>
                    <span className={styles.rowNumbers}>
                      <span>{t('admin_members_n', { n: crew.members })}</span>
                      <b>{t('pts_n', { n: n(crew.points) })}</b>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )
        }
      </QueryState>
      {editing && (
        <CrewSheet crew={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

function Members() {
  const { t, n, lang } = useI18n();
  const [search, setSearch] = useState('');
  const query = useAdminMembers(search.trim());
  const [open, setOpen] = useState<AdminMember | null>(null);
  return (
    <>
      <div className={styles.toolbar}>
        <TextField
          label={t('admin_search')}
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <QueryState query={query} failed="admin_failed">
        {(members) =>
          members.length === 0 ? (
            <p className={styles.muted}>{t('admin_no_members')}</p>
          ) : (
            <ul className={`${styles.rows} stagger`}>
              {members.map((member) => (
                <li key={member.id}>
                  <button type="button" className={styles.row} onClick={() => setOpen(member)}>
                    <Avatar initials={member.initials} color={member.color} size={40} />
                    <span className={styles.rowMain}>
                      <b>
                        {member.display_name}
                        {member.is_admin && <em className={styles.tag}>{t('admin_tag')}</em>}
                      </b>
                      <small>{member.email}</small>
                    </span>
                    <span className={styles.rowCrew}>
                      {member.crew_name ?? t('admin_no_crew_short')}
                    </span>
                    <span className={styles.rowNumbers}>
                      <small>
                        {member.last_workout_at
                          ? timeAgo(lang, member.last_workout_at)
                          : t('admin_never')}
                      </small>
                      <b>{t('pts_n', { n: n(member.points) })}</b>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )
        }
      </QueryState>
      {open && <MemberSheet member={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function Log() {
  const { t, lang } = useI18n();
  const query = useAdminActions();
  return (
    <QueryState query={query} failed="admin_failed">
      {(actions) =>
        actions.length === 0 ? (
          <p className={styles.muted}>{t('admin_log_empty')}</p>
        ) : (
          <ul className={`${styles.log} stagger`}>
            {actions.map((action) => (
              <li key={action.id}>
                <b>{t(`admin_action_${action.action}` as MessageKey)}</b>
                <span>
                  {[action.details.name, action.details.points, action.details.reason]
                    .filter((value) => value !== undefined)
                    .join(', ')}
                </span>
                <small>
                  {action.admin_email}, {timeAgo(lang, action.created_at)}
                </small>
              </li>
            ))}
          </ul>
        )
      }
    </QueryState>
  );
}

/** The backoffice: for accounts in ADMIN_EMAILS only. The API enforces it, the gate just routes. */
export function AdminPage() {
  const { t } = useI18n();
  useProfileLanguage();
  const me = useMe().data;
  const logout = useLogout();
  const [view, setView] = useState<View>('overview');
  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <Brand />
        <div className={styles.topActions}>
          <LanguageToggle />
          {me?.crew ? (
            <Link to="/" className={styles.back}>
              {t('admin_back')}
            </Link>
          ) : (
            <>
              <Link to="/join" className={styles.back}>
                {t('admin_join_crew')}
              </Link>
              <Button variant="quiet" onClick={() => logout.mutate()} disabled={logout.isPending}>
                {t('log_out')}
              </Button>
            </>
          )}
        </div>
      </header>
      <main>
        <h1>{t('admin_title')}</h1>
        <p className={styles.muted}>{t('admin_sub')}</p>
        <div className={styles.views}>
          <Segmented
            label={t('admin_title')}
            value={view}
            onChange={setView}
            options={[
              { value: 'overview', label: t('admin_view_overview') },
              { value: 'crews', label: t('admin_crews') },
              { value: 'members', label: t('admin_users') },
              { value: 'log', label: t('admin_view_log') },
            ]}
          />
        </div>
        <div key={view} className="page-enter">
          {view === 'overview' && <Overview />}
          {view === 'crews' && <Crews />}
          {view === 'members' && <Members />}
          {view === 'log' && <Log />}
        </div>
      </main>
    </div>
  );
}
