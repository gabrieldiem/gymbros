import Link from '@tiptap/extension-link';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Check,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Underline,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { useI18n } from '../../i18n/context';
import type { MessageKey } from '../../i18n/en';
import styles from './EmailComposer.module.css';

type Props = {
  value: string;
  onChange: (html: string) => void;
  label: string;
};

/** Writing with buttons instead of tags. Only admins download this. */
export default function RichTextEditor({ value, onChange, label }: Props) {
  const { t } = useI18n();
  const [linking, setLinking] = useState(false);
  const [url, setUrl] = useState('');
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] }, link: false }), Link],
    content: value,
    immediatelyRender: true,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': label,
        class: styles.writing ?? '',
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.getHTML()),
  });
  // A toolbar that shows what the cursor is on, without redrawing on every other change.
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      underline: current.isActive('underline'),
      h2: current.isActive('heading', { level: 2 }),
      h3: current.isActive('heading', { level: 3 }),
      bullets: current.isActive('bulletList'),
      numbers: current.isActive('orderedList'),
      quote: current.isActive('blockquote'),
      link: current.isActive('link'),
    }),
  });

  const tools: { label: MessageKey; icon: LucideIcon; on?: boolean; run: () => void }[] = [
    {
      label: 'admin_rt_bold',
      icon: Bold,
      on: state.bold,
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: 'admin_rt_italic',
      icon: Italic,
      on: state.italic,
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: 'admin_rt_underline',
      icon: Underline,
      on: state.underline,
      run: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      label: 'admin_rt_h2',
      icon: Heading2,
      on: state.h2,
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: 'admin_rt_h3',
      icon: Heading3,
      on: state.h3,
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      label: 'admin_rt_bullets',
      icon: List,
      on: state.bullets,
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: 'admin_rt_numbers',
      icon: ListOrdered,
      on: state.numbers,
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: 'admin_rt_quote',
      icon: Quote,
      on: state.quote,
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      label: 'admin_rt_link',
      icon: LinkIcon,
      on: state.link || linking,
      run: () => {
        setUrl((editor.getAttributes('link').href as string | undefined) ?? '');
        setLinking((open) => !open);
      },
    },
    {
      label: 'admin_rt_divider',
      icon: Minus,
      run: () => editor.chain().focus().setHorizontalRule().run(),
    },
    { label: 'admin_rt_undo', icon: Undo2, run: () => editor.chain().focus().undo().run() },
    { label: 'admin_rt_redo', icon: Redo2, run: () => editor.chain().focus().redo().run() },
  ];

  const applyLink = (event: FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const href = url.trim();
    const chain = editor.chain().focus().extendMarkRange('link');
    if (href) chain.setLink({ href }).run();
    else chain.unsetLink().run();
    setLinking(false);
  };

  return (
    <div className={styles.editor}>
      <div className={styles.tools} role="toolbar" aria-label={label}>
        {tools.map((tool) => (
          <button
            key={tool.label}
            type="button"
            className={styles.tool}
            aria-label={t(tool.label)}
            title={t(tool.label)}
            aria-pressed={tool.on === undefined ? undefined : tool.on}
            onClick={tool.run}
          >
            <tool.icon size={18} aria-hidden="true" />
          </button>
        ))}
      </div>
      {linking && (
        <div className={styles.linkRow}>
          <TextField
            label={t('admin_rt_link_url')}
            type="url"
            value={url}
            autoFocus
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyLink(e);
            }}
          />
          <Button type="button" variant="ghost" icon={Check} onClick={applyLink}>
            {t('admin_rt_link_apply')}
          </Button>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
