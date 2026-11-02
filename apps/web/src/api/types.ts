/** API contract types. Mirror apps/api/src/models. */

export type Language = 'en' | 'es';
/** A name from the crew palette, or any color as #rrggbb. */
export type CrewColor = 'volt' | 'red' | 'cyan' | 'pink' | 'violet' | `#${string}`;

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
  avatar_url?: string | null;
  color: CrewColor;
  language: Language;
  rest_seconds: number;
  email_updates?: boolean;
  crew: Crew | null;
  is_admin?: boolean;
};

export type Invite = { crew_name: string; members: number };

export type AuthOptions = { google: boolean; dev_login: boolean };

export type DevLoginBody = { email: string; language: Language };

export type UpdateMeBody = Partial<
  Pick<Me, 'display_name' | 'initials' | 'color' | 'language' | 'rest_seconds' | 'email_updates'>
>;
