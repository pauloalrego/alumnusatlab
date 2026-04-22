import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { slugify } from '../mentionUtils.jsx';

const URL_RE = /(https?:\/\/[^\s<]+)/;

function linkifyText(text) {
  if (!URL_RE.test(text)) return text;
  return text.split(URL_RE).map((seg, i) =>
    URL_RE.test(seg)
      ? <a key={i} href={seg} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">{seg}</a>
      : seg
  );
}

export default function RichContent({ html = '', researchers = [], className = '', inline = false }) {
  const navigate = useNavigate();
  const ref = useRef();

  const isHtml = typeof html === 'string' && html.includes('<');

  useEffect(() => {
    if (!isHtml || !ref.current) return;

    // Linkify bare URLs inside text nodes that are not already inside <a>
    const walker = document.createTreeWalker(ref.current, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (node.parentElement?.closest('a')) continue;
      if (!URL_RE.test(node.textContent)) continue;
      const frag = document.createDocumentFragment();
      node.textContent.split(URL_RE).forEach(seg => {
        if (seg && URL_RE.test(seg)) {
          const a = document.createElement('a');
          a.href = seg;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.className = 'text-blue-600 hover:underline break-all';
          a.textContent = seg;
          frag.appendChild(a);
        } else if (seg) {
          frag.appendChild(document.createTextNode(seg));
        }
      });
      node.parentNode.replaceChild(frag, node);
    }

    function handler(e) {
      // Let native <a> clicks proceed normally (e.g. linkified URLs)
      if (e.target.closest('a')) return;
      const el = e.target.closest('[data-type="mention"]');
      if (el) {
        const id = el.getAttribute('data-id');
        if (id && id !== 'todos') navigate(`/app/profile/${id}`);
      }
    }
    const nodeEl = ref.current;
    nodeEl.addEventListener('click', handler);
    return () => nodeEl.removeEventListener('click', handler);
  }, [html, isHtml, navigate]);

  if (isHtml) {
    const Tag = inline ? 'span' : 'div';
    return (
      <Tag
        ref={ref}
        className={`rich-content ${className}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  if (!html) return null;
  const valid = new Set((researchers || []).map(r => slugify(r.nome)));
  const parts = html.split(/(@[a-zA-Z0-9_-]+)/g);
  const content = parts.map((part, i) => {
    if (part.startsWith('@') && valid.has(part.slice(1))) {
      return (
        <span
          key={i}
          onClick={() => navigate(`/app/profile/${part.slice(1)}`)}
          className="inline-flex items-center rounded bg-blue-100 px-1 py-0.5 text-[11px] font-semibold text-blue-700 leading-tight hover:bg-blue-200 cursor-pointer"
        >
          {part}
        </span>
      );
    }
    return <React.Fragment key={i}>{linkifyText(part)}</React.Fragment>;
  });
  const Tag2 = inline ? 'span' : 'p';
  return <Tag2 className={`whitespace-pre-wrap ${className}`}>{content}</Tag2>;
}
