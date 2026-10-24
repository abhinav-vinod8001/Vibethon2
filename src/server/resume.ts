import PDFDocument from "pdfkit";
import { join } from "node:path";
import type { Profile } from "@/domain/types";

/** Render confirmed fields as text. No AI rewriting, contact lookup or file storage. */
export function createResumePdf(profile: Profile): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const font = join(process.cwd(), "assets/fonts/NotoSansMalayalam.ttf");
    const document = new PDFDocument({
      size: "A4",
      margins: { top: 54, bottom: 60, left: 54, right: 54 },
      font,
      bufferPages: true,
      info: { Title: "Resume", Creator: "JobSathi", Producer: "JobSathi" },
    });
    const chunks: Buffer[] = [];
    document.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    document.on("error", reject);
    document.on("end", () => resolve(Buffer.concat(chunks)));

    try {
      const width = document.page.width - 108;
      document
        .fillColor("#27634b")
        .fontSize(9)
        .text("RESUME", { characterSpacing: 1.5 });
      document.moveDown(0.7);
      document
        .fillColor("#172b24")
        .fontSize(24)
        .text(profile.name.trim(), { width, lineGap: 2 });
      document.moveDown(0.3);
      document
        .fillColor("#27634b")
        .fontSize(13)
        .text(profile.targetRole.trim(), { width });
      document.moveDown(0.3);
      document
        .fillColor("#52645b")
        .fontSize(10)
        .text(profile.location.trim(), { width });
      document.moveDown(1.2);
      document
        .moveTo(54, document.y)
        .lineTo(document.page.width - 54, document.y)
        .strokeColor("#d6e3dc")
        .stroke();
      document.moveDown(1.3);

      const sections = [
        ["Experience", profile.experience],
        ["Skills", profile.skills],
        ["Availability", profile.availability],
        ["Preferred language", profile.language],
      ];
      for (const [heading, value] of sections) {
        const text = value.trim();
        if (!text) continue;
        // Keep each heading together with at least the beginning of its content.
        if (document.y + 75 > document.page.height - 60) document.addPage();
        document.fillColor("#27634b").fontSize(11).text(heading, { width });
        document.moveDown(0.45);
        document
          .fillColor("#24342e")
          .fontSize(10.5)
          .text(text, { width, lineGap: 4, paragraphGap: 5 });
        document.moveDown(1.1);
      }

      const pages = document.bufferedPageRange();
      for (let index = 0; index < pages.count; index++) {
        document.switchToPage(index);
        const bottomMargin = document.page.margins.bottom;
        document.page.margins.bottom = 0;
        document
          .fillColor("#718077")
          .fontSize(8)
          .text(
            `Candidate-confirmed information | JobSathi | ${index + 1} / ${pages.count}`,
            54,
            document.page.height - 35,
            { width, lineBreak: false, align: "center" },
          );
        document.page.margins.bottom = bottomMargin;
      }
      document.end();
    } catch (error) {
      reject(error);
    }
  });
}
