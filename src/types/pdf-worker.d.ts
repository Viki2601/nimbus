// pdf.js's worker bundle has no type declarations; it is imported purely for
// its side effect (it sets globalThis.pdfjsWorker.WorkerMessageHandler, which
// makes pdf.js parse in-process instead of spawning a worker).
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs";
