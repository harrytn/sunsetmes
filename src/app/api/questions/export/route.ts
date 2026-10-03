import { NextResponse } from 'next/server';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getActiveUserId } from '@/lib/session';
import prisma from '@/lib/prisma';

export async function GET() {
  const userId = await getActiveUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // This is an on-demand archive. Legacy answers remain untouched until the PDF is saved.
  const questions = await prisma.dailyQuestion.findMany({
    where: { answers: { some: {} } },
    orderBy: { date: 'asc' },
    select: {
      date: true, text: true,
      answers: { select: { text: true, grade: true, user: { select: { name: true } } }, orderBy: { createdAt: 'asc' } },
    },
  });

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fontPath = (weight: string) => join(process.cwd(), 'src', 'assets', 'fonts', `NotoSans-${weight}.ttf`);
  const regular = await pdf.embedFont(readFileSync(fontPath('400')));
  const bold = await pdf.embedFont(readFileSync(fontPath('700')));
  const glyphs = new Set(regular.getCharacterSet());
  const safe = (text: string) => [...text].map(char => char === '\n' || glyphs.has(char.codePointAt(0)!) ? char : '?').join('');
  const width = 595, height = 842, margin = 48, maxWidth = width - 2 * margin;
  let page = pdf.addPage([width, height]);
  let y = height - margin;
  const lineHeight = 16;
  function nextPage() { page = pdf.addPage([width, height]); y = height - margin; }
  function drawLine(value: string, size = 11, strong = false, gap = 0) {
    if (y < margin + lineHeight) nextPage();
    page.drawText(value || ' ', { x: margin, y, size, font: strong ? bold : regular, color: rgb(0.16, 0.25, 0.38) });
    y -= lineHeight + gap;
  }
  function paragraph(value: string, size = 11, strong = false) {
    for (const rawLine of safe(value).split('\n')) {
      const words = rawLine.split(/\s+/);
      let line = '';
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (regular.widthOfTextAtSize(candidate, size) > maxWidth && line) { drawLine(line, size, strong); line = word; }
        else line = candidate;
      }
      drawLine(line, size, strong);
    }
  }

  drawLine('Sunset Messages - Question Archive', 18, true, 10);
  drawLine(`${questions.length} days with answers`, 10, false, 15);
  for (const question of questions) {
    if (y < margin + 90) nextPage();
    drawLine(question.date.toISOString().slice(0, 10), 10, true, 4);
    paragraph(question.text, 12, true);
    y -= 5;
    for (const answer of question.answers) {
      drawLine(`${safe(answer.user.name)}${answer.grade == null ? '' : ` - ${answer.grade}/5 stars`}`, 10, true, 2);
      paragraph(answer.text);
      y -= 7;
    }
    y -= 10;
  }
  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="sunset-question-archive.pdf"',
      'Cache-Control': 'private, no-store',
    },
  });
}
