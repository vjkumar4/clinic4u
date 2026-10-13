import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { ConsultationPayload, ConsultationRecord } from '../pages/consultation/model/consultation.model';

/** true = static sample data. Set to false to call your API. */
const USE_MOCK = true;
const API_BASE = 'http://localhost:3000/api';

/**
 * Endpoints used when USE_MOCK = false:
 *   GET   {API_BASE}/consultations/:visitId             -> ConsultationRecord
 *   PUT   {API_BASE}/consultations/:visitId             -> ConsultationRecord  (save draft, body: ConsultationPayload)
 *   POST  {API_BASE}/consultations/:visitId/complete    -> ConsultationRecord  (body: ConsultationPayload; visit status -> Completed)
 */
@Injectable({ providedIn: 'root' })
export class ConsultationService {
  private readonly http = inject(HttpClient); // add provideHttpClient() in app.config.ts

  get(visitId: string): Observable<ConsultationRecord> {
    return USE_MOCK ? of(sample(visitId)).pipe(delay(500)) : this.http.get<ConsultationRecord>(`${API_BASE}/consultations/${visitId}`);
  }

  saveDraft(visitId: string, body: ConsultationPayload): Observable<ConsultationRecord> {
    if (USE_MOCK) { saved = { ...sample(visitId), ...body }; return of(saved).pipe(delay(400)); }
    return this.http.put<ConsultationRecord>(`${API_BASE}/consultations/${visitId}`, body);
  }

  complete(visitId: string, body: ConsultationPayload): Observable<ConsultationRecord> {
    if (USE_MOCK) { saved = { ...sample(visitId), ...body }; return of(saved).pipe(delay(500)); }
    return this.http.post<ConsultationRecord>(`${API_BASE}/consultations/${visitId}/complete`, body);
  }
}

/* ---------------- static sample data ---------------- */
let saved: ConsultationRecord | null = null;

function sample(visitId: string): ConsultationRecord {
  if (saved && saved.visitId === visitId) { return structuredClone(saved); }
  return {
    visitId, token: 'A-006', startedAt: new Date(Date.now() - 4 * 60_000).toISOString(),
    patient: { name: 'Lakshmi Devi', mrn: 'PT-0006', age: 47, sex: 'F', phone: '+91 98765 43210', allergies: 'Penicillin' },
    doctor: 'Dr. Arun', priority: 'Urgent',
    chiefComplaint: 'Persistent cough and low-grade fever since 3 days',
    nursingNotes: 'Patient is comfortable. Mild wheeze on arrival. Drinking fluids well.',
    vitals: { systolic: 138, diastolic: 88, pulse: 96, respRate: 20, temperature: 38.1, spo2: 95, weight: 62, height: 158 },
    history: [
      { date: '12 Aug 2026', diagnosis: 'Seasonal allergic rhinitis', doctor: 'Dr. Priya' },
      { date: '03 Mar 2026', diagnosis: 'Viral fever', doctor: 'Dr. Arun' },
      { date: '19 Nov 2025', diagnosis: 'Hypertension follow-up', doctor: 'Dr. Arun' }
    ],
    notes: { symptoms: '', examination: '', diagnosis: '', advice: '', followUp: '' },
    medicines: [], tests: []
  };
}