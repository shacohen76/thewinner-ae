'use client';
// DEV-ONLY "point & note" layer for the live preview (Market Pulse 2, 2026-11-20).
// Rendered only under `next dev` (page.tsx checks NODE_ENV); in a production build it is never mounted.
// Click "Point & note" → hover outlines a box → click it → type what should change → Save.
// Notes go to /api/dev-notes (dev-only) → <project>/.dev-notes.json, which Claude reads.
import { useCallback, useEffect, useRef, useState } from 'react';

type Note = { id: string; note: string; text: string; x: number; y: number; w: number; h: number };
type Draft = { where: string; text: string; tag: string; x: number; y: number; w: number; h: number; cx: number; cy: number };

function describe(el: Element): string {
  const parts: string[] = [];
  let e: Element | null = el;
  for (let i = 0; e && i < 5 && e !== document.body; i++, e = e.parentElement) {
    const cls = typeof e.className === 'string' ? e.className.split(/\s+/).filter(Boolean).slice(0, 3).join('.') : '';
    const idx = e.parentElement ? Array.from(e.parentElement.children).indexOf(e) + 1 : 1;
    parts.unshift(`${e.tagName.toLowerCase()}${cls ? '.' + cls : ''}:nth-child(${idx})`);
  }
  return parts.join(' > ');
}

export default function DevNotes() {
  const [on, setOn] = useState(false);
  const [box, setBox] = useState<DOMRect | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [text, setText] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [list, setList] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const reload = useCallback(() => {
    fetch('/api/dev-notes', { cache: 'no-store' }).then(r => (r.ok ? r.json() : [])).then(setNotes).catch(() => {});
  }, []);
  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!on || draft) return;
    const mine = (t: EventTarget | null) => !!(t instanceof Node && rootRef.current?.contains(t));
    const move = (ev: MouseEvent) => { if (!mine(ev.target) && ev.target instanceof Element) setBox(ev.target.getBoundingClientRect()); };
    const click = (ev: MouseEvent) => {
      if (mine(ev.target) || !(ev.target instanceof Element)) return;
      ev.preventDefault(); ev.stopPropagation();
      const el = ev.target, r = el.getBoundingClientRect();
      setDraft({ where: describe(el), text: (el as HTMLElement).innerText?.replace(/\s+/g, ' ').trim().slice(0, 200) ?? '', tag: el.tagName.toLowerCase(),
        x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, cx: ev.clientX, cy: ev.clientY });
      setText('');
    };
    const key = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { setOn(false); setBox(null); } };
    document.addEventListener('mousemove', move, true);
    document.addEventListener('click', click, true);
    document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('mousemove', move, true); document.removeEventListener('click', click, true); document.removeEventListener('keydown', key, true); };
  }, [on, draft]);

  const save = async () => {
    if (!draft || !text.trim()) return;
    await fetch('/api/dev-notes', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...draft, note: text, vw: innerWidth }) }).catch(() => {});
    setDraft(null); setText(''); reload();
  };
  const del = async (id: string) => { await fetch(`/api/dev-notes?id=${id}`, { method: 'DELETE' }).catch(() => {}); reload(); };

  const btn = 'px-3 py-1.5 rounded-lg text-[13px] font-bold';
  return (
    <div ref={rootRef}>
      {on && box && !draft && (
        <div style={{ position: 'fixed', left: box.left, top: box.top, width: box.width, height: box.height, pointerEvents: 'none', zIndex: 9998 }}
          className="outline outline-2 outline-[#ffcc33] bg-[#ffcc33]/10 rounded" />
      )}
      {notes.map((n, i) => (
        <div key={n.id} title={n.note} style={{ position: 'absolute', left: n.x + n.w - 12, top: n.y - 10, zIndex: 9997 }}
          className="w-6 h-6 rounded-full bg-[#ffcc33] text-black text-[12px] font-black flex items-center justify-center shadow-lg cursor-help">{i + 1}</div>
      ))}
      {draft && (
        <div style={{ position: 'fixed', left: Math.min(draft.cx, innerWidth - 340), top: Math.min(draft.cy + 12, innerHeight - 210), zIndex: 10000 }}
          className="w-[320px] bg-[#111a30] border-2 border-[#ffcc33] rounded-xl p-3 shadow-2xl text-white">
          <div className="text-[11px] text-[#94a0bd] mb-1 truncate">On: {draft.text || draft.tag}</div>
          <textarea autoFocus value={text} onChange={e => setText(e.target.value)} rows={4}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save(); if (e.key === 'Escape') setDraft(null); }}
            placeholder="What should change here? (any language)" className="w-full bg-[#0b1224] border border-[#33416a] rounded-lg p-2 text-[13px]" />
          <div className="flex gap-2 justify-end mt-2">
            <button onClick={() => setDraft(null)} className={`${btn} bg-[#24304d]`}>Cancel</button>
            <button onClick={save} className={`${btn} bg-[#ffcc33] text-black`}>Save note</button>
          </div>
        </div>
      )}
      {list && (
        <div style={{ zIndex: 9999 }} className="fixed right-4 bottom-16 w-[340px] max-h-[60vh] overflow-auto bg-[#111a30] border border-[#33416a] rounded-xl p-3 text-white shadow-2xl">
          <div className="font-bold mb-2">Your notes ({notes.length})</div>
          {notes.length === 0 && <div className="text-[13px] text-[#94a0bd]">None yet.</div>}
          {notes.map((n, i) => (
            <div key={n.id} className="border-t border-[#24304d] py-2 text-[13px] flex gap-2">
              <span className="font-black text-[#ffcc33]">{i + 1}</span>
              <span className="flex-1">{n.note}<span className="block text-[11px] text-[#94a0bd] truncate">on: {n.text}</span></span>
              <button onClick={() => del(n.id)} className="text-[#ff6b8b] text-[12px]">delete</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ zIndex: 9999 }} className="fixed right-4 bottom-4 flex gap-2">
        <button onClick={() => setList(l => !l)} className={`${btn} bg-[#24304d] text-white shadow-lg`}>Notes ({notes.length})</button>
        <button onClick={() => { setOn(o => !o); setBox(null); setDraft(null); }}
          className={`${btn} shadow-lg ${on ? 'bg-[#ff6b8b] text-white' : 'bg-[#ffcc33] text-black'}`}>{on ? 'Stop pointing (Esc)' : '✎ Point & note'}</button>
      </div>
    </div>
  );
}
