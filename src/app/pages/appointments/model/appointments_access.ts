import { Role } from '../../../roles/role_config';   // adjust the path

export interface ApptCaps {
  book: boolean;       // "New appointment" button
  confirm: boolean;    // Scheduled -> Confirmed
  checkIn: boolean;    // Confirmed -> Checked-in (creates the OPD token)
  cancel: boolean;
  noShow: boolean;
  pickDoctor: boolean; // show the doctor filter
  ownOnly: boolean;    // user sees only their own appointments
}

const VIEW_ONLY: ApptCaps = { book: false, confirm: false, checkIn: false, cancel: false, noShow: false, pickDoctor: true, ownOnly: false };
const NONE: ApptCaps = { ...VIEW_ONLY, pickDoctor: false };

/** To change who can do what on this page, edit this table. */
export const APPT_CAPS: Record<Role, ApptCaps> = {
  receptionist: { book: true, confirm: true, checkIn: true, cancel: true, noShow: true, pickDoctor: true, ownOnly: false },
  doctor:       { ...VIEW_ONLY, pickDoctor: false, ownOnly: true },
  nurse:        VIEW_ONLY,
  admin:        { book: true, confirm: true, checkIn: true, cancel: true, noShow: true, pickDoctor: true, ownOnly: false },
};

export const apptCapsFor = (role: string | null): ApptCaps =>
  APPT_CAPS[(role ?? '').trim().toLowerCase() as Role] ?? NONE;