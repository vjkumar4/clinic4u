export type Period = 7 | 30 | 90;

export interface Consultation {
  id: string;
  patientName: string;
  date: string; // ISO
  mode: 'In-person' | 'Video' | 'Phone';
  durationMin: number;
  reason: string;
  status: 'Completed' | 'Scheduled' | 'Cancelled';
}

export interface PatientVisit {
  id: string;
  patientName: string;
  age: number;
  gender: 'F' | 'M' | 'O';
  visitDate: string; // ISO
  type: 'New' | 'Revisit';
  department: string;
}

export interface DiagnosisTrend {
  diagnosis: string;
  icdCode: string;
  counts: number[]; // one value per label in DoctorReport.trendLabels
  total: number;
  changePct: number; // vs previous period
}

export interface PrescribedMedicine {
  name: string;
  dosage: string;
  days: number;
}

export interface Prescription {
  id: string;
  patientName: string;
  date: string; // ISO
  medicines: PrescribedMedicine[];
  status: 'Active' | 'Completed';
}

export interface FollowUp {
  id: string;
  patientName: string;
  dueDate: string; // ISO
  reason: string;
  status: 'Pending' | 'Done' | 'Overdue';
}

/** Everything on the page belongs to the signed-in doctor only. */
export interface DoctorReport {
  doctorId: string;
  doctorName: string;
  from: string;
  to: string;
  trendLabels: string[];
  consultations: Consultation[];
  visits: PatientVisit[];
  diagnosisTrends: DiagnosisTrend[];
  prescriptions: Prescription[];
  followUps: FollowUp[];
}

export type ReportTab =
  | 'consultations'
  | 'visits'
  | 'diagnosis'
  | 'prescriptions'
  | 'followUps';