import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GymLink } from '../src/components/GymLink';
import { googleMapsUrl } from '../src/components/mapLinks';
import { makeMe, mockApi, renderApp } from './renderApp';

// Leaflet needs a real browser (the e2e tests have one). Here a tap is a button.
vi.mock('../src/features/gyms/GymMap', () => ({
  default: ({
    position,
    onPick,
  }: {
    position: { lat: number; lon: number } | null;
    onPick?: (p: { lat: number; lon: number }) => void;
  }) => (
    <div>
      <p data-testid="pin">{position ? `${position.lat},${position.lon}` : 'no pin'}</p>
      <button type="button" onClick={() => onPick?.({ lat: 1.5, lon: 2.5 })}>
        tap the map
      </button>
    </div>
  ),
}));

const TOLON = { name: 'Tolón', address: 'Santa Fe 3200', lat: -34.58, lon: -58.41 };
const OTHER = { name: 'Other', address: 'Elsewhere', lat: 10, lon: 20 };

async function openPicker(routes: Parameters<typeof mockApi>[0] = {}) {
  const fetchMock = mockApi({
    'GET /api/me': [200, makeMe()],
    'GET /api/me/gyms': [200, []],
    'POST /api/me/gyms': (body) => [201, { id: 'g9', is_default: true, ...(body as object) }],
    ...routes,
  });
  renderApp('/me');
  await userEvent.click(await screen.findByRole('button', { name: /^Your profile/ }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Profile and settings' }));
  const settings = within(await screen.findByRole('dialog', { name: 'Profile and settings' }));
  await userEvent.click(await settings.findByRole('button', { name: 'Add a gym' }));
  const sheet = within(await screen.findByRole('dialog', { name: 'Add a gym' }));
  await sheet.findByTestId('pin');
  return { fetchMock, sheet };
}

const savedBody = (fetchMock: ReturnType<typeof mockApi>) => {
  const call = fetchMock.mock.calls.find(
    ([url, init]) => url === '/api/me/gyms' && init?.method === 'POST',
  );
  return JSON.parse(String(call?.[1]?.body)) as unknown;
};

describe('Adding a gym', () => {
  afterEach(() => vi.restoreAllMocks());

  it('saves with only a name: the map is optional', async () => {
    const { fetchMock, sheet } = await openPicker();
    expect(sheet.getByRole('button', { name: 'Save gym' })).toBeDisabled();
    await userEvent.type(sheet.getByLabelText('Name'), 'Home');
    await userEvent.click(sheet.getByRole('button', { name: 'Save gym' }));
    await waitFor(() => expect(savedBody(fetchMock)).toEqual({ name: 'Home', location: null }));
  });

  it('places the pin where you tap', async () => {
    const { fetchMock, sheet } = await openPicker();
    await userEvent.click(sheet.getByRole('button', { name: 'tap the map' }));
    expect(sheet.getByTestId('pin')).toHaveTextContent('1.5,2.5');
    await userEvent.type(sheet.getByLabelText('Name'), 'Basement gym');
    await userEvent.click(sheet.getByRole('button', { name: 'Save gym' }));
    await waitFor(() =>
      expect(savedBody(fetchMock)).toEqual({
        name: 'Basement gym',
        location: { lat: 1.5, lon: 2.5, address: null },
      }),
    );
  });

  it('searches when asked, shows the matches and takes the one you choose', async () => {
    const { fetchMock, sheet } = await openPicker({
      'GET /api/places?q=Santa%20Fe': [200, [TOLON, OTHER]],
    });
    await userEvent.type(
      sheet.getByLabelText('Search for a place, or paste a Google Maps link'),
      'Santa Fe',
    );
    // The free search service asks not to be called on every key.
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/places'))).toBe(false);
    await userEvent.click(sheet.getByRole('button', { name: 'Search' }));
    await userEvent.click(await sheet.findByRole('button', { name: /Tolón/ }));
    expect(sheet.getByTestId('pin')).toHaveTextContent('-34.58,-58.41');
    expect(sheet.getByLabelText('Name')).toHaveValue('Tolón');
    expect(sheet.queryByRole('button', { name: /Other/ })).toBeNull();
    expect(sheet.getByRole('link', { name: 'Open in Google Maps' })).toHaveAttribute(
      'href',
      googleMapsUrl(-34.58, -58.41),
    );
  });

  it('takes a pasted Google Maps link straight to its place', async () => {
    const url = 'https://maps.app.goo.gl/abc';
    const { fetchMock, sheet } = await openPicker({
      'POST /api/places/from-link': [200, { ...TOLON, name: 'Smart Fit', address: null }],
    });
    fireEvent.change(sheet.getByLabelText('Search for a place, or paste a Google Maps link'), {
      target: { value: url },
    });
    await userEvent.click(sheet.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(sheet.getByTestId('pin')).toHaveTextContent('-34.58,-58.41'));
    expect(sheet.getByLabelText('Name')).toHaveValue('Smart Fit');
    const call = fetchMock.mock.calls.find(([u]) => u === '/api/places/from-link');
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ url });
  });

  it('keeps a name you already typed when you find the place', async () => {
    const { sheet } = await openPicker({ 'GET /api/places?q=x': [200, [TOLON]] });
    await userEvent.type(sheet.getByLabelText('Name'), 'My gym');
    await userEvent.type(
      sheet.getByLabelText('Search for a place, or paste a Google Maps link'),
      'x',
    );
    await userEvent.click(sheet.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(sheet.getByTestId('pin')).toHaveTextContent('-34.58'));
    expect(sheet.getByLabelText('Name')).toHaveValue('My gym');
  });

  it('says when nothing was found, and the map still works', async () => {
    const { sheet } = await openPicker({ 'GET /api/places?q=x': [200, []] });
    await userEvent.type(
      sheet.getByLabelText('Search for a place, or paste a Google Maps link'),
      'x',
    );
    await userEvent.click(sheet.getByRole('button', { name: 'Search' }));
    expect(await sheet.findByText(/^Nothing found/)).toBeVisible();
  });

  it('says what to do when search is down or a link says nothing', async () => {
    const { sheet } = await openPicker({
      'GET /api/places?q=x': [503, { detail: { code: 'places_unavailable' } }],
    });
    await userEvent.type(
      sheet.getByLabelText('Search for a place, or paste a Google Maps link'),
      'x',
    );
    await userEvent.click(sheet.getByRole('button', { name: 'Search' }));
    expect(await sheet.findByText(/^Search isn’t available right now/)).toBeVisible();
  });

  it('uses your location only when you ask', async () => {
    const getCurrentPosition = vi.fn((ok: PositionCallback) =>
      ok({ coords: { latitude: 3, longitude: 4 } } as GeolocationPosition),
    );
    vi.stubGlobal('navigator', Object.assign(navigator, { geolocation: { getCurrentPosition } }));
    const { sheet } = await openPicker();
    expect(getCurrentPosition).not.toHaveBeenCalled();
    await userEvent.click(sheet.getByRole('button', { name: 'Use my location' }));
    expect(sheet.getByTestId('pin')).toHaveTextContent('3,4');
    vi.unstubAllGlobals();
  });

  it('can take the pin off again', async () => {
    const { sheet } = await openPicker();
    await userEvent.click(sheet.getByRole('button', { name: 'tap the map' }));
    await userEvent.click(sheet.getByRole('button', { name: 'Remove from the map' }));
    expect(sheet.getByTestId('pin')).toHaveTextContent('no pin');
  });

  it('closes only itself with Esc, and the page stays inert for settings', async () => {
    const root = document.createElement('div');
    root.id = 'root';
    document.body.append(root);
    await openPicker();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add a gym' })).toBeNull());
    expect(screen.getByRole('dialog', { name: 'Profile and settings' })).toBeVisible();
    expect(root).toHaveAttribute('inert');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(root).not.toHaveAttribute('inert'));
    root.remove();
  });
});

describe('Changing a gym', () => {
  it('starts from where it is, and sends what changed', async () => {
    const gym = {
      id: 'g1',
      name: 'Smart Fit',
      is_default: true,
      location: { lat: -34.5, lon: -58.4, address: 'Palermo' },
    };
    const fetchMock = mockApi({
      'GET /api/me': [200, makeMe()],
      'GET /api/me/gyms': [200, [gym]],
      'PATCH /api/me/gyms/g1': [200, gym],
    });
    renderApp('/me');
    await userEvent.click(await screen.findByRole('button', { name: /^Your profile/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Profile and settings' }));
    const settings = within(await screen.findByRole('dialog', { name: 'Profile and settings' }));
    await userEvent.click(await settings.findByRole('button', { name: 'Change Smart Fit' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Change gym' }));
    expect(await sheet.findByTestId('pin')).toHaveTextContent('-34.5,-58.4');
    expect(sheet.getByText('Palermo')).toBeVisible();
    await userEvent.click(sheet.getByRole('button', { name: 'tap the map' }));
    await userEvent.click(sheet.getByRole('button', { name: 'Save gym' }));
    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([u]) => u === '/api/me/gyms/g1');
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({
        name: 'Smart Fit',
        location: { lat: 1.5, lon: 2.5, address: null },
      });
    });
  });
});

describe('A gym’s name elsewhere', () => {
  it('opens in Google Maps when it has a place, with no API key in sight', () => {
    render(<GymLink label="At Smart Fit" lat={-34.5} lon={-58.4} />);
    const link = screen.getByRole('link', { name: 'At Smart Fit' });
    expect(link.getAttribute('href')).toBe(
      'https://www.google.com/maps/search/?api=1&query=-34.5,-58.4',
    );
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('is only a name without one', () => {
    render(<GymLink label="At Home" lat={null} lon={null} />);
    expect(screen.getByText('At Home')).toBeVisible();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
