import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { emojiName, toNames } from '../src/api/emojiNames';
import { createQueryClient } from '../src/api/queryClient';
import { toggledReactions } from '../src/api/social';
import { ReactionBar } from '../src/features/crew/ReactionBar';
import { Thread } from '../src/features/crew/Thread';
import { Providers } from '../src/Providers';
import { makeMe, mockApi } from './renderApp';

// The real picker needs a real browser (the e2e tests have one).
vi.mock('../src/features/crew/EmojiSheet', () => ({
  default: ({ onPick }: { onPick: (emoji: string) => void }) => (
    <button type="button" onClick={() => onPick('🇦🇷')}>
      pick a flag
    </button>
  ),
}));

const show = (node: React.ReactNode) => {
  const fetchMock = mockApi({ 'GET /api/me': [200, makeMe()] });
  render(<Providers client={createQueryClient()}>{node}</Providers>);
  return fetchMock;
};

describe('Toggling an emoji', () => {
  it('adds a new one, and takes yours off', () => {
    const none = { emoji: [] };
    const one = toggledReactions(none, '😂');
    expect(one.emoji).toEqual([{ emoji: '😂', count: 1, mine: true }]);
    expect(toggledReactions(one, '😂').emoji).toEqual([]);
  });

  it('keeps others’ when you take yours off', () => {
    const two = { emoji: [{ emoji: '😂', count: 2, mine: true }] };
    expect(toggledReactions(two, '😂').emoji).toEqual([{ emoji: '😂', count: 1, mine: false }]);
  });

  it('joins others on an emoji already there', () => {
    const theirs = { emoji: [{ emoji: '😂', count: 1, mine: false }] };
    expect(toggledReactions(theirs, '😂').emoji).toEqual([{ emoji: '😂', count: 2, mine: true }]);
  });
});

describe('The reaction bar', () => {
  it('shows what’s been used, the usual two even at zero, and marks yours', async () => {
    show(
      <ReactionBar
        reactions={[
          { emoji: '🔥', count: 2, mine: true },
          { emoji: '😂', count: 1, mine: false },
        ]}
        always={['👊', '🔥']}
        onToggle={vi.fn()}
      />,
    );
    expect(await screen.findByRole('button', { name: 'Fist bump, 0' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Fire, 2' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '😂, 1' })).toBeVisible();
  });

  it('adds any emoji from the picker', async () => {
    const onToggle = vi.fn();
    show(<ReactionBar reactions={[]} onToggle={onToggle} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add a reaction' }));
    await userEvent.click(await screen.findByRole('button', { name: 'pick a flag' }));
    expect(onToggle).toHaveBeenCalledWith('🇦🇷');
  });
});

describe('An emoji’s name', () => {
  const DATA = [
    {
      emoji: '😂',
      label: 'face with tears of joy',
      skins: [],
    },
    {
      emoji: '❤️',
      label: 'red heart',
    },
    {
      emoji: '👋',
      label: 'waving hand',
      skins: [{ emoji: '👋🏽', label: 'waving hand: medium skin tone' }],
    },
  ];

  it('is found with or without the invisible selector, and for skin tones', () => {
    const names = toNames(DATA, 'en');
    expect(emojiName(names, '😂')).toBe('Face with tears of joy');
    expect(emojiName(names, '❤️')).toBe('Red heart');
    expect(emojiName(names, '❤')).toBe('Red heart');
    expect(emojiName(names, '👋🏽')).toBe('Waving hand: medium skin tone');
    expect(emojiName(names, '🛸')).toBeUndefined();
    expect(emojiName(undefined, '😂')).toBeUndefined();
  });

  const bar = () => {
    const fetchMock = mockApi({
      'GET /api/me': [200, makeMe()],
      'GET /emoji/en/data.json': [200, DATA],
    });
    render(
      <Providers client={createQueryClient()}>
        <ReactionBar
          reactions={[
            { emoji: '😂', count: 1, mine: false },
            { emoji: '🛸', count: 1, mine: false },
          ]}
          always={['👊']}
          onToggle={vi.fn()}
        />
      </Providers>,
    );
    return fetchMock;
  };
  const asked = (fetchMock: ReturnType<typeof mockApi>) =>
    fetchMock.mock.calls.some(([url]) => String(url).includes('/emoji/'));

  it('shows on hover, loading the names only then', async () => {
    const fetchMock = bar();
    const pill = await screen.findByRole('button', { name: '😂, 1' });
    expect(asked(fetchMock)).toBe(false);
    expect(screen.queryByText('Face with tears of joy')).toBeNull();
    fireEvent.pointerEnter(pill, { pointerType: 'mouse' });
    expect(await screen.findByText('Face with tears of joy')).toBeInTheDocument();
    expect(pill).toHaveAccessibleDescription('Face with tears of joy');
    expect(asked(fetchMock)).toBe(true);
  });

  it('doesn’t make a phone download every name for a tap', async () => {
    const fetchMock = bar();
    const pill = await screen.findByRole('button', { name: '😂, 1' });
    fireEvent.pointerEnter(pill, { pointerType: 'touch' });
    await act(() => new Promise((done) => setTimeout(done, 20)));
    expect(asked(fetchMock)).toBe(false);
  });

  it('already knows the name of the usual ones, in our own words', async () => {
    bar();
    expect(await screen.findByText('Fist bump')).toBeInTheDocument();
  });

  it('shows nothing, not a blank tip, for an emoji it can’t name', async () => {
    bar();
    const pill = await screen.findByRole('button', { name: '🛸, 1' });
    fireEvent.pointerEnter(pill, { pointerType: 'mouse' });
    await screen.findByText('Face with tears of joy');
    expect(pill).not.toHaveAccessibleDescription();
  });
});

describe('A thread', () => {
  const COMMENT = {
    id: 'c1',
    author: { user_id: 'u', display_name: 'Maxo', initials: 'MX', avatar_url: null, color: 'red' },
    body: 'Look',
    quick_key: null,
    created_at: new Date().toISOString(),
    photo_url: '/api/feed/comments/c1/photo?v=1',
    reactions: { emoji: [{ emoji: '😂', count: 1, mine: false }] },
  };

  it('shows the picture in a comment, and its reactions', async () => {
    show(<Thread itemId="i1" comments={[COMMENT as never]} />);
    expect(await screen.findByRole('img', { name: /Maxo/ })).toHaveAttribute(
      'src',
      COMMENT.photo_url,
    );
    expect(screen.getByRole('button', { name: '😂, 1' })).toBeVisible();
  });

  it('sends the emoji on a comment to that comment', async () => {
    const fetchMock = show(<Thread itemId="i1" comments={[COMMENT as never]} />);
    await userEvent.click(await screen.findByRole('button', { name: '😂, 1' }));
    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => String(url).includes('/comments/c1/'));
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({ kind: '😂' });
    });
  });

  it('says so when a file can’t be opened as a picture', async () => {
    show(<Thread itemId="i1" comments={[]} />);
    await screen.findByRole('button', { name: 'Answer with a picture' });
    const file = new File(['nope'], 'x.png', { type: 'image/png' });
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [file] },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(/can’t be opened/);
  });

  it('offers answering with a picture', async () => {
    show(<Thread itemId="i1" comments={[]} />);
    expect(await screen.findByRole('button', { name: 'Answer with a picture' })).toBeEnabled();
  });
});
