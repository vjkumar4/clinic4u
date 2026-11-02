export type Gender = 'Male' | 'Female';
export type VisitType = 'New Consultation' | 'Follow-up' | 'Review' | 'Others';
export type PatientStatus = 'In Consultation' | 'Ready for Doctor' | 'Waiting for Vitals' | 'Completed';
export type KpiIcon = 'user' | 'calendar' | 'users' | 'clock';
export type KpiTone = 'purple' | 'green' | 'blue' | 'orange';

export interface Kpi { id: string; label: string; value: number; note: string; icon: KpiIcon; tone: KpiTone; }
export interface VisitPoint { label: string; count: number; }
export interface VisitTypeSlice { label: VisitType; count: number; color: string; }
export interface GenderSlice { label: Gender; count: number; color: string; }

export interface TodayPatient {
  id: string;
  mrn: string;
  name: string;
  age: number;
  gender: Gender;
  phone: string;
  visitType: VisitType;
  lastVisit: string;            // ISO date
  status: PatientStatus;
  vitals: { bp: string; spo2: number } | null;
  notes: string;
}

export interface DoctorOverview {
  doctor: { name: string };
  kpis: Kpi[];
  visits: VisitPoint[];         // last 7 days ending on the selected date
  visitTypes: VisitTypeSlice[];
  genders: GenderSlice[];
  patients: TodayPatient[];     // patients for the selected date
}