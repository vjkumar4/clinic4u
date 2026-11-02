export type NoteLanguage = 'English' | 'Tamil';

export interface Vitals {
  temperatureC: number;
  pulse: number;
  systolic: number;
  diastolic: number;
  spo2: number;
  weightKg: number;
}

/** What the page knows about the patient. No name or phone is ever sent to the AI. */
export interface PatientContext {
  id: string;
  age: number;
  gender: 'F' | 'M' | 'O';
  allergies: string[];
  vitals?: Vitals; // recorded by the nurse
}

export interface DraftRequest {
  patientId: string;       // backend looks up context itself; the id is not personal data for the AI
  doctorNotes: string;     // the doctor's short points
  language: NoteLanguage;
}

export interface NoteDraft {
  complaints: string;
  history: string;
  examination: string;
  diagnosis: string;
  advice: string;
  followUp: string;
}

export interface SaveNoteRequest {
  patientId: string;
  note: NoteDraft;
  aiGenerated: boolean;    // for the audit log
  doctorEdited: boolean;   // did the doctor change the AI text?
  reviewedByDoctor: true;  // save is blocked until the doctor confirms
}

export const EMPTY_NOTE: NoteDraft = {
  complaints: '', history: '', examination: '', diagnosis: '', advice: '', followUp: '',
};