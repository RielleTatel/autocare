import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { Inject, Logger } from "@nestjs/common";
import PDFDocument from "pdfkit";
import { STORAGE_PORT, StoragePort } from "../../common/storage/storage.port";
import { PrismaService } from "../prisma/prisma.service";

/** `certificates.generatePdf` (queue "certificates") — renders a simple PDF of
 *  the certificate (score + plate + verification code) and stores it, setting
 *  pdfUrl. A headless-Chromium render of the public page is the eventual target;
 *  this pdfkit render keeps the job self-contained and dependency-light. */
@Processor("certificates")
export class CertificatesPdfProcessor extends WorkerHost {
  private readonly logger = new Logger(CertificatesPdfProcessor.name);

  constructor(
    private prisma: PrismaService,
    @Inject(STORAGE_PORT) private storage: StoragePort,
  ) {
    super();
  }

  async process(job: Job<{ certificateId: string }>): Promise<void> {
    if (job.name !== "generatePdf") return;
    const cert = await this.prisma.certificate.findUnique({
      where: { id: job.data.certificateId },
      include: { healthScore: { include: { vehicle: true } } },
    });
    if (!cert) return;

    const buffer = await this.render(cert.healthScore.score, cert.healthScore.band, cert.healthScore.vehicle.plateNo, cert.verificationCode);
    const objectPath = `certificates/${cert.id}.pdf`;
    await this.storage.putObject(objectPath, buffer, "application/pdf");
    const url = await this.storage.createDownloadUrl(objectPath, 60 * 60 * 24 * 30);
    await this.prisma.certificate.update({ where: { id: cert.id }, data: { pdfUrl: url } });
    this.logger.log(`certificate ${cert.id} PDF stored`);
  }

  private render(score: number, band: string, plate: string, code: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: 48 });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fontSize(22).text("AutoCare+ Vehicle Health Certificate", { align: "center" });
      doc.moveDown(2);
      doc.fontSize(72).text(String(score), { align: "center" });
      doc.fontSize(18).text(band, { align: "center" });
      doc.moveDown(2);
      doc.fontSize(14).text(`Plate: ${plate}`);
      doc.text(`Verification code: ${code}`);
      doc.moveDown();
      doc.fontSize(10).fillColor("#666").text("Valid for 90 days from inspection. Verify at autocare.example/verify.");
      doc.end();
    });
  }
}
