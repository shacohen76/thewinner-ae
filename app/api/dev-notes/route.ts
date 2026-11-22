// DEV-ONLY design notes for the live preview (Market Pulse 2, 2026-11-20).
// The owner clicks a spot on the real panel and types a note; Claude reads the notes file and edits the code.
// Outside `next dev` this route answers 404 and touches nothing. Notes file: <project>/.dev-notes.json (git-excluded locally).
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const FILE = path.join(process.cwd(), '.dev-notes.json');
const off = () => process.env.NODE_ENV !== 'development';
const nf = () => new NextResponse(null, { status: 404 });

type Note = { id: string; at: string; note: string; where: string; text: string; tag: string; x: number; y: number; w: number; h: number; vw: number; done?: boolean };

async function load(): Promise<Note[]> {
  try { return JSON.parse(await fs.readFile(FILE, 'utf8')); } catch { return []; }
}
const save = (n: Note[]) => fs.writeFile(FILE, JSON.stringify(n, null, 2), 'utf8');
const s = (v: unknown, max: number) => String(v ?? '').slice(0, max);
const n = (v: unknown) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);

export async function GET() {
  if (off()) return nf();
  return NextResponse.json(await load(), { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  if (off()) return nf();
  const b = await req.json().catch(() => ({}));
  if (!s(b.note, 2000).trim()) return NextResponse.json({ error: 'empty note' }, { status: 400 });
  const notes = await load();
  const note: Note = {
    id: Date.now().toString(36), at: new Date().toISOString(), note: s(b.note, 2000).trim(),
    where: s(b.where, 400), text: s(b.text, 200), tag: s(b.tag, 20),
    x: n(b.x), y: n(b.y), w: n(b.w), h: n(b.h), vw: n(b.vw),
  };
  notes.push(note);
  await save(notes);
  return NextResponse.json(note, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  if (off()) return nf();
  const id = req.nextUrl.searchParams.get('id');
  const notes = await load();
  await save(id ? notes.filter(x => x.id !== id) : []);
  return NextResponse.json({ ok: true });
}
