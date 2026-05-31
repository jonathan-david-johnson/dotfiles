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
      "Extract text from an image file using Tesseract OCR. Use this to read error messages, screenshots, code snippets, logs, or any text captured in an image.",
    promptSnippet: "Extract text from an image file using OCR",
    promptGuidelines: [
      "Use ocr_image to read text from screenshots, error dialogs, terminal output, or any image containing text the user shares.",
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