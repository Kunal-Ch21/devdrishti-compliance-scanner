# DevDrishti - Legal Metrology Compliance Scanner

🏛️ **AI-powered package compliance scanner for Legal Metrology Rules, 2011**

## Overview

DevDrishti is a prototype application designed to assist legal metrology inspectors in verifying packaged commodity compliance with the **Legal Metrology (Packaged Commodities) Rules, 2011** through automated OCR data extraction and AI-powered verification.

## Project ID: SIH26034

**Ministry:** Ministry of Consumer Affairs, Food & Public Distribution

## Features

✅ **AI-Powered OCR Extraction** - Automatically extracts product label data
✅ **Inspector Verification** - Human-in-the-loop decision making
✅ **Compliance Rules Engine** - Validates against 10+ regulatory requirements
✅ **Digital Reports** - Generate compliant inspection reports with evidence trails
✅ **Audit Logging** - Complete action history for accountability
✅ **Analytics Dashboard** - Track compliance trends and metrics

## Tech Stack

- **Frontend:** Next.js 14, React 18, TypeScript
- **Styling:** Tailwind CSS
- **State Management:** Zustand
- **UI Components:** Custom, no external component libraries
- **Charting:** Recharts
- **PDF Generation:** jsPDF, html2canvas

## Project Structure

```
devdrishti-compliance-scanner/
├── src/
│   ├── pages/          # Next.js pages
│   ├── components/     # Reusable React components
│   ├── store/          # Zustand state stores
│   ├── data/           # Mock databases
│   ├── types/          # TypeScript interfaces
│   └── styles/         # Global CSS
├── public/             # Static assets
├── package.json        # Dependencies
└── README.md          # This file
```

## Quick Start

### Prerequisites
- Node.js 16+
- npm or yarn

### Installation

```bash
# Clone repository
git clone https://github.com/Kunal-Ch21/devdrishti-compliance-scanner.git
cd devdrishti-compliance-scanner

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Demo Credentials

| Inspector ID | Password | Role |
|---|---|---|
| INS-001 | demo123 | Senior Inspector |
| INS-002 | demo456 | Inspector |
| INS-003 | demo789 | Junior Inspector |
| INS-004 | demo321 | Inspector |

## Compliance Checklist

The application verifies compliance with these mandatory fields:

- [ ] Product Name (Rule 4 & 6)
- [ ] Net Quantity in Metric Units (Rule 6)
- [ ] Maximum Retail Price - Inclusive of Taxes (Rule 6)
- [ ] Manufacturer Name & Address (Rule 4)
- [ ] Date of Manufacture/Packing (Rule 5)
- [ ] Consumer Care Details (Rule 6)
- [ ] Country of Origin (Rule 4 & 7)
- [ ] Font Size & Legibility (Rule 3)
- [ ] Allergen Information for Food (FSSAI)
- [ ] Batch/Lot Number for Traceability (Rule 5)

## User Flows

### Inspector Workflow

1. **Login** → Authenticate with credentials
2. **Dashboard** → View stats and recent inspections
3. **Scan** → Upload product image or select mock product
4. **Extract** → AI extracts label data
5. **Verify** → Inspector reviews each finding
6. **Report** → Generate compliance report
7. **History** → View past inspections and reports

## API Integration (Future)

```typescript
// Vision API for OCR
GET /api/extract-from-image

// Compliance checking
GET /api/validate-compliance

// Report generation
POST /api/generate-report

// Analytics
GET /api/analytics/compliance-rate
```

## Data Models

### Inspection Report
```typescript
interface InspectionReport {
  inspection_id: string;
  product_name: string;
  category: string;
  inspector: Inspector;
  created_at: string;
  findings: Finding[];
  overall_status: 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_FURTHER_ACTION';
  violations_count: number;
  audit_log: AuditLogEntry[];
}
```

### Finding
```typescript
interface Finding {
  field: string;
  rule_id: string;
  ai_extraction: string;
  ai_confidence: number;
  ai_recommendation: 'PASS' | 'POTENTIAL_ISSUE' | 'NEEDS_REVIEW';
  inspector_decision: 'ACCEPT' | 'OVERRIDE' | 'EDIT';
  final_value: string;
  inspector_note?: string;
}
```

## Compliance Rules

Rules are stored in `src/data/rulesDatabase.json` with:
- Rule ID and name
- Legal reference
- Validation logic
- Applicability (all products, food only, etc.)

## Mock OCR Database

For demo purposes, sample products are in `src/data/mockOCRDatabase.json`:
- SOAP-001: Premium Soap
- OIL-001: Sunflower Oil
- BISCUIT-001: Butter Crunch Biscuits

## Deployment

### Vercel
```bash
npm run build
vercel deploy
```

### Docker
```bash
docker build -t devdrishti .
docker run -p 3000:3000 devdrishti
```

## Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## Contributing

This is a Smart India Hackathon (SIH) project. For contributions:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -m 'Add feature'`
4. Push to branch: `git push origin feature/your-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see LICENSE file for details.

## Support

For issues, questions, or suggestions:
- 📧 Email: devdrishti@example.com
- 📞 Phone: +91-XXXX-XXXX-XXXX
- 🐛 Bug Reports: GitHub Issues

## Acknowledgments

- Ministry of Consumer Affairs, Food & Public Distribution
- Smart India Hackathon (SIH) 2024
- All participating inspectors and stakeholders

---

**Note:** This is a prototype application developed for demonstration purposes. All inspector credentials and product data are mock/sample data for testing only.
