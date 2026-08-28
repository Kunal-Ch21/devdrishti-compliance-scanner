import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useInspectionStore } from '@/store/inspectionStore';
import { InspectionReport } from '@/types';

export default function History() {
  const router = useRouter();
  const history = useInspectionStore((state) => state.inspectionHistory);
  const getInspectionById = useInspectionStore((state) => state.getInspectionById);
  const [selectedInspection, setSelectedInspection] = useState<InspectionReport | null>(null);

  const handleViewReport = (id: string) => {
    const inspection = getInspectionById(id);
    if (inspection) {
      setSelectedInspection(inspection);
    }
  };

  return (
    <>
      <Head>
        <title>Inspection History - DevDrishti</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">📋 Inspection History</h1>
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-800 font-medium">
              ← Back to Dashboard
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 py-8">
          {selectedInspection ? (
            // Detailed Report
            <div className="space-y-6">
              <button
                onClick={() => setSelectedInspection(null)}
                className="text-blue-600 hover:text-blue-800 font-medium mb-4"
              >
                ← Back to List
              </button>

              <div className="bg-white rounded-lg shadow p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">{selectedInspection.product_name}</h2>

                {/* Status Badge */}
                <div className="mb-6 flex gap-4">
                  <span className={`px-4 py-2 rounded-full font-bold ${
                    selectedInspection.overall_status === 'COMPLIANT'
                      ? 'bg-green-100 text-green-800'
                      : selectedInspection.overall_status === 'NON_COMPLIANT'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {selectedInspection.overall_status}
                  </span>
                  <span className="px-4 py-2 rounded-full font-bold bg-blue-100 text-blue-800">
                    {selectedInspection.violations_count} Violations
                  </span>
                </div>

                {/* Inspector Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 pb-8 border-b border-gray-200">
                  <div>
                    <p className="text-gray-600 text-sm">Inspector</p>
                    <p className="font-bold text-gray-900">{selectedInspection.inspector.name}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Badge</p>
                    <p className="font-mono font-bold text-gray-900">{selectedInspection.inspector.badge_number}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Date</p>
                    <p className="font-bold text-gray-900">{new Date(selectedInspection.created_at).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Location</p>
                    <p className="font-bold text-gray-900">{selectedInspection.store_location || 'N/A'}</p>
                  </div>
                </div>

                {/* Findings */}
                <h3 className="text-lg font-bold text-gray-800 mb-4">Findings</h3>
                <div className="space-y-4">
                  {selectedInspection.findings.map((finding, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-gray-800 capitalize">{finding.field.replace(/_/g, ' ')}</h4>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          finding.inspector_decision === 'ACCEPT'
                            ? 'bg-green-100 text-green-800'
                            : finding.inspector_decision === 'OVERRIDE'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {finding.inspector_decision || 'Pending'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">AI Extraction</p>
                          <p className="font-mono text-gray-900">{finding.ai_extraction}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Final Value</p>
                          <p className="font-mono text-gray-900">{finding.final_value || finding.ai_extraction}</p>
                        </div>
                      </div>
                      {finding.inspector_note && (
                        <p className="text-gray-600 text-sm mt-2">Note: {finding.inspector_note}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            // Inspection List
            <div className="bg-white rounded-lg shadow overflow-hidden">
              {history.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-gray-600 mb-4">No inspections yet</p>
                  <Link href="/scan" className="text-blue-600 hover:text-blue-800 font-medium">
                    Start your first inspection →
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-bold text-gray-700">Product</th>
                        <th className="px-6 py-3 text-left text-sm font-bold text-gray-700">Status</th>
                        <th className="px-6 py-3 text-left text-sm font-bold text-gray-700">Date</th>
                        <th className="px-6 py-3 text-left text-sm font-bold text-gray-700">Violations</th>
                        <th className="px-6 py-3 text-left text-sm font-bold text-gray-700">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((inspection) => (
                        <tr key={inspection.inspection_id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div>
                              <p className="font-bold text-gray-900">{inspection.product_name}</p>
                              <p className="text-gray-600 text-sm">{inspection.category}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${
                              inspection.overall_status === 'COMPLIANT'
                                ? 'bg-green-100 text-green-800'
                                : inspection.overall_status === 'NON_COMPLIANT'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {inspection.overall_status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-700">
                            {new Date(inspection.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-bold text-gray-900">{inspection.violations_count}</span>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => handleViewReport(inspection.inspection_id)}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              View Report →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
