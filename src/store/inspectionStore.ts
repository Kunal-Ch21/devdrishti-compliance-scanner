import { create } from 'zustand';
import { InspectionReport, Finding } from '@/types';

interface InspectionState {
  currentInspection: InspectionReport | null;
  inspectionHistory: InspectionReport[];
  createInspection: (
    inspectorId?: string,
    inspectorName?: string,
    inspectorBadge?: string,
    productName?: string,
    category?: string,
    location?: string
  ) => string;
  addFinding: (finding: Finding) => void;
  addProductImage: (imageUrl: string) => void;
  addOcrAnnotations: (annotations: any[]) => void;
  updateFinding: (fieldName: string, decision: string, finalValue?: string, note?: string) => void;
  completeInspection: (overallStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_FURTHER_ACTION') => void;
  saveToHistory: () => void;
  getInspectionHistory: () => InspectionReport[];
  getInspectionById: (id: string) => InspectionReport | undefined;
  clearCurrentInspection: () => void;
}

export const useInspectionStore = create<InspectionState>((set, get) => ({
  currentInspection: null,
  inspectionHistory: (() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('inspection_history');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  })(),

  createInspection: (inspectorId, inspectorName, inspectorBadge, productName, category, location) => {
    // allow anonymous creation when inspectorId is not provided
    const id = inspectorId || `ANON-${Math.random().toString(36).slice(2, 8)}`;
    const name = inspectorName || 'Guest Inspector';
    const badge = inspectorBadge || 'N/A';

    const inspectionId = `INS-${new Date().toISOString().split('T')[0]}-${Math.random().toString().slice(2, 6)}`;

    const newInspection: InspectionReport = {
      inspection_id: inspectionId,
      product_name: productName || '',
      category: category || '',
      inspector: {
        id,
        name,
        badge_number: badge,
        department: '',
        region: '',
        signature: `${name.replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10).replace(/-/g, '_')}`,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      findings: [],
      overall_status: 'COMPLIANT',
      violations_count: 0,
      store_location: location || '',
      product_images: [],
      ocr_annotations: [],
      audit_log: [
        {
          timestamp: new Date().toISOString(),
          action: 'inspection_created',
          by: id,
        },
      ],
    };

    set({ currentInspection: newInspection });
    return inspectionId;
  },

  addFinding: (finding) => {
    set((state) => {
      if (!state.currentInspection) return state;
      return {
        currentInspection: {
          ...state.currentInspection,
          findings: [...state.currentInspection.findings, finding],
          audit_log: [
            ...state.currentInspection.audit_log,
            {
              timestamp: new Date().toISOString(),
              action: `finding_added_${finding.field}`,
              by: state.currentInspection.inspector.id,
            },
          ],
        },
      };
    });
  },

  addProductImage: (imageUrl) => {
    set((state) => {
      if (!state.currentInspection) return state;
      return {
        currentInspection: {
          ...state.currentInspection,
          product_images: [...state.currentInspection.product_images, imageUrl],
        },
      };
    });
  },

  addOcrAnnotations: (annotations) => {
    set((state) => {
      if (!state.currentInspection) return state;
      return {
        currentInspection: {
          ...state.currentInspection,
          ocr_annotations: [...(state.currentInspection.ocr_annotations || []), ...annotations],
        },
      };
    });
  },

  updateFinding: (fieldName, decision, finalValue, note) => {
    set((state) => {
      if (!state.currentInspection) return state;
      const updatedFindings = state.currentInspection.findings.map((f) =>
        f.field === fieldName
          ? {
              ...f,
              inspector_decision: decision as 'ACCEPT' | 'OVERRIDE' | 'EDIT',
              final_value: finalValue || f.ai_extraction,
              inspector_note: note,
              decision_timestamp: new Date().toISOString(),
            }
          : f
      );

      return {
        currentInspection: {
          ...state.currentInspection,
          findings: updatedFindings,
          audit_log: [
            ...state.currentInspection.audit_log,
            {
              timestamp: new Date().toISOString(),
              action: `finding_updated_${fieldName}_${decision}`,
              by: state.currentInspection.inspector.id,
            },
          ],
        },
      };
    });
  },

  completeInspection: (overallStatus) => {
    set((state) => {
      if (!state.currentInspection) return state;
      const violations = state.currentInspection.findings.filter((f) => f.ai_recommendation !== 'PASS').length;

      return {
        currentInspection: {
          ...state.currentInspection,
          overall_status: overallStatus,
          violations_count: violations,
          updated_at: new Date().toISOString(),
          audit_log: [
            ...state.currentInspection.audit_log,
            {
              timestamp: new Date().toISOString(),
              action: `inspection_completed_${overallStatus}`,
              by: state.currentInspection.inspector.id,
            },
          ],
        },
      };
    });
  },

  saveToHistory: () => {
    set((state) => {
      if (!state.currentInspection) return state;
      const alreadySaved = state.inspectionHistory.some(
        (i) => i.inspection_id === state.currentInspection!.inspection_id
      );
      // Replace the existing entry instead of appending a duplicate if this
      // inspection_id was already saved (e.g. a stray double-submit).
      const updated = alreadySaved
        ? state.inspectionHistory.map((i) =>
            i.inspection_id === state.currentInspection!.inspection_id ? state.currentInspection! : i
          )
        : [...state.inspectionHistory, state.currentInspection];
      localStorage.setItem('inspection_history', JSON.stringify(updated));
      return {
        inspectionHistory: updated,
      };
    });
  },

  getInspectionHistory: () => {
    return get().inspectionHistory;
  },

  getInspectionById: (id) => {
    return get().inspectionHistory.find((i) => i.inspection_id === id);
  },

  clearCurrentInspection: () => {
    set({ currentInspection: null });
  },
}));
