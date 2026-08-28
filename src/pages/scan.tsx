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

/**
 * FIELD_PATTERNS: Strict label/value regexes where possible. Each pattern tries
 * to capture the meaningful value in a group so post-processing can normalize it.
 */
const FIELD_PATTERNS: Record<string, RegExp> = {
  // Capture currency symbol+value (handles ₹, Rs, INR, Rs., M.R.P etc). Capture numeric portion.
  mrp: /(?:^|\b)(?:mrp|m\.r\.p\.?|maximum\s+retail\s+price|price)[:\s\-]*((?:rs\.?|inr|\₹)?\s*[\d{1,3}(?:,|\.)?\d{0,3}]+(?:[.,]\d+)?(?:\s*per)?)/i,

  // Net quantity: capture forms like "Net Wt. 200 g", "Net Qty: 2 x 200 ml", "500 ml"
  net_quantity: /(?:\bnet\b[:\s\-]*)?(?:wt|qty|quantity|net\s*wt|net\s*quantity|weight|vol|volume)?[:\s\-]*((?:\d+(?:[.,]\d+)?(?:\s*[xX]\s*\d+)?)(?:\s*(?:g|gm|gms|kg|mg|ml|l|ltr|litre|mls|oz|ozs))\b)/i,

  // Dates: support dd/mm/yyyy, dd-mm-yy, dd Mmm yyyy, Mmm dd, yyyy, "Mfg Date: 12 Apr 2023"
  date_of_manufacture: /(?:\b(?:mfg|mfg\.|manufactur(?:ed|ing)|mfg(?:\s*date)?|mfgdate|mfg\:|pack(?:ed|ing)?)\b[:\s\-]*)?((?:\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})|(?:\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[.,]?\s*\d{2,4})|(?:[a-z]{3,9}\s+\d{1,2},?\s*\d{2,4}))/i,

  // Batch numbers often alphanumeric, may contain slashes, dashes, dots
  batch_number: /(?:\b(batch|lot)\b[:\s\-]*)?([A-Z0-9\-\/_.]{3,30})/i,

  // Country of origin: label followed by country name(s)
  country_of_origin: /(?:\b(country\s+of\s+origin|origin|made\s+in)\b[:\s\-]*)?([A-Za-z \-]{2,40})/i,

  // Consumer care: phone, email, or "consumer care: <text>"
  consumer_care: /(?:\b(consumer|customer)\s*care\b[:\s\-]*)?(:?\+?\d{3,4}[-\s]?\d{3,4}[-\s]?\d{3,4}|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|https?:\/\/[^\s,;]+)/i,

  // Manufacturer: label + remainder; capture remainder and split heuristically later
  manufacturer: /(?:\b(manufactur(?:er|ed|ing)|mfr\.?)\b[:\s\-]*)?(.*\S.*)/i,
};

const LABEL_ONLY_PATTERNS: RegExp[] = [
  /^(mrp|m\.r\.p\.?|maximum retail price|price)\s*[:\-]?\s*$/i,
  /^net\s*(qty|quantity|wt|weight)\s*[:\-]?\s*$/i,
  /^(mfg|manufactur(ed|ing)|pack(ed|ing)?)\s*date\s*[:\-]?\s*$/i,
  /^(batch|lot)\s*(no\.?|number)?\s*[:\-]?\s*$/i,
  /^country\s*of\s*origin\s*[:\-]?\s*$/i,
  /^(consumer|customer)\s*care\s*[:\-]?\s*$/i,
  /^(manufactur(er|ed|ing)?|mfr\.?)\s*(by|name)?\s*[:\-]?\s*$/i,
];
const isLabelOnly = (line: string) => LABEL_ONLY_PATTERNS.some((p) => p.test(line.trim()));
const matchesAnyField = (line: string) => Object.values(FIELD_PATTERNS).some((p) => p.test(line));
const NON_TITLE_WORDS = /\b(image|photo|logo|placeholder|insert|barcode|sample photo|click here)\b/i;

/** Clean and normalise OCR text for more reliable matching */
function cleanText(s: string): string {
  return (s || '')
    .replace(/\u00A0/g, ' ') // non-breaking space
    .replace(/[\u2018\u2019\u201C\u201D]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Attempt to fix common OCR confusions (O vs 0, l vs 1, I vs 1), and normalise punctuation */
function normalizeOcrLine(s: string): string {
  let out = s;
  // Some safe replacements: when adjacent to digits, O -> 0, I/l -> 1
  out = out.replace(/(?<=\d)[Oo](?=\d)/g, '0');
  out = out.replace(/\bO(?=\d)/g, '0');
  out = out.replace(/\bO\b/g, '0');
  out = out.replace(/\bI\b/g, '1');
  // Replace common diacritics / OCR broken currency tokens
  out = out.replace(/Rs\.?/ig, 'Rs');
  out = out.replace(/INR/ig, 'Rs');
  out = out.replace(/₹/g, 'Rs');
  // Fix common delimiters
  out = out.replace(/[•··]/g, '.').replace(/[\u2013\u2014‑]/g, '-');
  // Remove isolated invalid characters
  out = out.replace(/[^\S\r\n]+/g, ' ');
  return cleanText(out);
}

function unionBbox(a?: Annotation['boundingPoly'], b?: Annotation['boundingPoly']): Annotation['boundingPoly'] | undefined {
  const verts = [...(a?.vertices || []), ...(b?.vertices || [])];
  if (!verts.length) return undefined;
  const xs = verts.map((v) => v.x ?? 0);
  const ys = verts.map((v) => v.y ?? 0);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { vertices: [{ x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }] };
}

/** Merges a label-only line ("Manufacturer:") with the line(s) immediately
 *  after it. Also supports label on one line and value on following line(s)
 *  that look like an address (multiple tokens, commas, company suffixes).
 */
function mergeBrokenLabelLines(lines: string[], lineAnnotations: Annotation[]) {
  const mergedLines: string[] = [];
  const annotationMap = new Map<string, Annotation>();
  const findAnno = (line: string) => lineAnnotations.find((a) => a.description === line);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // If label-only and next line is not a label, merge them. Also allow multi-line address merging if next few lines look like address.
    if (isLabelOnly(line) && i + 1 < lines.length && !isLabelOnly(lines[i + 1])) {
      let combined = cleanText(`${line} ${lines[i + 1]}`);
      let bbox = unionBbox(findAnno(line)?.boundingPoly, findAnno(lines[i + 1])?.boundingPoly);
      // If the next line looks like part of an address (comma, city names, 'Pvt', 'Ltd', digits), include a third line as well.
      if (i + 2 < lines.length && /,|\b(pvt|ltd|limited|road|street|nagar|city|india|pvt\.? ltd)/i.test(lines[i + 2])) {
        combined = cleanText(`${combined} ${lines[i + 2]}`);
        bbox = unionBbox(bbox, findAnno(lines[i + 2])?.boundingPoly);
        i += 1; // will be incremented below too
      }
      mergedLines.push(combined);
      if (bbox) annotationMap.set(combined, { description: combined, boundingPoly: bbox, level: 'line' });
      i++;
      continue;
    }
    // If this line + next line together form label:value where label is separated by newline, merge them (e.g., "MRP" then "Rs 50")
    if (!isLabelOnly(line) && i + 1 < lines.length && isLabelOnly(lines[i + 1]) && !isLabelOnly(line)) {
      mergedLines.push(line);
      const a = findAnno(line);
      if (a) annotationMap.set(line, a);
      continue;
    }
    mergedLines.push(line);
    const a = findAnno(line);
    if (a) annotationMap.set(line, a);
  }
  return { lines: mergedLines, annotations: annotationMap };
}

/** Single best title candidate: largest text, near the top, that isn't a
 *  label/value line and isn't UI chrome.
 */
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
    .filter((m) => m.letterCount >= 2 && m.line.length <= 60 && !NON_TITLE_WORDS.test(m.line) && !isLabelOnly(m.line) && !matchesAnyField(m.line));

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
    // Split to lines, normalize and remove empty
    const rawLines = ocrText.split(/\r?\n/).map((l) => normalizeOcrLine(l)).map(cleanText).filter(Boolean);
    const lineAnnotations = ocrAnnotations.filter((a) => a.level !== 'word');
    const now = new Date().toISOString();

    const nameResult = detectProductName(rawLines, lineAnnotations);
    const name = cleanText(productName) || nameResult?.text || selectedProduct || 'Unknown product';

    const { lines, annotations: mergedAnnoMap } = mergeBrokenLabelLines(rawLines, lineAnnotations);
    const findBbox = (line: string) => mergedAnnoMap.get(line)?.boundingPoly ?? lineAnnotations.find((a) => a.description === line)?.boundingPoly;

    const assignedLineIdx = new Set<number>();
    const found: Record<string, { value: string; bbox?: Annotation['boundingPoly'] }> = {};

    // Pass 1: Try to extract using strict patterns with capturing groups
    lines.forEach((line, idx) => {
      if (assignedLineIdx.has(idx)) return;
      if (nameResult && line === nameResult.text) return;

      for (const field of FIELD_ORDER) {
        if (found[field]) continue;
        const pat = FIELD_PATTERNS[field];
        const m = pat.exec(line);
        if (m) {
          let val = '';
          // Prefer captured group 1 when present
          if (m[1]) val = cleanText(m[1]);
          else val = cleanText(m[0]);

          // Small field-specific normalizations
          if (field === 'mrp') {
            // Extract only the number with currency
            const num = val.match(/(?:Rs\.?\s*)?([\d,]+(?:[.,]\d+)?)/i);
            val = num ? `Rs ${num[1].replace(/,/g, '')}` : val;
          } else if (field === 'date_of_manufacture') {
            // Try to normalise separators
            val = val.replace(/\s+/, ' ');
            // no deep parsing here; keep as-found
          } else if (field === 'net_quantity') {
            val = val.replace(/\s+/g, ' ').replace(/\b(gm|gms)\b/i, 'g');
          } else if (field === 'country_of_origin') {
            // If it captured "Country of Origin: India" as whole; extract the tail
            const parts = val.split(/[:\-]/);
            if (parts.length > 1) val = cleanText(parts.slice(1).join(' '));
          } else if (field === 'consumer_care') {
            // if email/phone found, take it
            const email = val.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
            const phone = val.match(/\+?\d[\d\s\-]{6,}\d/);
            const url = val.match(/https?:\/\/[^\s,;]+/i);
            val = email ? email[0] : (phone ? phone[0] : (url ? url[0] : val));
          }

          found[field] = { value: val, bbox: findBbox(line) };
          assignedLineIdx.add(idx);
          break;
        }
      }
    });

    // Pass 2: Heuristics / neighboring lines for fields not captured in pass 1
    const companySuffixPattern = /\b(pvt|pvt\.? ltd|ltd|limited|private limited|co\.?|co|inc|llp|l\.l\.p)\b/i;
    for (let i = 0; i < lines.length; i++) {
      if (assignedLineIdx.has(i)) continue;
      const line = lines[i];

      // Manufacturer heuristics: if line looks like a company (suffix) or starts with "Mfg:" etc
      if (!found.manufacturer) {
        if (companySuffixPattern.test(line) || /^(mfr|manufacturer|manufactured by|mfg|mfg by)\b/i.test(line)) {
          // Combine this line with next 1-2 lines if they look like address
          let combined = line;
          let bbox = findBbox(line);
          if (i + 1 < lines.length && /,|\d{3,6}|\b(street|road|nagar|city|pincode|pin)\b/i.test(lines[i + 1])) {
            combined = `${combined} ${lines[i + 1]}`;
            bbox = unionBbox(bbox, findBbox(lines[i + 1]));
            assignedLineIdx.add(i + 1);
          }
          found.manufacturer = { value: cleanText(combined.replace(/^(manufactur(?:er|ed|ing)?|mfr\.?)[\:\-]?\s*/i, '')), bbox };
          assignedLineIdx.add(i);
          continue;
        }
      }

      // Try to pick up MRP present as "$ 50" but label on previous line
      if (!found.mrp && i > 0 && /^(mrp|m\.r\.p\.?|price)\b/i.test(lines[i - 1]) && /[\d₹RsINR]/.test(line)) {
        const num = line.match(/(?:Rs\.?\s*)?([\d,]+(?:[.,]\d+)?)/i);
        if (num) {
          found.mrp = { value: `Rs ${num[1].replace(/,/g, '')}`, bbox: findBbox(line) };
          assignedLineIdx.add(i);
          assignedLineIdx.add(i - 1);
          continue;
        }
      }

      // Net quantity might be standalone like "200 ml"
      if (!found.net_quantity) {
        const m = line.match(/^\s*(\d+(?:[.,]\d+)?(?:\s*[xX]\s*\d+)?\s*(?:g|kg|ml|l|ltr|oz|mg))\b/i);
        if (m) {
          found.net_quantity = { value: cleanText(m[1]), bbox: findBbox(line) };
          assignedLineIdx.add(i);
          continue;
        }
      }

      // Batch number fallback: look for standalone patterns like "Batch: AB12/34"
      if (!found.batch_number) {
        const m = line.match(/\b(batch|lot)\b[:\s\-]*([A-Z0-9\/\-_\.]{3,30})/i);
        if (m) {
          found.batch_number = { value: cleanText(m[2]), bbox: findBbox(line) };
          assignedLineIdx.add(i);
          continue;
        }
      }

      // Consumer care: if line contains phone/email
      if (!found.consumer_care) {
        const email = line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
        const phone = line.match(/\+?\d[\d\s\-]{6,}\d/);
        const url = line.match(/https?:\/\/[^\s,;]+/i);
        if (email || phone || url) {
          const value = email?.[0] ?? phone?.[0] ?? url?.[0];
        
          if (value) {
            found.consumer_care = {
              value,
              bbox: findBbox(line),
            };
            assignedLineIdx.add(i);
            continue;
          }
        }
      }

      // Country fallback: "Made in India"
      if (!found.country_of_origin) {
        const m = line.match(/\b(made in|origin)\b[:\s\-]*([A-Za-z ]{2,40})/i);
        if (m) {
          found.country_of_origin = { value: cleanText(m[2]), bbox: findBbox(line) };
          assignedLineIdx.add(i);
          continue;
        }
      }

      // Date fallback: any date-like pattern
      if (!found.date_of_manufacture) {
        const m = line.match(/(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*\d{2,4})/i);
        if (m) {
          found.date_of_manufacture = { value: cleanText(m[1]), bbox: findBbox(line) };
          assignedLineIdx.add(i);
          continue;
        }
      }
    }

    // Manufacturer name/address post-processing if manufacturer captured loosely
    let manufacturerName = '';
    let manufacturerAddress = '';
    let manufacturerBbox: Annotation['boundingPoly'] | undefined;
    if (found.manufacturer) {
      manufacturerBbox = found.manufacturer.bbox;
      const raw = found.manufacturer.value.replace(/^(manufactur(er|ed|ing)?|mfr\.?)\s*(by|name)?[:\s]+/i, '').trim();
      // If comma present, split into name and address
      const commaIdx = raw.indexOf(',');
      if (commaIdx > -1) {
        manufacturerName = cleanText(raw.slice(0, commaIdx));
        manufacturerAddress = cleanText(raw.slice(commaIdx + 1));
      } else {
        // If raw contains company suffix, treat whole raw as name and try to find subsequent address lines
        if (companySuffixPattern.test(raw)) {
          manufacturerName = cleanText(raw);
        } else {
          // If short name (<5 words) consider as name; otherwise treat as address
          const words = raw.split(/\s+/);
          if (words.length <= 5) manufacturerName = cleanText(raw);
          else manufacturerAddress = cleanText(raw);
        }
      }
    }

    // If we still don't have manufacturer address, look for nearby address-like lines not assigned yet
    if (!manufacturerAddress) {
      const addressLineIdx = lines.findIndex(
        (line, idx) => !assignedLineIdx.has(idx) && (!nameResult || line !== nameResult.text) &&
          /(\b\d{5,6}\b|pincode|pin|road|street|nagar|city|india|pvt\.?\s*ltd|ltd|limited|factory|office)/i.test(line)
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
    createInspection(inspector?.id, inspector?.name, inspector?.badge_number, extractionResult.product_name, extractionResult.category, location || 'Unknown');
    if (uploadedImageUrl) addProductImage(uploadedImageUrl);
    if (annotations.length) addOcrAnnotations(annotations);

    Object.entries(extractionResult.extractions).forEach(([field, data]) => {
      const mockFinding: Finding = {
        field,
        rule_id: `R${Math.floor(Math.random() * 10) + 1}`.padStart(3, '0'),
        ai_extraction: (data as any).value,
        ai_confidence: (data as any).confidence,
        ai_recommendation: (data as any).status === 'extracted' ? 'PASS' : 'NEEDS_REVIEW',
        evidence_link: uploadedImageUrl || '',
        reason: (data as any).flag || 'Data extracted from OCR',
        bounding_box: (data as any).bounding_box || '',
      };
      addFinding(mockFinding);
    });

    setTimeout(() => router.push('/verify'), 50);
  };

  const computeBoxStyle = (vertices?: Vertex[]) => {
    if (!imgRef.current || !vertices || vertices.length === 0) return { display: 'none' } as React.CSSProperties;
    const img = imgRef.current;
    const natW = img.naturalWidth || 1, natH = img.naturalHeight || 1;
    const displayW = img.clientWidth || 0, displayH = img.clientHeight || 0;
    if (!displayW || !displayH) return { display: 'none' } as React.CSSProperties;
    const isNormalized = vertices.every((v) => (v.x || 0) <= 1 && (v.y || 0) <= 1);
    const scaled = vertices.map((v) => ({ x: (v.x || 0) * (isNormalized ? natW : 1), y: (v.y || 0) * (isNormalized ? natH : 1) }));
    const scaleX = displayW / natW, scaleY = displayH / natH;
    const xs = scaled.map((v) => v.x * scaleX), ys = scaled.map((v) => v.y * scaleY);
    const left = Math.min(...xs), top = Math.min(...ys), right = Math.max(...xs), bottom = Math.max(...ys);
    return { left: `${left}px`, top: `${top}px`, width: `${Math.max(1, right - left)}px`, height: `${Math.max(1, bottom - top)}px` } as React.CSSProperties;
  };

  const hasSelected = uploaderRef.current?.hasSelected() ?? false;

  // Boxes that were actually USED to fill a field — these get the orange
  // "used" treatment and are clickable to jump to that field.
  const usedBoxes: { field: string; vertices: Vertex[] }[] = [];
  if (extractionResult) {
    Object.entries(extractionResult.extractions).forEach(([field, data]) => {
      const bboxStr = (data as any).bounding_box;
      if (!bboxStr) return;
      try {
        const vertices = JSON.parse(bboxStr)?.vertices;
        if (vertices?.length) usedBoxes.push({ field, vertices });
      } catch {}
    });
  }

  const selectField = (field: string) => {
    setActiveField(field);
    const el = fieldRefs.current[field];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus();
    }
  };

  return (
    <>
      <Head><title>Scan & Extract - DevDrishti</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">📷 Scan & Extract</h1>
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-800 font-medium">← Back to Dashboard</Link>
          </div>
        </header>

        <main className={`mx-auto px-4 py-8 ${extractionResult ? 'max-w-7xl' : 'max-w-4xl'}`}>
          {!extractionResult ? (
            <div className="bg-white rounded-lg shadow p-8">
              <h2 className="text-xl font-bold text-gray-800 mb-6">Product Details</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Mock Product</label>
                  <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Choose a product...</option>
                    {products.map((p) => (<option key={p} value={p}>{mockOCRDatabase[p as keyof typeof mockOCRDatabase].product_name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Product Name (Override)</label>
                  <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Enter product name (optional)" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select category...</option>
                    <option value="FMCG - Personal Care">FMCG - Personal Care</option>
                    <option value="FMCG - Cooking Oil">FMCG - Cooking Oil</option>
                    <option value="Food - Biscuits">Food - Biscuits</option>
                    <option value="Food - Dairy">Food - Dairy</option>
                    <option value="Medicines">Medicines</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Store Location</label>
                  <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g., Mumbai Store, Bangalore Market" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="bg-gray-50 p-4 rounded">
                  <h3 className="font-semibold">Upload / Take Picture</h3>
                  <p className="text-sm text-gray-600 mb-3">Use your device camera or upload an image of the product label.</p>
                  <ImageUploader ref={uploaderRef} onResult={handleOcrResult} autoUpload={false} />
                  {hasSelected && !extractionResult && <p className="text-sm text-gray-600 mt-2">File ready — click "Upload image to OCR" to extract values.</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={handleExtractFallback} disabled={isExtracting} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition-colors">
                    Use selected mock product
                  </button>
                  <button
                    onClick={async () => {
                      if (!uploaderRef.current) { alert('Choose an image first.'); return; }
                      try { setUploaderRunning(true); await uploaderRef.current.uploadSelected(); }
                      catch (err) { console.error('OCR upload error', err); alert('OCR upload failed — check console/logs.'); setUploaderRunning(false); }
                    }}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-4 rounded-lg transition-colors"
                  >
                    {uploaderRunning ? 'Processing OCR…' : 'Upload image to OCR'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow p-8 lg:flex lg:gap-8 lg:items-start">
                {uploadedImageUrl && (
                  <div className="lg:w-1/2 lg:sticky lg:top-8 mb-6 lg:mb-0">
                    <div className="relative inline-block w-full">
                      <img ref={imgRef} src={uploadedImageUrl} alt="uploaded" style={{ maxWidth: '100%', height: 'auto', display: 'block' }} onLoad={bumpOverlay} />
                      <div key={overlayTick} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
                        {/* All scanned text — blue, informational only, click-through */}
                        {annotations.filter((a) => a.level !== 'word').map((a, i) => (
                          <div key={`scan-${i}`} style={{ position: 'absolute', pointerEvents: 'none', border: '2px solid rgba(59,130,246,0.55)', background: 'rgba(59,130,246,0.08)', borderRadius: 4, ...computeBoxStyle(a.boundingPoly?.vertices) }} />
                        ))}
                        {/* Boxes actually used for a field — orange, clickable, turns green when active */}
                        {usedBoxes.map(({ field, vertices }, i) => {
                          const active = activeField === field;
                          return (
                            <div
                              key={`used-${field}-${i}`}
                              onClick={() => selectField(field)}
                              title={`Click to jump to "${field.replace(/_/g, ' ')}"`}
                              style={{
                                position: 'absolute',
                                cursor: 'pointer',
                                pointerEvents: 'auto',
                                border: active ? '3px solid rgba(22,163,74,0.95)' : '2px solid rgba(249,115,22,0.9)',
                                background: active ? 'rgba(22,163,74,0.20)' : 'rgba(249,115,22,0.14)',
                                borderRadius: 4,
                                boxShadow: active ? '0 0 0 2px rgba(255,255,255,0.7)' : 'none',
                                transition: 'background 0.15s, border 0.15s',
                                ...computeBoxStyle(vertices),
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-3">
                      <span className="inline-block w-3 h-3 align-middle mr-1 rounded-sm" style={{ background: 'rgba(59,130,246,0.35)', border: '1px solid rgba(59,130,246,0.7)' }} /> scanned text &nbsp;
                      <span className="inline-block w-3 h-3 align-middle mr-1 rounded-sm" style={{ background: 'rgba(249,115,22,0.3)', border: '1px solid rgba(249,115,22,0.9)' }} /> used in a field (click it) &nbsp;
                      <span className="inline-block w-3 h-3 align-middle mr-1 rounded-sm" style={{ background: 'rgba(22,163,74,0.3)', border: '1px solid rgba(22,163,74,0.9)' }} /> currently selected
                    </p>
                  </div>
                )}

                <div className="lg:w-1/2">
                  <h2 className="text-xl font-bold text-gray-800 mb-6">Extraction Results</h2>
                  <div className="space-y-4">
                    {Object.entries(extractionResult.extractions).map(([field, data]) => (
                      <div key={field} className={`border rounded-lg p-4 transition-colors ${activeField === field ? 'border-green-400 bg-green-50' : 'border-gray-200'}`}>
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <h3 className="font-bold text-gray-800 capitalize">{field.replace(/_/g, ' ')}</h3>
                            <input
                              ref={(el) => { fieldRefs.current[field] = el; }}
                              type="text"
                              value={(data as any).value}
                              onFocus={() => setActiveField(field)}
                              onBlur={() => setActiveField((cur) => (cur === field ? null : cur))}
                              onChange={(e) => {
                                setExtractionResult((prev) => {
                                  if (!prev) return prev;
                                  return { ...prev, extractions: { ...prev.extractions, [field]: { ...(prev.extractions as any)[field], value: e.target.value, status: 'extracted' } } };
                                });
                              }}
                              className={`mt-1 w-full px-3 py-2 border rounded ${activeField === field ? 'border-green-500 ring-2 ring-green-200' : 'border-gray-300'}`}
                            />
                          </div>
                          <div className="text-right">
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${(data as any).status === 'extracted' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                              {(data as any).status === 'extracted' ? '✓ Extracted' : '⚠ Review'}
                            </span>
                            <p className="text-xs text-gray-500 mt-2">{Math.round((data as any).confidence * 100)}% confidence</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button onClick={() => { setExtractionResult(null); setUploadedImageUrl(null); setAnnotations([]); }} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg transition-colors">Reset</button>
                <button onClick={handleStartInspection} disabled={!extractionResult} className={`flex-1 font-bold py-2 px-4 rounded-lg transition-colors ${extractionResult ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-300 text-gray-600'}`}>
                  ✓ Continue to Verification
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
