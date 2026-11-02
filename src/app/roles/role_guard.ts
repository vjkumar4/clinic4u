import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { canOpen, homeFor } from './role_config';

/**
 * Usage in routes:  { path: 'patients', canActivate: [roleGuard], loadComponent: ... }
 * Replace `currentRole()` with however your auth service exposes the role from the login token.
 */
const currentRole = (): string | null => null; // TODO: inject(AuthService).role()

export const roleGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  const role = currentRole();
  if (!role) return router.parseUrl('/login');
  return canOpen(role, state.url) ? true : router.parseUrl(homeFor(role));
};