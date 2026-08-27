import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useInspectionStore } from '@/store/inspectionStore';
import { useAuthStore } from '@/store/authStore';
import rulesDatabase from '@/data/rulesDatabase.json';

export default function Verify() {
  const router = useRouter();
  const inspector = useAuthStore((state) => state.inspector);
  const currentInspection = useInspectionStore((state) => state.currentInspection);
  const updateFinding = useInspectionStore((state) => state.updateFinding);
  const completeInspection = useInspectionStore((state) => state.completeInspection);
  const saveToHistory = useInspectionStore((state) => state.saveToHistory);

  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!inspector || !currentInspection) {
      router.push('/scan');
    }
  }, []);

  if (!currentInspection || currentFieldIndex >= currentInspection.findings.length) {
    return <div>Loading...</div>;
  }

  const finding = currentInspection.findings[currentFieldIndex];
  const rule = rulesDatabase.rules.find((r) => r.rule_id === finding.rule_id);

  const handleDecision = (decision: 'ACCEPT' | 'OVERRIDE' | 'EDIT', finalValue?: string) => {
    updateFinding(finding.field, decision, finalValue);

    if (currentFieldIndex < currentInspection.findings.length - 1) {
      setCurrentFieldIndex(currentFieldIndex + 1);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    // Determine overall status
    const hasNonCompliant = currentInspection.findings.some(
      (f) => f.ai_recommendation === 'NEEDS_REVIEW'
    );
    
    completeInspection(hasNonCompliant ? 'NEEDS_FURTHER_ACTION' : 'COMPLIANT');
    saveToHistory();

    setTimeout(() => {
      router.push('/history');
    }, 1000);
  };

  return (
    <>
      <Head>
        <title>Verify Findings - DevDrishti</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow">
          <div className="max-w-4xl mx-auto px-4 py-6">
            <h1 className="text-2xl font-bold text-gray-900">✓ Verify Findings</h1>
            <p className="text-gray-600">Product: {currentInspection.product_name}</p>
          </div>
        </header>

        {/* Progress Bar */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">
                Field {currentFieldIndex + 1} of {currentInspection.findings.length}
              </span>
              <span className="text-sm font-medium text-gray-700">
                {Math.round(((currentFieldIndex + 1) / currentInspection.findings.length) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${((currentFieldIndex + 1) / currentInspection.findings.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow p-8">
            {/* Field Name & Rule */}
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-800 capitalize mb-2">
                {finding.field.replace(/_/g, ' ')}
              </h2>
              {rule && (
                <p className="text-gray-600 text-sm">
                  <strong>Rule:</strong> {rule.requirement}
                </p>
              )}
            </div>

            {/* AI Extraction */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <h3 className="font-bold text-gray-800 mb-2">🤖 AI Extraction</h3>
              <div className="text-lg text-gray-900 font-mono bg-white p-3 rounded border border-blue-300 mb-2">
                {finding.ai_extraction}
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Confidence: {Math.round(finding.ai_confidence * 100)}%</span>
                <span>Recommendation: {finding.ai_recommendation}</span>
              </div>
            </div>

            {/* Decision Buttons */}
            <div className="space-y-3 mb-6">
              <button
                onClick={() => handleDecision('ACCEPT')}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors text-left"
              >
                ✓ Accept
                <span className="text-sm block text-green-100">Use AI extraction as-is</span>
              </button>
              <button
                onClick={() => handleDecision('EDIT', prompt('Enter corrected value:', finding.ai_extraction) || finding.ai_extraction)}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-4 rounded-lg transition-colors text-left"
              >
                ✎ Edit
                <span className="text-sm block text-amber-100">Correct the value</span>
              </button>
              <button
                onClick={() => handleDecision('OVERRIDE')}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-colors text-left"
              >
                ✕ Mark as Violation
                <span className="text-sm block text-red-100">Field doesn't meet requirements</span>
              </button>
            </div>

            {/* Navigation */}
            <div className="flex gap-4 pt-4 border-t border-gray-200">
              <button
                onClick={() => setCurrentFieldIndex(Math.max(0, currentFieldIndex - 1))}
                disabled={currentFieldIndex === 0}
                className="flex-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-800 font-bold py-2 px-4 rounded-lg transition-colors"
              >
                ← Previous
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                {isSubmitting ? '⏳ Submitting...' : '✓ Complete Inspection'}
              </button>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
