"use client";

import { useState } from "react";
import Icon from "./icon";

export default function DownloadPdfButton({
  filename,
  label = "Download PDF",
  all = false,
}: {
  filename: string;
  label?: string;
  all?: boolean;
}) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    const elements = all
      ? Array.from(document.querySelectorAll<HTMLElement>(".print-area"))
      : ([document.querySelector<HTMLElement>(".print-area")].filter(Boolean) as HTMLElement[]);

    if (!elements.length) return;

    setLoading(true);
    try {
      const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas-pro"),
      ]);

      const A4_PX = 794;
      const pageW = 210;
      const pageH = 297;
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      for (let i = 0; i < elements.length; i++) {
        if (i > 0) pdf.addPage();

        const canvas = await html2canvas(elements[i], {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
          windowWidth: A4_PX,
          onclone: (_doc: Document, el: HTMLElement) => {
            el.style.width = `${A4_PX}px`;
            el.style.maxWidth = `${A4_PX}px`;
            el.style.margin = "0";
          },
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        const imgH = (canvas.height * pageW) / canvas.width;

        let remaining = imgH;
        let yOffset = 0;

        pdf.addImage(imgData, "JPEG", 0, yOffset, pageW, imgH);
        remaining -= pageH;

        while (remaining > 0) {
          yOffset -= pageH;
          pdf.addPage();
          pdf.addImage(imgData, "JPEG", 0, yOffset, pageW, imgH);
          remaining -= pageH;
        }
      }

      pdf.save(`${filename}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="btn-primary no-print disabled:opacity-60"
    >
      <Icon name="download" />
      {loading ? "Generating…" : label}
    </button>
  );
}
