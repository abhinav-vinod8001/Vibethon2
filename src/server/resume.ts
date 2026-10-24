import PDFDocument from "pdfkit";
import { join } from "node:path";
import type { Profile } from "@/domain/types";
import type { Locale } from "@/i18n/languages";

const LABELS = {
  en: {
    resume: "RESUME",
    experience: "Experience",
    skills: "Skills",
    availability: "Availability",
    language: "Preferred language",
    confirmed: "Candidate-confirmed information",
  },
  ml: {
    resume: "ബയോഡാറ്റ",
    experience: "പ്രവൃത്തിപരിചയം",
    skills: "കഴിവുകൾ",
    availability: "ജോലിക്ക് ലഭ്യമായ സമയം",
    language: "ഇഷ്ട ഭാഷ",
    confirmed: "ഉദ്യോഗാർത്ഥി സ്ഥിരീകരിച്ച വിവരങ്ങൾ",
  },
  ta: {
    resume: "சுயவிவரம்",
    experience: "பணி அனுபவம்",
    skills: "திறன்கள்",
    availability: "வேலை செய்யக் கிடைக்கும் நேரம்",
    language: "விருப்ப மொழி",
    confirmed: "விண்ணப்பதாரர் உறுதிப்படுத்திய தகவல்கள்",
  },
  hi: {
    resume: "बायोडाटा",
    experience: "कार्य अनुभव",
    skills: "कौशल",
    availability: "काम के लिए उपलब्धता",
    language: "पसंदीदा भाषा",
    confirmed: "उम्मीदवार द्वारा पुष्टि की गई जानकारी",
  },
  te: {
    resume: "బయోడేటా",
    experience: "పని అనుభవం",
    skills: "నైపుణ్యాలు",
    availability: "పనికి అందుబాటులో ఉండే సమయం",
    language: "ఇష్టమైన భాష",
    confirmed: "అభ్యర్థి నిర్ధారించిన సమాచారం",
  },
} satisfies Record<Locale, Record<string, string>>;

const FONTS = {
  ml: "NotoSansMalayalam",
  ta: "NotoSansTamil",
  hi: "NotoSansDevanagari",
  te: "NotoSansTelugu",
} as const;
type Font = (typeof FONTS)[keyof typeof FONTS];
const SCRIPTS: [RegExp, Font][] = [
  [/\p{Script=Malayalam}/u, FONTS.ml],
  [/\p{Script=Tamil}/u, FONTS.ta],
  [/\p{Script=Devanagari}/u, FONTS.hi],
  [/\p{Script=Telugu}/u, FONTS.te],
];
const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });

/** Keep complete graphemes together so Indic marks and conjuncts are shaped. */
function textRenderer(document: PDFKit.PDFDocument, locale: Locale) {
  const baseFont = FONTS[locale === "en" ? "ml" : locale];
  const coverage = new Map<string, boolean>();
  const supports = (font: Font, grapheme: string) => {
    const key = `${font}:${grapheme}`;
    const cached = coverage.get(key);
    if (cached !== undefined) return cached;
    document.font(font);
    // PDFKit exposes the fontkit font used for shaping through its embedded font.
    const embedded = document as unknown as {
      _font: { font: { hasGlyphForCodePoint: (code: number) => boolean } };
    };
    const result = Array.from(grapheme).every((character) => {
      const code = character.codePointAt(0)!;
      // Joiners, variation selectors and line controls affect layout/shaping.
      return (
        /[\r\n\t\u200c\u200d\ufe00-\ufe0f]/u.test(character) ||
        embedded._font.font.hasGlyphForCodePoint(code)
      );
    });
    coverage.set(key, result);
    return result;
  };
  return (
    value: string,
    options: PDFKit.Mixins.TextOptions = {},
    x?: number,
    y?: number,
  ) => {
    const startX = x ?? document.x;
    const width =
      options.width ??
      document.page.width - startX - document.page.margins.right;
    let lineY = y ?? document.y;
    type Run = { text: string; font: Font };
    const measure = (runs: Run[]) =>
      runs.reduce((total, run) => {
        document.font(run.font);
        return total + document.widthOfString(run.text);
      }, 0);
    const append = (runs: Run[], run: Run) => {
      const last = runs.at(-1);
      if (last?.font === run.font) last.text += run.text;
      else runs.push({ ...run });
    };
    const render = (runs: Run[]) => {
      let height = 0;
      let ascent = 0;
      for (const run of runs) {
        document.font(run.font);
        height = Math.max(height, document.currentLineHeight(true));
        const metrics = document as unknown as {
          _font: { ascender: number };
          _fontSize: number;
        };
        ascent = Math.max(
          ascent,
          (metrics._font.ascender / 1000) * metrics._fontSize,
        );
      }
      if (
        options.lineBreak !== false &&
        lineY + height > document.page.height - document.page.margins.bottom
      ) {
        document.addPage();
        lineY = document.y;
      }
      const lineWidth = measure(runs);
      let cursor =
        startX + (options.align === "center" ? (width - lineWidth) / 2 : 0);
      for (const run of runs) {
        document.font(run.font);
        document.text(run.text, cursor, lineY + ascent, {
          lineBreak: false,
          baseline: "alphabetic",
        });
        cursor += document.widthOfString(run.text);
      }
      if (options.lineBreak !== false) lineY += height + (options.lineGap || 0);
    };
    for (const paragraph of value.split(/\r\n|\r|\n/)) {
      let line: Run[] = [];
      let previousFont = baseFont;
      for (const word of paragraph.match(/\S+|\s+/gu) || []) {
        const wordRuns: Run[] = [];
        for (const { segment } of segmenter.segment(word)) {
          const preferred =
            SCRIPTS.find(([script]) => script.test(segment))?.[1] ||
            previousFont;
          const font = [preferred, ...Object.values(FONTS)].find((candidate) =>
            supports(candidate, segment),
          );
          // Unavailable symbols are explicit, never silently emitted as missing glyphs.
          const text = font
            ? segment
            : Array.from(segment)
                .map(
                  (character) =>
                    `[U+${character.codePointAt(0)!.toString(16).toUpperCase()}]`,
                )
                .join("");
          previousFont = font || baseFont;
          append(wordRuns, { text, font: previousFont });
        }
        if (
          options.lineBreak !== false &&
          line.length &&
          measure(line) + measure(wordRuns) > width
        ) {
          render(line);
          line = [];
        }
        if (!line.length && /^\s+$/u.test(word)) continue;
        if (options.lineBreak !== false && measure(wordRuns) > width) {
          // Overlong words wrap only at complete graphemes, never inside a conjunct.
          for (const run of wordRuns)
            for (const { segment } of segmenter.segment(run.text)) {
              const next = { text: segment, font: run.font };
              if (line.length && measure(line) + measure([next]) > width) {
                render(line);
                line = [];
              }
              append(line, next);
            }
        } else for (const run of wordRuns) append(line, run);
      }
      if (line.length) render(line);
      else lineY += document.currentLineHeight(true);
      if (options.lineBreak !== false) lineY += options.paragraphGap || 0;
    }
    document.x = startX;
    document.y = lineY;
  };
}

/** Render confirmed fields as text. No AI rewriting, contact lookup or file storage. */
export function createResumePdf(
  profile: Profile,
  locale: Locale = "en",
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const font = join(process.cwd(), "assets/fonts/NotoSansMalayalam.ttf");
    const document = new PDFDocument({
      size: "A4",
      margins: { top: 54, bottom: 60, left: 54, right: 54 },
      font,
      bufferPages: true,
      info: {
        Title: LABELS[locale].resume,
        Creator: "JobSathi",
        Producer: "JobSathi",
      },
    });
    const chunks: Buffer[] = [];
    document.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    document.on("error", reject);
    document.on("end", () => resolve(Buffer.concat(chunks)));

    try {
      for (const name of Object.values(FONTS))
        document.registerFont(
          name,
          join(process.cwd(), `assets/fonts/${name}.ttf`),
        );
      const write = textRenderer(document, locale);
      const labels = LABELS[locale];
      const width = document.page.width - 108;
      document.fillColor("#27634b").fontSize(9);
      write(labels.resume);
      document.moveDown(0.7);
      document.fillColor("#172b24").fontSize(24);
      write(profile.name.trim(), { width, lineGap: 2 });
      document.moveDown(0.3);
      document.fillColor("#27634b").fontSize(13);
      write(profile.targetRole.trim(), { width });
      document.moveDown(0.3);
      document.fillColor("#52645b").fontSize(10);
      write(profile.location.trim(), { width });
      document.moveDown(1.2);
      document
        .moveTo(54, document.y)
        .lineTo(document.page.width - 54, document.y)
        .strokeColor("#d6e3dc")
        .stroke();
      document.moveDown(1.3);

      const sections = [
        [labels.experience, profile.experience],
        [labels.skills, profile.skills],
        [labels.availability, profile.availability],
        [labels.language, profile.language],
      ];
      for (const [heading, value] of sections) {
        const text = value.trim();
        if (!text) continue;
        // Keep each heading together with at least the beginning of its content.
        if (document.y + 75 > document.page.height - 60) document.addPage();
        document.fillColor("#27634b").fontSize(11);
        write(heading, { width });
        document.moveDown(0.45);
        document.fillColor("#24342e").fontSize(10.5);
        write(text, { width, lineGap: 4, paragraphGap: 5 });
        document.moveDown(1.1);
      }

      const pages = document.bufferedPageRange();
      for (let index = 0; index < pages.count; index++) {
        document.switchToPage(index);
        const bottomMargin = document.page.margins.bottom;
        document.page.margins.bottom = 0;
        document.fillColor("#718077").fontSize(8);
        write(
          `${labels.confirmed} | JobSathi | ${index + 1} / ${pages.count}`,
          { width, lineBreak: false, align: "center" },
          54,
          document.page.height - 35,
        );
        document.page.margins.bottom = bottomMargin;
      }
      document.end();
    } catch (error) {
      reject(error);
    }
  });
}
