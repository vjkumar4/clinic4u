export type ConsultationTab = 'complaint' | 'vitals' | 'examination' | 'diagnosis' | 'prescription' | 'tests';
export type SearchKind = 'icd' | 'medicine' | 'lab';
export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export interface Patient {
  id: string; name: string; age: number; sex: string; phone: string; bloodGroup: string;
  visitType: string; token: number; allergies: string[]; conditions: string[];
  lastVisit: string; doctor: string;
}
export interface Vital {
  key: string; label: string; value: string | number; unit: string;
  status: 'Normal' | 'Mild' | 'Review'; trend?: number[];
}
export interface ConsultationDraft {
  complaint: string; duration: string; severity: string; history: string; notes: string;
  examGeneral: string; examSystem: string; reviewOfSystems: string; followUpDate: string;
}
export interface Diagnosis { code: string; name: string; primary: boolean; }
export interface Prescription {
  id: string; name: string; dosage: string; frequency: string; days: number;
  instructions: string; allergyConflict: boolean;
}
export interface Investigation { code: string; name: string; price: number; status: 'Ordered' | 'Pending' | 'Resulted'; }
export interface RecentVisit { date: string; doctor: string; type: string; summary?: string; }

/** Shape returned by GET {api}/visits/:id */
export interface Visit {
  id: string; status: 'InProgress' | 'Completed'; startedAt: string; consultationFee: number;
  patient: Patient; vitals: Vital[]; vitalsRecordedBy: string; vitalsRecordedAt: string;
  insights: string[]; recentVisits: RecentVisit[];
  draft: ConsultationDraft; diagnoses: Diagnosis[]; prescriptions: Prescription[]; investigations: Investigation[];
}
/** Body sent by PUT {api}/visits/:id (auto-save) */
export type VisitSnapshot = Pick<Visit, 'draft' | 'diagnoses' | 'prescriptions' | 'investigations'>;

export interface Suggestion { code?: string; name: string; detail?: string; price?: number; }
export interface CompleteResult { billId: string; total: number; completedAt: string; }