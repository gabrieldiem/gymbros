import {
  LayoutDashboard,
  LogOut,
  Mail,
  MessageSquare,
  Plus,
  ScrollText,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router';

import {
  useAdminActions,
  useAdminCrews,
  useAdminFeedback,
  useAdminMembers,
  useAdminOverview,
  useSetFeedbackHandled,
} from '../../api/admin';
import { useLogout } from '../../api/auth';
import { useMe } from '../../api/me';
import { Avatar } from '../../components/Avatar';
import { Brand } from '../../components/Brand';
import { Button, ButtonLink } from '../../components/Button';
import { CountUp } from '../../components/CountUp';
import { cx } from '../../components/cx';
import { LanguageToggle } from '../../components/LanguageToggle';
import { QueryState } from '../../components/QueryState';
import { TextField } from '../../components/TextField';
import { useI18n } from '../../i18n/context';
import type { MessageKey } from '../../i18n/en';
import { timeAgo } from '../../i18n/timeAgo';
import { useProfileLanguage } from '../../i18n/useLanguage';
import styles from './Admin.module.css';
import { CrewPanel, MemberPanel } from './AdminPanels';
import { EmailTab } from './EmailTab';

const NEW = 'new';

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

/** The list on one side and what's open on the other, like a password manager. */
function Split({
  title,
  isOpen,
  list,
  empty,
  children,
}: {
  title: string;
  isOpen: boolean;
  list: ReactNode;
  empty: string;
  children: ReactNode;
}) {
  return (
    <div className={cx(styles.split, isOpen && styles.splitOpen)}>
      <div className={styles.listPane}>
        <h1>{title}</h1>
        {list}
      </div>
      <div className={styles.detailPane}>
        {isOpen ? children : <p className={styles.pick}>{empty}</p>}
      </div>
    </div>
  );
}

function Crews() {
  const { t, n } = useI18n();
  const query = useAdminCrews();
  const { itemId } = useParams();
  const navigate = useNavigate();
  const close = () => void navigate('/admin/crews');
  const open = query.data?.find((crew) => crew.id === itemId);
  const creating = itemId === NEW;
  return (
    <Split
      title={t('admin_crews')}
      isOpen={creating || Boolean(open)}
      empty={t('admin_pick_crew')}
      list={
        <>
          <div className={styles.toolbar}>
            <ButtonLink icon={Plus} to={`/admin/crews/${NEW}`}>
              {t('admin_new_crew')}
            </ButtonLink>
          </div>
          <QueryState query={query} failed="admin_failed">
            {(crews) =>
              crews.length === 0 ? (
                <p className={styles.muted}>{t('admin_no_crews')}</p>
              ) : (
                <ul className={styles.rows}>
                  {crews.map((crew) => (
                    <li key={crew.id}>
                      <Link
                        className={styles.row}
                        to={`/admin/crews/${crew.id}`}
                        aria-current={crew.id === itemId ? 'true' : undefined}
                      >
                        <span className={styles.rowMain}>
                          <b>{crew.name}</b>
                          <small>{crew.time_zone}</small>
                        </span>
                        <span className={styles.rowInvite}>
                          <code className={styles.code}>{crew.invite_code}</code>
                          {crew.invite_status !== 'active' && (
                            <em className={styles.dead}>
                              {t(`admin_invite_status_${crew.invite_status}`)}
                            </em>
                          )}
                        </span>
                        <span className={styles.rowNumbers}>
                          <span>
                            {crew.members === 1
                              ? t('admin_members_1')
                              : t('admin_members_n', { n: crew.members })}
                          </span>
                          <b>{t('pts_n', { n: n(crew.points) })}</b>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )
            }
          </QueryState>
        </>
      }
    >
      <CrewPanel key={itemId} crew={creating ? null : (open ?? null)} onClose={close} />
    </Split>
  );
}

function Members() {
  const { t, n, lang } = useI18n();
  const [search, setSearch] = useState('');
  const query = useAdminMembers(search.trim());
  const { itemId } = useParams();
  const navigate = useNavigate();
  const open = query.data?.find((member) => member.id === itemId);
  return (
    <Split
      title={t('admin_users')}
      isOpen={Boolean(open)}
      empty={t('admin_pick_member')}
      list={
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
                <ul className={styles.rows}>
                  {members.map((member) => (
                    <li key={member.id}>
                      <Link
                        className={styles.row}
                        to={`/admin/accounts/${member.id}`}
                        aria-current={member.id === itemId ? 'true' : undefined}
                      >
                        <Avatar
                          initials={member.initials}
                          color={member.color}
                          image={member.avatar_url}
                          size={40}
                        />
                        <span className={styles.rowMain}>
                          <b>
                            {member.display_name}
                            {member.is_admin && <em className={styles.tag}>{t('admin_tag')}</em>}
                          </b>
                          <small>{member.email}</small>
                          <small>{member.crew_name ?? t('admin_no_crew_short')}</small>
                        </span>
                        <span className={styles.rowNumbers}>
                          <small>
                            {member.last_workout_at
                              ? timeAgo(lang, member.last_workout_at)
                              : t('admin_never')}
                          </small>
                          <b>{t('pts_n', { n: n(member.points) })}</b>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )
            }
          </QueryState>
        </>
      }
    >
      {open && (
        <MemberPanel key={open.id} member={open} onClose={() => void navigate('/admin/accounts')} />
      )}
    </Split>
  );
}

function Feedback() {
  const { t, lang } = useI18n();
  const query = useAdminFeedback();
  const setHandled = useSetFeedbackHandled();
  return (
    <QueryState query={query} failed="admin_failed">
      {(items) =>
        items.length === 0 ? (
          <p className={styles.muted}>{t('admin_feedback_empty')}</p>
        ) : (
          <ul className={`${styles.feedback} stagger`}>
            {items.map((item) => (
              <li key={item.id} className={item.handled ? styles.handled : undefined}>
                <b>{t(`feedback_${item.kind}`)}</b>
                <p>{item.body}</p>
                <small>
                  {item.display_name}, <a href={`mailto:${item.email}`}>{item.email}</a>,{' '}
                  {timeAgo(lang, item.created_at)}
                </small>
                <Button
                  variant="quiet"
                  disabled={setHandled.isPending}
                  onClick={() => setHandled.mutate({ id: item.id, handled: !item.handled })}
                >
                  {t(item.handled ? 'admin_feedback_reopen' : 'admin_feedback_done')}
                </Button>
              </li>
            ))}
          </ul>
        )
      }
    </QueryState>
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

const SECTIONS: { path: string; label: MessageKey; icon: LucideIcon }[] = [
  { path: '/admin', label: 'admin_view_overview', icon: LayoutDashboard },
  { path: '/admin/crews', label: 'admin_crews', icon: Users },
  { path: '/admin/accounts', label: 'admin_users', icon: UserCog },
  { path: '/admin/email', label: 'admin_view_email', icon: Mail },
  { path: '/admin/feedback', label: 'admin_view_feedback', icon: MessageSquare },
  { path: '/admin/log', label: 'admin_view_log', icon: ScrollText },
];

/** A section with nothing beside it. */
function Single({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.single}>
      <h1>{title}</h1>
      {children}
    </div>
  );
}

function Section() {
  const { t } = useI18n();
  const { section } = useParams();
  if (section === 'crews') return <Crews />;
  if (section === 'accounts') return <Members />;
  if (section === 'email') {
    return (
      <Single title={t('admin_view_email')}>
        <EmailTab />
      </Single>
    );
  }
  if (section === 'feedback') {
    return (
      <Single title={t('admin_view_feedback')}>
        <Feedback />
      </Single>
    );
  }
  if (section === 'log') {
    return (
      <Single title={t('admin_view_log')}>
        <Log />
      </Single>
    );
  }
  return (
    <Single title={t('admin_view_overview')}>
      <Overview />
    </Single>
  );
}

/** The backoffice: for accounts in ADMIN_EMAILS only. The API enforces it, the gate just routes. */
export function AdminPage() {
  const { t } = useI18n();
  useProfileLanguage();
  const me = useMe().data;
  const logout = useLogout();
  const { section } = useParams();
  return (
    <div className={styles.shell}>
      <aside className={styles.rail}>
        <div className={styles.railBrand}>
          <Brand />
          <small>{t('admin_title')}</small>
        </div>
        <nav className={styles.nav} aria-label={t('admin_title')}>
          {SECTIONS.map(({ path, label, icon: Icon }) => (
            <NavLink key={path} to={path} end={path === '/admin'} className={cx(styles.navItem)}>
              <Icon size={18} aria-hidden="true" />
              {t(label)}
            </NavLink>
          ))}
        </nav>
        <div className={styles.railFoot}>
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
              <Button
                icon={LogOut}
                variant="quiet"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
              >
                {t('log_out')}
              </Button>
            </>
          )}
        </div>
      </aside>
      <main key={section ?? 'overview'} className={cx(styles.main, 'page-enter')}>
        <Section />
      </main>
    </div>
  );
}
