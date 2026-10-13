export type Priority = 'Routine' | 'Urgent' | 'Emergency';
export type QueueStatus = 'Waiting for Vitals' | 'Ready for Doctor' | 'In Consultation' | 'Completed';
export const STATUSES: QueueStatus[] = ['Waiting for Vitals', 'Ready for Doctor', 'In Consultation', 'Completed'];
export const PRIORITIES: Priority[] = ['Routine', 'Urgent', 'Emergency'];

export interface Vitals {
  systolic: number; diastolic: number; pulse: number; respRate: number; temperature: number; spo2: number;
  weight: number | null; height: number | null;
  chiefComplaint: string; priority: Priority; allergies: string; nursingNotes: string;
}

export interface QueuePatient {
  id: string; token: string; name: string; mrn: string; age: number; sex: 'M' | 'F';
  doctor: string; specialty: string; status: QueueStatus; arrivedAt: string; vitals: Vitals | null;
}