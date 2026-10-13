export type RangeKey = '7d' | '30d';
export type Tone = 'green' | 'blue' | 'purple' | 'orange';

export interface Kpi { key: string; label: string; value: string; change: number; tone: Tone; spark: number[]; lowerIsBetter?: boolean; }
export interface DoctorStat { name: string; specialty: string; visits: number; color: string; }
export interface Slice { label: string; count: number; color: string; }
export interface RecentVisit { at: string; patient: string; mrn: string; doctor: string; reason: string; status: VisitStatus; }
export type VisitStatus = 'Waiting for Vitals' | 'Ready for Doctor' | 'In Consultation' | 'Completed';

export interface ReportData {
  rangeLabel: string;
  kpis: Kpi[];
  trend: { labels: string[]; values: number[] };
  doctors: DoctorStat[];
  gender: Slice[];
  ageGroups: { label: string; count: number }[];
  reasons: Slice[];
  recent: RecentVisit[];
}