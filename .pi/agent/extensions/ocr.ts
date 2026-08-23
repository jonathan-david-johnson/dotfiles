import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { execSync } from "node:child_process";

export default function (pi: ExtensionAPI) {
  // Register /ocr command for user invocation
  pi.registerCommand("ocr", {
    description: "OCR an image file using tesseract",
    handler: async (args, ctx) => {
      const imagePath = args.trim();
      if (!imagePath) {
        ctx.ui.notify("Usage: /ocr <image_path>", "error");
        return;
      }

      try {
        const result = execSync(`tesseract "${imagePath}" stdout -l eng`, {
          encoding: "utf-8",
          timeout: 30000,
        });
        const text = result.trim();
        if (text) {
          ctx.ui.notify(text, "info");
        } else {
          ctx.ui.notify("No text found in image.", "warning");
        }
      } catch (e: any) {
        ctx.ui.notify(`OCR failed: ${e.message}`, "error");
      }
    },
  });

  // Register ocr_image tool for LLM invocation
  pi.registerTool({
    name: "ocr_image",
    label: "OCR Image",
    description:
      "Extract text from an image file using Tesseract OCR, only when the user explicitly asks to OCR, extract, transcribe, or read text from an image.",
    promptSnippet: "Extract text from an image when the user explicitly requests OCR",
    promptGuidelines: [
      "Use ocr_image only when the user explicitly asks to OCR, extract, transcribe, or read text from an image. Do not call it merely because the user shared an image.",
    ],
    parameters: Type.Object({
      path: Type.String({ description: "Path to the image file to OCR" }),
    }),
    async execute(_toolCallId, params, _signal) {
      const result = execSync(`tesseract "${params.path}" stdout -l eng`, {
        encoding: "utf-8",
        timeout: 30000,
      });
      const text = result.trim();
      return {
        content: [
          { type: "text", text: text || "(No text found in image)" },
        ],
        details: {},
      };
    },
  });
}