const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const fs = require('fs');
const path = require('path');

const { computePart, PDF_TEXT } = require('./_engine');

const PAGE_W = 612, PAGE_H = 792;
const MARGIN = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;

const INK = rgb(0x24 / 255, 0x1F / 255, 0x1A / 255);
const INK2 = rgb(0x6B / 255, 0x64 / 255, 0x59 / 255);
const ACCENT = rgb(0xB5 / 255, 0x50 / 255, 0x2C / 255);
const LINE = rgb(0xE4 / 255, 0xDF / 255, 0xD5 / 255);
const DISCLAIMER_BG = rgb(0xFA / 255, 0xEE / 255, 0xDA / 255);
const DISCLAIMER_TEXT = rgb(0x85 / 255, 0x4F / 255, 0x0B / 255);

function wrapText(text, font, size, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { lang = 'ru', height = 15, stg = 16, rowg = 14, title = '', parts = [], decorations = [] } = req.body;
    const t = PDF_TEXT[lang] || PDF_TEXT.ru;

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const regularBytes = fs.readFileSync(path.join(process.cwd(), 'api/fonts/DejaVuSans.ttf'));
    const boldBytes = fs.readFileSync(path.join(process.cwd(), 'api/fonts/DejaVuSans-Bold.ttf'));
    const font = await pdfDoc.embedFont(regularBytes, { subset: true });
    const fontBold = await pdfDoc.embedFont(boldBytes, { subset: true });

    let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MARGIN;

    function newPage() {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
    function ensureSpace(h) {
      if (y - h < MARGIN) newPage();
    }
    function drawLine(text, { size = 10, useFont = font, color = INK, x = MARGIN, gap = 4 } = {}) {
      ensureSpace(size + gap);
      page.drawText(text, { x, y: y - size, size, font: useFont, color });
      y -= size + gap;
    }
    function drawWrapped(text, { size = 9.5, useFont = font, color = INK, x = MARGIN, maxWidth = CONTENT_W, gap = 3, lineGap = 13 } = {}) {
      const lines = wrapText(text, useFont, size, maxWidth);
      for (const line of lines) {
        ensureSpace(lineGap);
        page.drawText(line, { x, y: y - size, size, font: useFont, color });
        y -= lineGap;
      }
      y -= gap;
    }
    function spacer(h) { y -= h; }

    // ---------- Титул ----------
    drawLine('Amigurumi Designer', { size: 10, useFont: fontBold, color: ACCENT, gap: 6 });
    drawLine(title || '-', { size: 20, useFont: fontBold, color: INK, gap: 4 });
    drawWrapped(`${t.heightRow}: ${height} cm  ·  ${t.gaugeRow.toLowerCase()}: ${stg}/${rowg}`, { size: 9, color: INK2, gap: 10 });

    // ---------- Дисклеймер ----------
    const discLines = wrapText('⚠ ' + t.disclaimer, font, 9, CONTENT_W - 20);
    const discHeight = discLines.length * 13 + 16;
    ensureSpace(discHeight + 10);
    page.drawRectangle({ x: MARGIN, y: y - discHeight, width: CONTENT_W, height: discHeight, color: DISCLAIMER_BG });
    let dy = y - 14;
    for (const line of discLines) {
      page.drawText(line, { x: MARGIN + 10, y: dy - 9, size: 9, font, color: DISCLAIMER_TEXT });
      dy -= 13;
    }
    y -= discHeight + 16;

    // ---------- Материалы ----------
    drawLine(t.materialsHeader, { size: 13, useFont: fontBold, gap: 8 });
    const matRows = [
      [t.heightRow, `${height} cm`],
      [t.gaugeRow, `${stg} / ${rowg} / 10cm`],
      [t.yarnRow, t.yarnVal],
      [t.hookRow, t.hookVal],
      [t.stuffRow, t.stuffVal],
      [t.extraRow, t.extraVal],
    ];
    for (const [label, value] of matRows) {
      ensureSpace(16);
      page.drawText(label, { x: MARGIN, y: y - 9.5, size: 9.5, font: fontBold, color: INK });
      page.drawText(String(value), { x: MARGIN + 170, y: y - 9.5, size: 9.5, font, color: INK });
      y -= 8;
      page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: LINE });
      y -= 8;
    }
    spacer(10);

    // ---------- Легенда ----------
    drawLine(t.legendHeader, { size: 13, useFont: fontBold, gap: 8 });
    for (const [abbr, mean] of t.legend) {
      ensureSpace(15);
      page.drawText(abbr, { x: MARGIN, y: y - 9, size: 9, font: fontBold, color: INK });
      page.drawText(mean, { x: MARGIN + 110, y: y - 9, size: 9, font, color: INK });
      y -= 15;
    }

    // ---------- Детали ----------
    newPage();
    drawLine(t.partsHeader, { size: 20, useFont: fontBold, gap: 12 });

    for (const p of parts) {
      const { rounds, maxSt } = computePart(p, stg, rowg, lang);
      const header = `${p.name}  ·  ${t.typeLabels[p.type] || p.type}  ·  ${p.count} ${t.pc}  ·  ${t.maxSt}: ${maxSt}`;
      ensureSpace(30);
      drawLine(header, { size: 11.5, useFont: fontBold, color: ACCENT, gap: 6 });
      for (const r of rounds) {
        const lines = wrapText(r.text, font, 9, CONTENT_W - 30);
        ensureSpace(lines.length * 13 + 4);
        page.drawText(String(r.n), { x: MARGIN, y: y - 9, size: 9, font, color: INK2 });
        let ly = y;
        for (const line of lines) {
          page.drawText(line, { x: MARGIN + 25, y: ly - 9, size: 9, font, color: INK });
          ly -= 13;
        }
        y = ly - 2;
      }
      spacer(10);
    }

    // ---------- Декор ----------
    newPage();
    drawLine(t.decorHeader, { size: 13, useFont: fontBold, gap: 6 });
    drawWrapped(t.decorNote, { size: 8.5, color: INK2, gap: 10 });
    for (const d of decorations) {
      ensureSpace(20);
      drawLine(d.name, { size: 10.5, useFont: fontBold, color: ACCENT, gap: 3 });
      drawWrapped(d.instruction, { size: 9, gap: 8 });
    }

    const pdfBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="pattern.pdf"`);
    res.status(200).send(Buffer.from(pdfBytes));
  } catch (err) {
    res.status(500).json({ error: 'PDF generation error: ' + err.message });
  }
};
