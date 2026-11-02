import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ApiService } from '../commanapiservice/Api_service';
import { DOCTORS } from './opd_service';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  doctorId?: string | null;  // sent by the API for doctor accounts
  doctor_id?: string | null; // same, if the API uses snake_case
}

export interface LoginResponse {
  message: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
}

/**
 * Optional manual link, used when the API does not send a doctor id.
 * Key: login email in lower case. Value: the id exactly as it appears in DOCTORS.
 */
export const DOCTOR_BY_EMAIL: Record<string, string> = {
  // 'anitha@clinic.com': 'A',
};

const ACCESS = 'accessToken';
const REFRESH = 'refreshToken';
const EXPIRES = 'expiresAt';
const USER = 'clinic4u_user';

/** "Dr. Anitha Rao" and "anitha rao" give the same key. */
const nameKey = (s: string) => s.toLowerCase().replace(/^dr\.?\s*/, '').replace(/[^a-z]/g, '');

/**
 * Finds which doctor profile a login belongs to, in this order:
 * 1. the id sent by the API  2. DOCTOR_BY_EMAIL  3. a matching name in DOCTORS.
 * Always returns the id spelled as in DOCTORS, so comparisons with visits succeed.
 */
function resolveDoctorId(u: AuthUser | null): string | null {
  if (!u || (u.role ?? '').toLowerCase() !== 'doctor') return null;

  const canonical = (id: string) => DOCTORS.find(d => String(d.id).toLowerCase() === id.toLowerCase())?.id ?? id;

  const sent = u.doctorId ?? u.doctor_id;
  if (sent) return canonical(String(sent));

  const mapped = DOCTOR_BY_EMAIL[(u.email ?? '').toLowerCase()];
  if (mapped) return canonical(mapped);

  const key = nameKey(u.name ?? '');
  return key ? (DOCTORS.find(d => nameKey(d.name) === key)?.id ?? null) : null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private router = inject(Router);
  private api = inject(ApiService);

  // Same storage as the tokens, so user and token can't drift apart
  readonly user = signal<AuthUser | null>(this.loadUser());
  readonly role = computed(() => this.user()?.role ?? null);
  readonly isLoggedIn = computed(() => !!this.user());
  readonly doctorId = computed(() => resolveDoctorId(this.user()));

  login(email: string, password: string): Observable<LoginResponse> {
    return this.api.post<LoginResponse>('auth/login', { email, password }).pipe(
      tap((res) => this.storeSession(res)),
      catchError((err: HttpErrorResponse) => this.handleError(err)),
    );
  }

  logout(): void {
    [ACCESS, REFRESH, EXPIRES, USER].forEach((k) => sessionStorage.removeItem(k));
    this.user.set(null);
    this.router.navigate(['/login']);
  }

  getAccessToken(): string | null {
    return sessionStorage.getItem(ACCESS);
  }

  private storeSession(res: LoginResponse): void {
    sessionStorage.setItem(ACCESS, res.accessToken);
    sessionStorage.setItem(REFRESH, res.refreshToken);
    sessionStorage.setItem(EXPIRES, String(Date.now() + res.expiresIn * 1000));
    sessionStorage.setItem(USER, JSON.stringify(res.user));
    this.user.set(res.user);
  }

  private loadUser(): AuthUser | null {
    try {
      // Treat an expired session as logged out
      const exp = Number(sessionStorage.getItem(EXPIRES) ?? 0);
      if (!this.getAccessToken() || Date.now() > exp) return null;
      return JSON.parse(sessionStorage.getItem(USER) ?? 'null');
    } catch {
      return null;
    }
  }

  private handleError(err: HttpErrorResponse) {
    let message = 'Could not sign in. Check your email and password and try again.';
    if (err.status === 0) message = 'Could not reach the server. Check your connection and try again.';
    else if (err.status === 401) message = 'Incorrect email or password.';
    else if (err.error?.message) message = err.error.message;
    return throwError(() => new Error(message));
  }
}