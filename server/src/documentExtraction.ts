import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import * as mammoth from "mammoth";

import type {
  ExtractedPage,
} from "./financialEvidence";

export type OcrResult = {
  pageCount: number;
  pages: ExtractedPage[];
  error?: string;
};

const ocrScriptPath =
  path.resolve("src", "ocr_pdf.py");
export async function extractEmbeddedText(
  filePath: string,
): Promise<ExtractedPage[]> {
  const bytes = new Uint8Array(fs.readFileSync(filePath));

  const pdf = await getDocument({
    data: bytes,
  }).promise;

  const pages: ExtractedPage[] = [];

  for (
    let pageNumber = 1;
    pageNumber <= pdf.numPages;
    pageNumber++
  ) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    pages.push({
      pageNumber,
      text,
      source: "embedded_text",
    });
  }

  return pages;
}

export function runOcr(filePath: string): Promise<OcrResult> {
  return new Promise((resolve, reject) => {
    const python = spawn(
      "python",
      [ocrScriptPath, filePath],
      {
        env: {
          ...process.env,
          TESSDATA_PREFIX:
            "C:\\Program Files\\Tesseract-OCR\\tessdata",
        },
      },
    );

    let stdout = "";
    let stderr = "";

    python.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    python.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    python.on("error", (error) => {
      reject(error);
    });

    python.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            stderr ||
              stdout ||
              `OCR process exited with code ${code}.`,
          ),
        );

        return;
      }

      try {
        const result = JSON.parse(stdout) as OcrResult;

        if (result.error) {
          reject(new Error(result.error));
          return;
        }

        resolve(result);
      } catch {
        reject(
          new Error(
            `Could not parse OCR response: ${stdout}`,
          ),
        );
      }
    });
  });
}

const SEARCH_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "have",
  "how",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "was",
  "were",
  "what",
  "when",
  "where",
  "which",
  "who",
  "with",
]);

export async function extractDocxText(
  filePath: string,
): Promise<ExtractedPage[]> {
  const result = await mammoth.extractRawText({
    path: filePath,
  });

  const text = result.value
    .replace(/\r\n/g, "\n")
    .trim();

  return [
    {
      pageNumber: 1,
      text,
      source: "embedded_text",
    },
  ];
}

