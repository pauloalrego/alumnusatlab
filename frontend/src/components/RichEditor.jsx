import React, { useState, useRef, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import Mention from '@tiptap/extension-mention';
import Placeholder from '@tiptap/extension-placeholder';
import { slugify } from '../mentionUtils.jsx';

export default function RichEditor({
  variant = 'simple',
  researchers = [],
  value = '',
  onChange,
  onSubmit,
  placeholder = '',
  uploadImage,
  className = '',
}) {
  const [suggestion, setSuggestion] = useState(null);
  const suggestionRef = useRef(null);
  const researchersRef = useRef(researchers);
  useEffect(() => { researchersRef.current = researchers; }, [researchers]);

  const editorRef    = useRef(null);
  const contentRef   = useRef(null);
  const [editorHeight, setEditorHeight] = useState(null); // null = usa min-h do CSS
  const onSubmitRef  = useRef(onSubmit);
  useEffect(() => { onSubmitRef.current = onSubmit; }, [onSubmit]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Underline,
      ...(variant === 'full' ? [Image.configure({ inline: true, allowBase64: false })] : []),
      Placeholder.configure({ placeholder }),
      Mention.configure({
        HTMLAttributes: { class: 'mention' },
        renderLabel: ({ node }) => `@${node.attrs.label ?? node.attrs.id}`,
        suggestion: {
          items: ({ query }) =>
            researchersRef.current
              .filter(r =>
                r.nome.toLowerCase().includes(query.toLowerCase()) ||
                slugify(r.nome).includes(query.toLowerCase()),
              )
              .slice(0, 6),
          render: () => ({
            onStart(props) {
              suggestionRef.current = { ...props, activeIndex: 0 };
              setSuggestion({ items: props.items, activeIndex: 0, clientRect: props.clientRect });
            },
            onUpdate(props) {
              if (!suggestionRef.current) return;
              suggestionRef.current = { ...suggestionRef.current, ...props, activeIndex: 0 };
              setSuggestion({ items: props.items, activeIndex: 0, clientRect: props.clientRect });
            },
            onKeyDown({ event }) {
              const s = suggestionRef.current;
              if (!s || !s.items.length) return false;
              if (event.key === 'Escape') {
                suggestionRef.current = null;
                setSuggestion(null);
                return true;
              }
              if (event.key === 'ArrowDown') {
                const next = (s.activeIndex + 1) % s.items.length;
                s.activeIndex = next;
                setSuggestion(prev => prev ? { ...prev, activeIndex: next } : null);
                return true;
              }
              if (event.key === 'ArrowUp') {
                const prev2 = (s.activeIndex - 1 + s.items.length) % s.items.length;
                s.activeIndex = prev2;
                setSuggestion(prev => prev ? { ...prev, activeIndex: prev2 } : null);
                return true;
              }
              if (event.key === 'Enter') {
                const item = s.items[s.activeIndex];
                if (item) {
                  s.command({ id: slugify(item.nome), label: item.nome });
                  suggestionRef.current = null;
                  setSuggestion(null);
                }
                return true;
              }
              return false;
            },
            onExit() {
              suggestionRef.current = null;
              setSuggestion(null);
            },
          }),
        },
      }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: variant === 'compact'
          ? 'outline-none text-sm px-2 py-1.5 min-h-[2rem] max-h-[2rem] overflow-hidden'
          : variant === 'full'
            ? 'outline-none text-sm px-6 py-5 min-h-[24rem]'
            : 'outline-none text-sm px-3 py-2 min-h-[5rem]',
      },
      handleKeyDown(view, event) {
        if (variant === 'compact' && event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          onSubmitRef.current?.();
          return true;
        }
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault();
          onSubmitRef.current?.();
          return true;
        }
        return false;
      },
    },
    onUpdate({ editor: ed }) {
      onChange?.(ed.getHTML());
    },
  });

  useEffect(() => { editorRef.current = editor; }, [editor]);

  const prevValue = useRef(value);
  useEffect(() => {
    if (!editor || value === prevValue.current) return;
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value || '', false);
    }
    prevValue.current = value;
  }, [value, editor]);

  const imageInputRef = useRef();
  async function handleImageFile(file) {
    if (!file || !uploadImage) return;
    try {
      const url = await uploadImage(file);
      editor?.chain().focus().setImage({ src: url }).run();
    } catch {
      // silently ignore upload errors
    }
  }

  const rect = suggestion?.clientRect?.();

  function onResizeStart(e) {
    e.preventDefault();
    const startY = e.clientY;
    const startH = contentRef.current?.getBoundingClientRect().height ?? 384;
    function onMove(ev) {
      const next = Math.max(120, startH + (ev.clientY - startY));
      setEditorHeight(next);
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  return (
    <div className={`relative border rounded-lg focus-within:ring-2 focus-within:ring-blue-400 overflow-visible ${className}`}>
      {variant !== 'compact' && (
        <div className="flex items-center gap-0.5 px-2 py-1 bg-gray-50 border-b flex-wrap">
          <ToolbarBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} title="Negrito"><strong>B</strong></ToolbarBtn>
          <ToolbarBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} title="Itálico"><em>I</em></ToolbarBtn>
          <ToolbarBtn onClick={() => editor?.chain().focus().toggleUnderline().run()} active={editor?.isActive('underline')} title="Sublinhado"><u>S</u></ToolbarBtn>
          {variant === 'full' && (
            <>
              <Divider />
              <ToolbarBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} active={editor?.isActive('heading', { level: 1 })} title="Título 1" className="text-xs">H1</ToolbarBtn>
              <ToolbarBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive('heading', { level: 2 })} title="Título 2" className="text-xs">H2</ToolbarBtn>
              <Divider />
              <ToolbarBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} title="Lista">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              </ToolbarBtn>
              <ToolbarBtn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} title="Lista numerada">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20h14M7 12h14M7 4h14M3 20v-2M3 12v-2M3 4v-2" /></svg>
              </ToolbarBtn>
              <Divider />
              <ToolbarBtn onClick={() => imageInputRef.current?.click()} title="Inserir imagem">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </ToolbarBtn>
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={e => { handleImageFile(e.target.files[0]); e.target.value = ''; }} />
            </>
          )}
          {variant === 'simple' && (
            <>
              <Divider />
              <ToolbarBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} title="Lista">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              </ToolbarBtn>
              <span className="text-xs text-gray-400 ml-1">@ para mencionar</span>
            </>
          )}
        </div>
      )}

      <div
        ref={contentRef}
        style={variant === 'full' && editorHeight ? { height: editorHeight, overflowY: 'auto' } : undefined}
        className={variant === 'full' ? 'overflow-y-auto' : undefined}
      >
        <EditorContent editor={editor} />
      </div>

      {variant === 'full' && (
        <div
          onMouseDown={onResizeStart}
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-end justify-end pr-0.5 pb-0.5 select-none"
          title="Redimensionar"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M9 1L1 9M9 5L5 9M9 9H9" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
      )}

      {suggestion && suggestion.items.length > 0 && rect && (
        <MentionList
          items={suggestion.items}
          activeIndex={suggestion.activeIndex}
          onSelect={item => {
            const s = suggestionRef.current;
            if (s) {
              s.command({ id: slugify(item.nome), label: item.nome });
              suggestionRef.current = null;
            }
            setSuggestion(null);
          }}
          rect={rect}
        />
      )}
    </div>
  );
}

function ToolbarBtn({ onClick, active, title, children, className = '' }) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      className={`w-6 h-6 flex items-center justify-center rounded text-sm text-gray-700 hover:bg-gray-200 transition-colors ${active ? 'bg-blue-100 text-blue-700' : ''} ${className}`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="w-px h-4 bg-gray-200 mx-0.5" />;
}

function MentionList({ items, activeIndex, onSelect, rect }) {
  return (
    <div
      style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, zIndex: 9999 }}
      className="bg-white border rounded-lg shadow-lg py-1 min-w-[180px] max-w-xs"
    >
      {items.map((item, i) => (
        <button
          key={item.id ?? item.nome}
          type="button"
          onMouseDown={e => { e.preventDefault(); onSelect(item); }}
          className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 ${i === activeIndex ? 'bg-blue-50 text-blue-700' : 'hover:bg-blue-50 hover:text-blue-700'}`}
        >
          <span className="font-medium">{item.nome}</span>
          <span className="text-xs text-gray-400">@{slugify(item.nome)}</span>
        </button>
      ))}
    </div>
  );
}
