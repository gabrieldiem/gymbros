/** API contract types. Mirror apps/api/src/models. */

export type Language = 'en' | 'es';
export type CrewColor = 'volt' | 'red' | 'cyan' | 'pink' | 'violet';

export type Crew = {
  id: string;
  name: string;
  time_zone: string;
  invite_code: string;
};

export type Me = {
  id: string;
  email: string;
  display_name: string;
  initials: string;
  color: CrewColor;
  language: Language;
  rest_seconds: number;
  crew: Crew | null;
};

export type RegisterBody = {
  email: string;
  password: string;
  display_name: string;
  language: Language;
  invite_code?: string;
};

export type LoginBody = { email: string; password: string };

export type UpdateMeBody = Partial<
  Pick<Me, 'display_name' | 'initials' | 'color' | 'language' | 'rest_seconds'>
>;
