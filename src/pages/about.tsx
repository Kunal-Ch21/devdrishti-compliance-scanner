import { useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function About() {
  return (
    <>
      <Head>
        <title>About DevDrishti</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow">
          <div className="max-w-4xl mx-auto px-4 py-6 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">🏛️ DevDrishti</h1>
            <Link href="/" className="text-blue-600 hover:text-blue-800 font-medium">
              ← Home
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-4 py-12 space-y-8">
          {/* Overview */}
          <section className="bg-white rounded-lg shadow p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Overview</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              <strong>DevDrishti</strong> is an AI-powered compliance scanner designed to assist legal metrology inspectors in verifying packaged commodity compliance with the <strong>Legal Metrology (Packaged Commodities) Rules, 2011</strong>.
            </p>
            <p className="text-gray-700 leading-relaxed">
              The system uses computer vision and OCR to extract product label data, which is then validated against regulatory requirements. However, final decisions always rest with trained inspectors.
            </p>
          </section>

          {/* Key Features */}
          <section className="bg-white rounded-lg shadow p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Key Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-bold text-lg text-gray-800 mb-2">📷 AI Image Recognition</h3>
                <p className="text-gray-700 text-sm">Automatic extraction of product label data using OCR and computer vision</p>
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-800 mb-2">✓ Smart Verification</h3>
                <p className="text-gray-700 text-sm">Inspector reviews AI recommendations with confidence scores</p>
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-800 mb-2">📋 Digital Reports</h3>
                <p className="text-gray-700 text-sm">Generate compliance reports with evidence trails and audit logs</p>
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-800 mb-2">📊 Analytics Dashboard</h3>
                <p className="text-gray-700 text-sm">Track compliance trends and inspector performance metrics</p>
              </div>
            </div>
          </section>

          {/* Legal Framework */}
          <section className="bg-white rounded-lg shadow p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Legal Framework</h2>
            <div className="space-y-4 text-sm text-gray-700">
              <p>
                <strong>Jurisdiction:</strong> Ministry of Consumer Affairs, Food & Public Distribution, Government of India
              </p>
              <p>
                <strong>Applicable Rules:</strong> Legal Metrology (Packaged Commodities) Rules, 2011
              </p>
              <p>
                <strong>Key Compliance Areas:</strong>
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Product name and common description</li>
                <li>Net quantity in standard metric units</li>
                <li>Maximum Retail Price (MRP) with tax inclusion statement</li>
                <li>Manufacturer/Packer details and address</li>
                <li>Date of manufacture/packing</li>
                <li>Consumer care information</li>
                <li>Country of origin</li>
                <li>Font size and legibility requirements</li>
              </ul>
            </div>
          </section>

          {/* How It Works */}
          <section className="bg-white rounded-lg shadow p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">How It Works</h2>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">1</div>
                <div>
                  <h3 className="font-bold text-gray-800">Upload Product Image</h3>
                  <p className="text-gray-600 text-sm">Inspector uploads or selects a product image</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">2</div>
                <div>
                  <h3 className="font-bold text-gray-800">AI Extraction</h3>
                  <p className="text-gray-600 text-sm">System extracts label data with confidence scores</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">3</div>
                <div>
                  <h3 className="font-bold text-gray-800">Inspector Verification</h3>
                  <p className="text-gray-600 text-sm">Inspector reviews each finding and makes decisions</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">4</div>
                <div>
                  <h3 className="font-bold text-gray-800">Generate Report</h3>
                  <p className="text-gray-600 text-sm">Digital report with audit trail and evidence</p>
                </div>
              </div>
            </div>
          </section>

          {/* Technology Stack */}
          <section className="bg-white rounded-lg shadow p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Technology Stack</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="font-bold text-gray-800">Frontend</p>
                <p className="text-gray-600">Next.js, React, TypeScript</p>
              </div>
              <div>
                <p className="font-bold text-gray-800">Styling</p>
                <p className="text-gray-600">Tailwind CSS</p>
              </div>
              <div>
                <p className="font-bold text-gray-800">State Management</p>
                <p className="text-gray-600">Zustand</p>
              </div>
              <div>
                <p className="font-bold text-gray-800">OCR Engine</p>
                <p className="text-gray-600">Cloud Vision API</p>
              </div>
              <div>
                <p className="font-bold text-gray-800">Storage</p>
                <p className="text-gray-600">Cloud Firestore</p>
              </div>
              <div>
                <p className="font-bold text-gray-800">Deployment</p>
                <p className="text-gray-600">Firebase / GCP</p>
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="text-center bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg p-8">
            <h2 className="text-2xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="mb-6 text-blue-100">Login with your inspector credentials to begin compliance scanning</p>
            <Link
              href="/login"
              className="inline-block bg-white text-blue-600 px-8 py-3 rounded-lg font-bold hover:bg-blue-50 transition-colors"
            >
              🔐 Inspector Login
            </Link>
          </section>
        </main>
      </div>
    </>
  );
}
