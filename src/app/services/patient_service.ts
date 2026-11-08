import { Injectable, inject, signal } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { ApiService } from '../commanapiservice/Api_service';
import { AuthService } from './Auth_service'; // adjust the path
import { ApiPatient, NewPatient, Patient, PatientMapper } from '../pages/patients/addpatients/model/addpatient.model';

// Re-exported so existing imports from the service keep working
export type { Patient, NewPatient } from '../pages/patients/addpatients/model/addpatient.model';

/**
 * Endpoints (relative to the ApiService base URL):
 *   GET     patients        -> ApiPatient[]
 *   POST    patients        -> ApiPatient
 *   PUT     patients/:id    -> ApiPatient
 *   DELETE  patients/:id    -> 204
 */
@Injectable({ providedIn: 'root' })
export class PatientService {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  readonly patients = signal<Patient[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() { this.refresh(); }

  refresh(): void {
    this.loading.set(true);
    this.api.get<ApiPatient[]>('patients').pipe(map(PatientMapper.fromApiList)).subscribe({
      next: (list) => { this.patients.set(list); this.error.set(null); this.loading.set(false); },
      error: (e) => { this.error.set(this.message(e)); this.loading.set(false); },
    });
  }

  add$(p: NewPatient): Observable<Patient> {
    return this.api.post<ApiPatient>('general/add_patients', PatientMapper.toApi(p, this.auth.user()?.id)).pipe(
      map(PatientMapper.fromApi),
      tap((saved) => this.patients.update((l) => [saved, ...l])),
      catchError((e) => this.fail(e)),
    );
  }

  update$(id: string, patch: Partial<NewPatient>): Observable<Patient> {
    const current = this.patients().find((p) => p.id === id);
    if (!current) { return throwError(() => new Error('Patient not found')); }
    const { id: _i, createdAt: _c, ...rest } = current;
    const body = PatientMapper.toApi({ ...rest, ...patch }, this.auth.user()?.id);
    return this.api.put<ApiPatient>(`patients/${id}`, body).pipe(
      map(PatientMapper.fromApi),
      tap((saved) => this.patients.update((l) => l.map((p) => (p.id === id ? saved : p)))),
      catchError((e) => this.fail(e)),
    );
  }

  remove$(id: string): Observable<void> {
    return this.api.delete<void>(`patients/${id}`).pipe(
      tap(() => this.patients.update((l) => l.filter((p) => p.id !== id))),
      catchError((e) => this.fail(e)),
    );
  }

  /* Fire-and-forget versions (screen updates first, rolls back on failure) */
  update(id: string, patch: Partial<NewPatient>): void {
    if (!this.patients().some((p) => p.id === id)) { return; }
    this.patients.update((l) => l.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    this.update$(id, patch).subscribe({ error: () => this.refresh() });
  }

  remove(id: string): void {
    this.patients.update((l) => l.filter((p) => p.id !== id));
    this.remove$(id).subscribe({ error: () => this.refresh() });
  }

  add(p: NewPatient): void { this.add$(p).subscribe({ error: () => {} }); }

  private fail(e: any) {
    const msg = this.message(e);
    this.error.set(msg);
    return throwError(() => new Error(msg));
  }

  private message(e: any): string {
    if (e?.status === 0) return 'Cannot reach the server. Check your connection and try again.';
    if (e?.status === 401) return 'Your session has expired. Please sign in again.';
    return e?.error?.message ?? e?.message ?? 'Request failed';
  }
}