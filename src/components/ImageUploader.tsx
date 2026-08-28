import React, { useState, useImperativeHandle, forwardRef } from 'react';
import Tesseract, { PSM } from 'tesseract.js';

type AnnotationVertex = { x?: number; y?: number };
type Annotation = {
  description?: string;
  boundingPoly?: { vertices?: AnnotationVertex[] };
  level?: 'line' | 'word';
};

type OCRResult = { text?: string; annotations?: Annotation[] };

type Props = {
  onResult: (file: File | null, result: OCRResult) => void;
  autoUpload?: boolean;
  onError?: (message: string) => void;
};

export type ImageUploaderHandle = {
  uploadSelected: () => Promise<void>;
  hasSelected: () => boolean;
};

function getImageDimensions(file: File | Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

async function preprocessForOcr(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const { width, height } = await getImageDimensions(file);

  const MAX_DIMENSION = 2800;
  const MIN_UPSCALE_TARGET = 1600;
  let scale = 1;
  if (Math.max(width, height) < MIN_UPSCALE_TARGET) scale = MIN_UPSCALE_TARGET / Math.max(width, height);
  if (Math.max(width, height) * scale > MAX_DIMENSION) scale = MAX_DIMENSION / Math.max(width, height);

  const targetW = Math.round(width * scale);
  const targetH = Math.round(height * scale);

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { blob: file, width, height };

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);

  const imageData = ctx.getImageData(0, 0, targetW, targetH);
  const data = imageData.data;
  let min = 255;
  let max = 0;
  const gray = new Uint8ClampedArray(targetW * targetH);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray[p] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const range = Math.max(1, max - min);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const stretched = ((gray[p] - min) / range) * 255;
    data[i] = data[i + 1] = data[i + 2] = stretched;
  }
  ctx.putImageData(imageData, 0, 0);

  const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b as Blob), 'image/png', 1));
  return { blob, width: targetW, height: targetH };
}

const ImageUploader = forwardRef<ImageUploaderHandle, Props>(({ onResult, autoUpload = true, onError }, ref) => {
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileSelect = (file: File | null) => {
    if (!file) return;
    setFilePreview(URL.createObjectURL(file));
    setSelectedFile(file);
    if (autoUpload) runOcr(file);
  };

  const runOcr = async (file: File) => {
    setUploading(true);
    setProgress(0);
    setErrorMsg(null);
    let worker: Tesseract.Worker | null = null;
    try {
      const { blob, width, height } = await preprocessForOcr(file);

      worker = await Tesseract.createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100));
        },
      });
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });

      const { data } = await worker.recognize(blob);
      await worker.terminate();
      worker = null;

      // CRITICAL FIX: SPARSE_TEXT returns blocks in Tesseract's internal
      // scan order, NOT top-to-bottom reading order. Any logic downstream
      // that assumes "the next line in the array is the next line on the
      // label" (label/value merging, title detection) silently breaks
      // without this sort — it was the real cause of MRP/name mix-ups.
      const rowThreshold = Math.max(8, height * 0.01);
      const byPosition = (a: any, b: any) => {
        const dy = a.bbox.y0 - b.bbox.y0;
        if (Math.abs(dy) > rowThreshold) return dy; // different rows → top first
        return a.bbox.x0 - b.bbox.x0; // same row → left first
      };

      const sortedLines = [...(data.lines || [])].sort(byPosition);
      const sortedWords = [...((data as any).words || [])].sort(byPosition);

      const toVertices = (x0: number, y0: number, x1: number, y1: number): AnnotationVertex[] => [
        { x: x0 / width, y: y0 / height },
        { x: x1 / width, y: y0 / height },
        { x: x1 / width, y: y1 / height },
        { x: x0 / width, y: y1 / height },
      ];
      const cleanStr = (s: string) => s.replace(/\s+/g, ' ').trim();

      const lineAnnotations: Annotation[] = sortedLines
        .filter((line) => line.text && cleanStr(line.text).length > 0)
        .map((line) => {
          const { x0, y0, x1, y1 } = line.bbox;
          return { description: cleanStr(line.text), boundingPoly: { vertices: toVertices(x0, y0, x1, y1) }, level: 'line' as const };
        });

      const wordAnnotations: Annotation[] = sortedWords
        .filter((w: any) => w.text && cleanStr(w.text).length > 0)
        .map((w: any) => {
          const { x0, y0, x1, y1 } = w.bbox;
          return { description: cleanStr(w.text), boundingPoly: { vertices: toVertices(x0, y0, x1, y1) }, level: 'word' as const };
        });

      // Text now reflects spatial (top-to-bottom) order too, since it's
      // built from the same sorted lines.
      const textFromLines = lineAnnotations.map((a) => a.description).join('\n');

      onResult(file, { text: textFromLines || cleanStr(data.text || ''), annotations: [...lineAnnotations, ...wordAnnotations] });
    } catch (err: any) {
      console.error('OCR error', err);
      if (worker) { try { await worker.terminate(); } catch {} }
      const message = err?.message || 'OCR processing failed';
      setErrorMsg(message);
      onError?.(message);
      onResult(file, { text: '', annotations: [] });
    } finally {
      setUploading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    uploadSelected: async () => { if (!selectedFile) return Promise.resolve(); await runOcr(selectedFile); },
    hasSelected: () => !!selectedFile,
  }));

  return (
    <div className="space-y-4">
      <div>
        <input type="file" accept="image/*" capture="environment" onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)} />
      </div>
      <div>
        <button
          type="button"
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.capture = 'environment';
            input.onchange = () => handleFileSelect(input.files ? input.files[0] : null);
            input.click();
          }}
          className="px-3 py-2 bg-blue-600 text-white rounded"
        >
          Take photo / Upload
        </button>
      </div>
      {filePreview && <div><img src={filePreview} alt="preview" style={{ maxWidth: '100%', height: 'auto' }} /></div>}
      {!autoUpload && selectedFile && (
        <div>
          <button type="button" onClick={() => runOcr(selectedFile)} disabled={uploading} className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded">
            {uploading ? `Scanning… ${progress}%` : 'Upload to OCR'}
          </button>
          <button type="button" onClick={() => { setSelectedFile(null); setFilePreview(null); }} className="ml-2 mt-2 px-4 py-2 bg-gray-200 text-gray-800 rounded">
            Remove
          </button>
        </div>
      )}
      {autoUpload && uploading && <div>Scanning… {progress}%</div>}
      {errorMsg && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">⚠ {errorMsg}</div>}
    </div>
  );
});

export default ImageUploader;
