/** English copy. The source of the key set: `es.ts` must provide exactly these keys. */
export const en = {
  brand: 'GYMBROS',
  tagline: 'Better than yesterday.',
  nav_main: 'Main',
  nav_climb: 'ATUS Climb',
  nav_crew: 'Crew',
  nav_train: 'Train',
  nav_quests: 'Quests',
  nav_you: 'You',
  language: 'Language',
  climb_title: 'ATUS Climb',
  climb_sub: 'Every rep moves you up the mountain. No finish line, only the next PR.',
  crew_title: 'Crew',
  crew_sub: 'What the crew has been up to.',
  train_title: 'Start a workout',
  train_sub: 'Pick a routine or start empty. Every set moves you up.',
  quests_title: 'Quests',
  quests_sub: 'Fresh quests every Monday. Finish them for bonus points.',
  me_title: 'You',
  me_sub: 'Your stats, your PRs and how far you have come.',
  coming_soon: 'This screen is on its way.',
  api_checking: 'Connecting to the server',
  api_up: 'Server online',
  api_down: 'Server offline. Retrying.',
  not_found_title: 'Off the trail',
  not_found_body: 'This page does not exist.',
  not_found_cta: 'Back to ATUS Climb',
};

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
