// Inspector Interface
export interface Inspector {
  id: string;
  name: string;
  email: string;
  password: string;
  department: string;
  region: string;
  role: 'Senior Inspector' | 'Inspector' | 'Junior Inspector' | 'Admin';
  permissions: string[];
  badge_number: string;
}

// Extracted Field
export interface ExtractedField {
  value: string;
  confidence: number;
  bounding_box: string;
  status: 'extracted' | 'needs_review' | 'missing';
  flag?: string;
}

// Extraction Result
export interface ExtractionResult {
  product_id: string;
  product_name: string;
  category: string;
  timestamp: string;
  extractions: {
    product_name: ExtractedField;
    net_quantity: ExtractedField;
    mrp: ExtractedField;
    manufacturer_name: ExtractedField;
    manufacturer_address: ExtractedField;
    date_of_manufacture: ExtractedField;
    consumer_care: ExtractedField;
    country_of_origin: ExtractedField;
    batch_number: ExtractedField;
  };
}

// Compliance Rule
export interface ComplianceRule {
  rule_id: string;
  name: string;
  category: string;
  requirement: string;
  mandatory_for: string;
  legal_reference: string;
  validation_logic: any;
}

// Finding
export interface Finding {
  field: string;
  rule_id: string;
  ai_extraction: string;
  ai_confidence: number;
  ai_recommendation: 'PASS' | 'POTENTIAL_ISSUE' | 'NEEDS_REVIEW';
  inspector_decision?: 'ACCEPT' | 'OVERRIDE' | 'EDIT';
  inspector_note?: string;
  final_value?: string;
  decision_timestamp?: string;
  evidence_link: string;
  reason: string;
  bounding_box?: string;
}

// Inspection Report
export interface InspectionReport {
  inspection_id: string;
  product_name: string;
  category: string;
  inspector: {
    id: string;
    name: string;
    badge_number: string;
    department: string;
    region: string;
    signature: string;
  };
  created_at: string;
  updated_at: string;
  findings: Finding[];
  overall_status: 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_FURTHER_ACTION';
  violations_count: number;
  store_location?: string;
  product_images: string[];
  ocr_annotations?: any[];
  audit_log: AuditLogEntry[];
}

// Audit Log Entry
export interface AuditLogEntry {
  timestamp: string;
  action: string;
  details?: string;
  by: string;
}

// Mock Product
export interface MockProduct {
  id: string;
  name: string;
  category: string;
  image_filename: string;
  actual_details: any;
}
