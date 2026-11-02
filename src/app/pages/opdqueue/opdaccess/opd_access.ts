import { OpdStatus } from '../../../services/opd_service';

// If your AuthService already exports Role, import it from there instead.
export type Role = 'receptionist' | 'nurse' | 'doctor' | 'admin';

export interface OpdCaps {
  checkIn: boolean;      // "Check in patient" button
  cancel: boolean;       // cancel a token
  startVitals: boolean;  // waiting -> vitals
  finishVitals: boolean; // vitals -> ready (saves vitals)
  callNext: boolean;     // ready -> consult
  complete: boolean;     // consult -> done
  pickDoctor: boolean;   // show the doctor filter chips
  ownOnly: boolean;      // the user sees only their own doctor's patients
  focus: OpdStatus[];    // columns that start open
}

const VIEW_ONLY: OpdCaps = {
  checkIn: false, cancel: false, startVitals: false, finishVitals: false, callNext: false, complete: false,
  pickDoctor: true, ownOnly: false,
  focus: ['waiting', 'vitals', 'ready', 'consult'],
};

/** To change who can do what, edit this table. The component and template follow it. */
export const CAPS: Record<Role, OpdCaps> = {
  receptionist: { ...VIEW_ONLY, checkIn: true, cancel: true },
  nurse:        { ...VIEW_ONLY, startVitals: true, finishVitals: true, focus: ['waiting', 'vitals'] },
  doctor:       { ...VIEW_ONLY, callNext: true, complete: true, pickDoctor: false, ownOnly: true, focus: ['ready', 'consult'] },
  admin:        VIEW_ONLY,
};

/** Used when there is no signed-in user or the role is unknown: sees nothing, does nothing. */
export const NO_CAPS: OpdCaps = {
  checkIn: false, cancel: false, startVitals: false, finishVitals: false, callNext: false, complete: false,
  pickDoctor: false, ownOnly: false,
  focus: [],
};

export const capsFor = (role: string | null): OpdCaps =>
  CAPS[(role ?? '').toLowerCase() as Role] ?? NO_CAPS;