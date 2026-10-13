export interface Medicine { name: string; dose: string; frequency: string; duration: string; instructions: string; }

export interface PastVisit { date: string; diagnosis: string; doctor: string; }

export interface TriageVitals {
  systolic: number; diastolic: number; pulse: number; respRate: number; temperature: number; spo2: number;
  weight: number | null; height: number | null;
}

export interface ConsultationNotes { symptoms: string; examination: string; diagnosis: string; advice: string; followUp: string; }

export interface ConsultationRecord {
  visitId: string; token: string; startedAt: string; // ISO time
  patient: { name: string; mrn: string; age: number; sex: 'M' | 'F'; phone: string; allergies: string };
  doctor: string; priority: 'Routine' | 'Urgent' | 'Emergency';
  chiefComplaint: string; nursingNotes: string;
  vitals: TriageVitals;
  history: PastVisit[];
  notes: ConsultationNotes; medicines: Medicine[]; tests: string[];
}

/** What the page sends when saving a draft or completing. */
export interface ConsultationPayload { notes: ConsultationNotes; medicines: Medicine[]; tests: string[]; }