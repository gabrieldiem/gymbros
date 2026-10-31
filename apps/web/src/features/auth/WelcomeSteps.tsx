import { useI18n } from '../../i18n/context';
import styles from './WelcomeSteps.module.css';

const STEPS = [
  ['w1_title', 'w1_body'],
  ['w2_title', 'w2_body'],
  ['w3_title', 'w3_body'],
] as const;

/** The three rules of the game, from the prototype's welcome sheet. */
export function WelcomeSteps() {
  const { t } = useI18n();
  return (
    <ol className={styles.steps}>
      {STEPS.map(([title, body]) => (
        <li key={title}>
          <span>
            <b>{t(title)}</b> {t(body)}
          </span>
        </li>
      ))}
    </ol>
  );
}
