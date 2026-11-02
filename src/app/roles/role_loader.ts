import { Injectable, inject } from '@angular/core';
import { AuthService } from '../services/Auth_service';
import { OpdService } from '../services/opd_service';
import { PatientService } from '../services/patient_service';
import { configFor, LoadKey } from './role_config';

@Injectable({ providedIn: 'root' })
export class RoleLoader {
  private auth = inject(AuthService);
  private opd = inject(OpdService);
  private patients = inject(PatientService);

  /** Call after login, and again on page refresh. */
  loadForCurrentRole() {
    const cfg = configFor(this.auth.role());
    if (!cfg) return;
    cfg.load.forEach(key => this.run(key));
  }

  private run(key: LoadKey) {
    switch (key) {
      case 'opd':          return this.opd.refresh();
      case 'patients':     return;   // e.g. this.patients.load();
      case 'appointments': return;   // e.g. this.appointments.load();
      case 'billing':      return;   // e.g. this.billing.load();
    }
  }
}