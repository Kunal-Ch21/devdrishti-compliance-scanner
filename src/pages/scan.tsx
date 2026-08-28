import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useInspectionStore } from '@/store/inspectionStore';
import { useAuthStore } from '@/store/authStore';
import mockOCRDatabase from '@/data/mockOCRDatabase.json';
import { ExtractionResult, Finding } from '@/types';
import ImageUploader, { ImageUploaderHandle } from '@/components/ImageUploader';

type Vertex = { x?: number; y?: number };
type Annotation = { description?: string; boundingPoly?: { vertices?: Vertex[] }; level?: 'line' | 'word' };

const FIELD_ORDER = ['net_quantity', 'mrp', 'manufacturer', 'date_of_manufacture', 'batch_number', 'country_of_origin', 'consumer_care'] as const;

const FIELD_PATTERNS: Record<string, RegExp> = {
  mrp: /(mrp|m\.r\.p\.?|maximum retail price)[:\s]*(rs\.?|₹|inr)?\s?\d+(?:[.,]\d+)?/i,
  net_quantity: /\b(net\s*(qty|quantity|wt|weight)[:\s]*)?\d+(?:[.,]\d+)?\s*(g|gm|gms|kg|ml|l|ltr|litre)\b/i,
  date_of_manufacture: /(mfg|manufactur(ed|ing)|pack(ed|ing))?\s*date[:\s]*\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/i,
  batch_number: /(batch|lot)\s*(no\.?|number)?[:\s]*[\w-]+/i,
  country_of_origin: /country\s*of\s*origin[:\s]*.+/i,
  consumer_care: /(consumer|customer)\s*care[:\s]*.+/i,
  manufacturer: /(manufactur(er|ed|ing)?|mfr\.?)\s*(by|name)?[:\s]+.+/i,
};

const LABEL_ONLY_PATTERNS: RegExp[] = [
  /^(mrp|m\.r\.p\.?|maximum retail price)\s*[:\-]?\s*$/i,
  /^net\s*(qty|quantity|wt|weight)\s*[:\-]?\s*$/i,
  /^(mfg|manufactur(ed|ing)|pack(ed|ing))?\s*date\s*[:\-]?\s*$/i,
  /^(batch|lot)\s*(no\.?|number)?\s*[:\-]?\s*$/i,
  /^country\s*of\s*origin\s*[:\-]?\s*$/i,
  /^(consumer|customer)\s*care\s*[:\-]?\s*$/i,
  /^(manufactur(er|ed|ing)?|mfr\.?)\s*(by|name)?\s*[:\-]?\s*$/i,
];
const isLabelOnly = (line: string) => LABEL_ONLY_PATTERNS.some((p) => p.test(line.trim()));
const matchesAnyField = (line: string) => Object.values(FIELD_PATTERNS).some((p) => p.test(line));
const NON_TITLE_WORDS = /\b(image|photo|logo|placeholder|insert|barcode|sample photo|click here)\b/i;

function cleanText(s: string): string {
  return (s || '').replace(/\s+/g, ' ').trim();
}

function unionBbox(a?: Annotation['boundingPoly'], b?: Annotation['boundingPoly']): Annotation['boundingPoly'] | undefined {
  const verts = [...(a?.vertices || []), ...(b?.vertices || [])];
  if (!verts.length) return undefined;
  const xs = verts.map((v) => v.x ?? 0);
  const ys = verts.map((v) => v.y ?? 0);
  return { vertices: [{ x: Math.min(...xs), y: Math.min(...ys) }, { x: Math.max(...xs), y: Math.min(...ys) }, { x: Math.max(...xs), y: Math.max(...ys) }, { x: Math.min(...xs), y: Math.max(...ys) }] };
}

/** Merges a label-only line ("Manufacturer:") with the line immediately
 *  after it. Safe now that ImageUploader delivers lines in real top-to-
 *  bottom, left-to-right order — "immediately after" now genuinely means
 *  spatially next, not just next in an arbitrary OCR-internal array. */
function mergeBrokenLabelLines(lines: string[], lineAnnotations: Annotation[]) {
  const mergedLines: string[] = [];
  const annotationMap = new Map<string, Annotation>();
  const findAnno = (line: string) => lineAnnotations.find((a) => a.description === line);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isLabelOnly(line) && i + 1 < lines.length && !isLabelOnly(lines[i + 1])) {
      const next = lines[i + 1];
      const combined = cleanText(`${line} ${next}`);
      mergedLines.push(combined);
      const bbox = unionBbox(findAnno(line)?.boundingPoly, findAnno(next)?.boundingPoly);
      if (bbox) annotationMap.set(combined, { description: combined, boundingPoly: bbox, level: 'line' });
      i++;
      continue;
    }
    mergedLines.push(line);
    const a = findAnno(line);
    if (a) annotationMap.set(line, a);
  }
  return { lines: mergedLines, annotations: annotationMap };
}

/** Single best title candidate: largest text, near the top, that isn't a
 *  label/value line and isn't UI chrome. No clustering — clustering was
 *  what previously let the title balloon into neighboring subtitle/price
 *  text when line order wasn't reliably sequential. */
function detectProductName(lines: string[], lineAnnotations: Annotation[]): { text: string; bbox?: Annotation['boundingPoly'] } | null {
  const metrics = lines
    .map((line, idx) => {
      const anno = lineAnnotations.find((a) => a.description === line);
      const vertices = anno?.boundingPoly?.vertices || [];
      const ys = vertices.map((v) => v.y ?? 0);
      const height = ys.length ? Math.max(...ys) - Math.min(...ys) : 0;
      const topY = ys.length ? Math.min(...ys) : 1;
      const letterCount = (line.match(/[A-Za-z]/g) || []).length;
      return { line, idx, height, topY, letterCount, bbox: anno?.boundingPoly };
    })
    .filter((m) => m.letterCount >= 2 && m.line.length <= 45 && !NON_TITLE_WORDS.test(m.line) && !isLabelOnly(m.line) && !matchesAnyField(m.line));

  if (!metrics.length) return null;

  const topCandidates = metrics.filter((m) => m.topY <= 0.5);
  const pool = topCandidates.length ? topCandidates : metrics;
  pool.sort((a, b) => b.height - a.height || a.idx - b.idx);

  return { text: pool[0].line, bbox: pool[0].bbox };
}

export default function Scan() {
  const router = useRouter();
  const inspector = useAuthStore((state) => state.inspector);
  const createInspection = useInspectionStore((state) => state.createInspection);
  const addFinding = useInspectionStore((state) => state.addFinding);
  const addProductImage = useInspectionStore((s: any) => s.addProductImage);
  const addOcrAnnotations = useInspectionStore((s: any) => s.addOcrAnnotations);

  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [uploaderRunning, setUploaderRunning] = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [overlayTick, setOverlayTick] = useState(0);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const uploaderRef = useRef<ImageUploaderHandle | null>(null);
  const fieldRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const products = Object.keys(mockOCRDatabase);
  const bumpOverlay = useCallback(() => setOverlayTick((t) => t + 1), []);

  useEffect(() => {
    if (!uploadedImageUrl) return;
    if (imgRef.current?.complete) bumpOverlay();
    const t1 = setTimeout(bumpOverlay, 60);
    const t2 = setTimeout(bumpOverlay, 350);
    window.addEventListener('resize', bumpOverlay);
    return () => { clearTimeout(t1); clearTimeout(t2); window.removeEventListener('resize', bumpOverlay); };
  }, [uploadedImageUrl, extractionResult, bumpOverlay]);

  function parseOcrIntoExtractionResult(ocrText: string, ocrAnnotations: Annotation[] = []): ExtractionResult {
    const rawLines = ocrText.split(/\r?\n/).map((l) => cleanText(l)).filter(Boolean);
    const lineAnnotations = ocrAnnotations.filter((a) => a.level !== 'word');
    const now = new Date().toISOString();

    const nameResult = detectProductName(rawLines, lineAnnotations);
    const name = cleanText(productName) || nameResult?.text || selectedProduct || 'Unknown product';

    const { lines, annotations: mergedAnnoMap } = mergeBrokenLabelLines(rawLines, lineAnnotations);
    const findBbox = (line: string) => mergedAnnoMap.get(line)?.boundingPoly ?? lineAnnotations.find((a) => a.description === line)?.boundingPoly;

    const assignedLineIdx = new Set<number>();
    const found: Record<string, { value: string; bbox?: Annotation['boundingPoly'] }> = {};

    lines.forEach((line, idx) => {
      if (assignedLineIdx.has(idx)) return;
      if (nameResult && line === nameResult.text) return;
      for (const field of FIELD_ORDER) {
        if (found[field]) continue;
        if (FIELD_PATTERNS[field].test(line)) {
          found[field] = { value: cleanText(line), bbox: findBbox(line) };
          assignedLineIdx.add(idx);
          break;
        }
      }
    });

    let manufacturerName = '';
    let manufacturerAddress = '';
    let manufacturerBbox: Annotation['boundingPoly'] | undefined;
    if (found.manufacturer) {
      manufacturerBbox = found.manufacturer.bbox;
      const raw = found.manufacturer.value.replace(/^(manufactur(er|ed|ing)?|mfr\.?)\s*(by|name)?[:\s]+/i, '');
      const commaIdx = raw.indexOf(',');
      if (commaIdx > -1) {
        manufacturerName = cleanText(raw.slice(0, commaIdx));
        manufacturerAddress = cleanText(raw.slice(commaIdx + 1));
      } else {
        manufacturerName = cleanText(raw);
      }
    }
    if (!manufacturerAddress) {
      const addressLineIdx = lines.findIndex(
        (line, idx) => !assignedLineIdx.has(idx) && (!nameResult || line !== nameResult.text) &&
          /(\b\d{6}\b|road|street|nagar|city|india|pvt\.?\s*ltd)/i.test(line)
      );
      if (addressLineIdx > -1) {
        const line = lines[addressLineIdx];
        manufacturerAddress = cleanText(line);
        assignedLineIdx.add(addressLineIdx);
        if (!manufacturerBbox) manufacturerBbox = findBbox(line);
      }
    }

    const makeField = (value: string, bbox?: Annotation['boundingPoly'], baseConfidence = 0.85) => ({
      value,
      confidence: value ? baseConfidence : 0.4,
      bounding_box: bbox ? JSON.stringify(bbox) : '',
      status: (value ? 'extracted' : 'needs_review') as 'extracted' | 'needs_review',
    });

    const extractions: any = {
      product_name: makeField(name, nameResult?.bbox, 0.9),
      net_quantity: makeField(found.net_quantity?.value ?? '', found.net_quantity?.bbox),
      mrp: makeField(found.mrp?.value ?? '', found.mrp?.bbox),
      manufacturer_name: makeField(manufacturerName, manufacturerBbox),
      manufacturer_address: makeField(manufacturerAddress, manufacturerBbox),
      date_of_manufacture: makeField(found.date_of_manufacture?.value ?? '', found.date_of_manufacture?.bbox),
      consumer_care: makeField(found.consumer_care?.value ?? '', found.consumer_care?.bbox),
      country_of_origin: makeField(found.country_of_origin?.value ?? '', found.country_of_origin?.bbox),
      batch_number: makeField(found.batch_number?.value ?? '', found.batch_number?.bbox),
    };

    return { product_id: selectedProduct || `OCR-${Date.now()}`, product_name: name, category: category || 'unknown', timestamp: now, extractions };
  }

  const handleOcrResult = (file: File | null, result: { text?: string; annotations?: Annotation[] }) => {
    if (file) setUploadedImageUrl(URL.createObjectURL(file));
    const text = result?.text ?? '';
    const res = parseOcrIntoExtractionResult(text, result.annotations || []);
    setExtractionResult(res);
    setAnnotations(result.annotations || []);
    setUploaderRunning(false);
  };

  const handleExtractFallback = async () => {
    if (!selectedProduct) { alert('Select a mock product or upload an image to extract from.'); return; }
    setIsExtracting(true);
    setTimeout(() => {
      const mockData = mockOCRDatabase[selectedProduct as keyof typeof mockOCRDatabase];
      setExtractionResult(mockData as any);
      setIsExtracting(false);
    }, 600);
  };

  const handleStartInspection = () => {
    if (!extractionResult) return;
