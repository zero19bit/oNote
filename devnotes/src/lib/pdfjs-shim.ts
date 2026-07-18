// Re-export of pdfjs-dist with explicit named bindings so Rollup's
// tree-shaker doesn't drop them. Same pattern as the other shims.

import * as PdfJs from "pdfjs-dist";

export const GlobalWorkerOptions = (PdfJs as any).GlobalWorkerOptions;
export const getDocument = (PdfJs as any).getDocument;
export const version = (PdfJs as any).version;
export const AnnotationMode = (PdfJs as any).AnnotationMode;
export const TextLayer = (PdfJs as any).TextLayer;
export const AnnotationLayer = (PdfJs as any).AnnotationLayer;
