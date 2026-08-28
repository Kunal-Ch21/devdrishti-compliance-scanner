import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useInspectionStore } from '@/store/inspectionStore';
import rulesDatabase from '@/data/rulesDatabase.json';

export default function Verify() {
  const router = useRouter();
  const currentInspection = useInspectionStore((s) => s.currentInspection);
  const updateFinding = useInspectionStore((s) => s.updateFinding);
  const completeInspection = useInspectionStore((s) => s.completeInspection);
  const saveToHistory = useInspectionStore((s) => s.saveToHistory);
  const clearCurrentInspection = useInspectionStore((s) => s.clearCurrentInspection);
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localValue, setLocalValue] = useState('');
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!currentInspection) {
      if (!isSubmitting) router.push('/scan');
      return;
    }
    const f = currentInspection.findings[currentFieldIndex];
    setLocalValue(f?.final_value ?? f?.ai_extraction ?? '');
  }, [currentInspection, currentFieldIndex, router, isSubmitting]);

  if (!currentInspection) return <div>Loading...</div>;

  const finding = currentInspection.findings[currentFieldIndex];
  const rule = rulesDatabase.rules.find((r) => r.rule_id === finding.rule_id);

  const imageUrl = currentInspection.product_images?.[0] ?? finding.evidence_link ?? '';
  const annotations = (currentInspection as any).ocr_annotations ?? [];

  const computeBoxStyle = (vertices?: { x?: number; y?: number }[]) => {
    if (!imgRef.current || !vertices || vertices.length === 0) return {};
    const img = imgRef.current;
    const natW = img.naturalWidth || img.width || 1;
    const natH = img.naturalHeight || img.height || 1;
    const displayW = img.clientWidth || 1;
    const displayH = img.clientHeight || 1;
    const isNormalized = vertices.every(v => (v.x || 0) <= 1 && (v.y || 0) <= 1);
    const scaled = vertices.map(v => ({ x: (v.x || 0) * (isNormalized ? natW : 1), y: (v.y || 0) * (isNormalized ? natH : 1) }));
    const scaleX = displayW / natW; const scaleY = displayH / natH;
    const xs = scaled.map(v => v.x * scaleX); const ys = scaled.map(v => v.y * scaleY);
    const left = Math.min(...xs); const top = Math.min(...ys); const right = Math.max(...xs); const bottom = Math.max(...ys);
    return { left: `${left}px`, top: `${top}px`, width: `${Math.max(1, right - left)}px`, height: `${Math.max(1, bottom - top)}px` } as React.CSSProperties;
  };

  const handleDecision = (decision: 'ACCEPT' | 'OVERRIDE' | 'EDIT') => {
    updateFinding(finding.field, decision, localValue);
    if (currentFieldIndex < currentInspection.findings.length - 1) setCurrentFieldIndex(i => i + 1);
    else handleSubmit();
  };

  const handleSubmit = async () => {
    if (isSubmitting) return; // prevent double-submit (e.g. rapid double-click) from saving twice
    setIsSubmitting(true);
    const hasNonCompliant = currentInspection.findings.some(f => f.ai_recommendation === 'NEEDS_REVIEW');
    completeInspection(hasNonCompliant ? 'NEEDS_FURTHER_ACTION' : 'COMPLIANT');
    saveToHistory();
    setTimeout(() => {
      // Remove the completed inspection from the store so revisiting /verify
      // (e.g. via the back button) can't resubmit it and duplicate the history entry.
      clearCurrentInspection();
      router.push('/history');
    }, 700);
  };

  return (
    <>
      <Head><title>Verify Findings</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-4xl mx-auto px-4 py-6">
            <h1 className="text-2xl font-bold">✓ Verify Findings</h1>
            <p className="text-gray-600">Product: {currentInspection.product_name}</p>
          </div>
        </header>

        <div className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm">Field {currentFieldIndex + 1} of {currentInspection.findings.length}</span>
              <span className="text-sm">{Math.round(((currentFieldIndex + 1) / currentInspection.findings.length) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${((currentFieldIndex + 1) / currentInspection.findings.length) * 100}%` }} />
            </div>
          </div>
        </div>

        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow p-8">
            <h2 className="text-xl font-bold mb-2">{finding.field.replace(/_/g, ' ')}</h2>
            {rule && <p className="text-gray-600 text-sm"><strong>Rule:</strong> {rule.requirement}</p>}

            {imageUrl && (
              <div className="mb-6 relative">
                <img ref={imgRef} src={imageUrl} alt="evidence" style={{ maxWidth: '100%', height: 'auto' }} onLoad={() => { /* reflow */ }} />
                <div style={{ position: 'absolute', left:0, top:0, right:0, bottom:0, pointerEvents:'none' }}>
                  {annotations.map((a:any,i:number) => (
                    <div key={i} style={{ position:'absolute', border:'2px solid rgba(59,130,246,0.8)', background:'rgba(59,130,246,0.06)', borderRadius:4, ...computeBoxStyle(a.boundingPoly?.vertices) }} />
                  ))}
                </div>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <h3 className="font-bold mb-2">🤖 AI Extraction</h3>
              <div className="text-lg bg-white p-3 rounded border border-blue-300 mb-2">{finding.ai_extraction}</div>
              <div className="flex justify-between text-sm text-gray-600"><span>Confidence: {Math.round(finding.ai_confidence*100)}%</span><span>Recommendation: {finding.ai_recommendation}</span></div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Final value</label>
              <input type="text" value={localValue} onChange={(e)=>setLocalValue(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
            </div>

            <div className="space-y-3 mb-6">
              <button onClick={()=>handleDecision('ACCEPT')} className="w-full bg-green-600 text-white py-3 rounded-lg">✓ Accept</button>
              <button onClick={()=>handleDecision('EDIT')} className="w-full bg-amber-600 text-white py-3 rounded-lg">✎ Edit</button>
              <button onClick={()=>handleDecision('OVERRIDE')} className="w-full bg-red-600 text-white py-3 rounded-lg">✕ Mark as Violation</button>
            </div>

            <div className="flex gap-4 pt-4 border-t border-gray-200">
              <button onClick={()=>setCurrentFieldIndex(Math.max(0, currentFieldIndex - 1))} disabled={currentFieldIndex===0} className="flex-1 bg-gray-200 py-2 rounded-lg">← Previous</button>
              <button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 bg-blue-600 text-white py-2 rounded-lg">{isSubmitting ? '⏳ Submitting...' : '✓ Complete Inspection'}</button>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
