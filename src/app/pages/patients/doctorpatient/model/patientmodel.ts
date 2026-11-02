export type Gender = 'Male' | 'Female' | 'Other';
export type PatientStatus = 'Stable' | 'Follow-up due' | 'Critical' | 'New';
export type SortField = 'name' | 'age' | 'lastVisit';
export type SortDir = 'asc' | 'desc';

export interface Patient {
  id: string;
  uhid: string;            // hospital / MRN number
  name: string;
  age: number;
  gender: Gender;
  phone: string;
  bloodGroup: string;
  conditions: string[];
  allergies: string[];
  lastVisit: string;       // ISO date (yyyy-mm-dd)
  lastDiagnosis: string;
  nextFollowUp?: string;   // ISO date
  status: PatientStatus;
}

/** Sent to the API as query params. The server does the filtering, sorting and paging. */
export interface PatientQuery {
  search: string;
  gender: 'All' | Gender;
  status: 'All' | PatientStatus;
  sort: SortField;
  dir: SortDir;
  page: number;            // 1-based
  pageSize: number;
}

export interface PatientSummary { total: number; critical: number; followUpDue: number; newThisMonth: number; }

export interface PatientPage {
  items: Patient[];        // only the current page
  total: number;           // total rows matching the filters
  summary: PatientSummary; // counts across all patients (for the KPI cards)
}