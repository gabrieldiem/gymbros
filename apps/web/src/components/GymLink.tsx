import { MapPin } from 'lucide-react';

import { googleMapsUrl } from './mapLinks';

type Props = { label: string; lat?: number | null | undefined; lon?: number | null | undefined };

/** A gym's name. With a place on the map, it opens there in the person's own maps app. */
export function GymLink({ label, lat, lon }: Props) {
  const content = (
    <>
      <MapPin size={13} aria-hidden="true" />
      {label}
    </>
  );
  if (lat === null || lat === undefined || lon === null || lon === undefined) {
    return <span>{content}</span>;
  }
  return (
    <a href={googleMapsUrl(lat, lon)} target="_blank" rel="noopener noreferrer">
      {content}
    </a>
  );
}
