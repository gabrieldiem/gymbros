import { useState, type ReactNode } from 'react';
import { useLocation } from 'react-router';

import { TABS } from './tabs';

type Direction = 'none' | 'forward' | 'back';

const tabIndex = (path: string) => TABS.findIndex((tab) => path.startsWith(tab.to));

function directionBetween(from: string, to: string): Direction {
  const a = tabIndex(from);
  const b = tabIndex(to);
  if (a < 0 || b < 0 || a === b) return 'none';
  return b > a ? 'forward' : 'back';
}

/** Replays the page's entrance on each route, sliding in from the tab you came from. */
export function AnimatedPage({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [route, setRoute] = useState<{ path: string; direction: Direction }>({
    path: pathname,
    direction: 'none',
  });
  // React's pattern for state derived from a change: re-renders at once with the new direction.
  if (route.path !== pathname) {
    setRoute({ path: pathname, direction: directionBetween(route.path, pathname) });
  }
  return (
    <div key={pathname} className="page-enter" data-direction={route.direction}>
      {children}
    </div>
  );
}
