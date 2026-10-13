
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ApiService } from '../commanapiservice/Api_service';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
}

@Injectable({ providedIn: 'root' })
export class AuthService {

 private router = inject(Router);
  private KEY = 'clinic4u_user';
 
  user = signal<{ email: string } | null>(JSON.parse(localStorage.getItem(this.KEY) ?? 'null'));
  //isLoggedIn = computed(() => !!this.user());



  private api = inject(ApiService);

  login(email: string, password: string): Observable<LoginResponse> {
    return this.api.post<LoginResponse>('auth/login', { email, password }).pipe(
      tap((res) => this.storeSession(res)),
      catchError((err: HttpErrorResponse) => this.handleError(err))
    );
  }

  logout(): void {
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('expiresAt');
  }

  getAccessToken(): string | null {
    return sessionStorage.getItem('accessToken');
  }

  isLoggedIn(): boolean {
    return !!this.getAccessToken();
  }

  private storeSession(res: LoginResponse): void {
    sessionStorage.setItem('accessToken', res.accessToken);
    sessionStorage.setItem('refreshToken', res.refreshToken);
    sessionStorage.setItem('expiresAt', String(Date.now() + res.expiresIn * 1000));
  }

  private handleError(err: HttpErrorResponse) {
    let message = 'Could not sign in. Check your email and password and try again.';

    if (err.status === 0) {
      message = 'Could not reach the server. Check your connection and try again.';
    } else if (err.status === 401) {
      message = 'Incorrect email or password.';
    } else if (err.error?.message) {
      message = err.error.message;
    }

    return throwError(() => new Error(message));
  }
}