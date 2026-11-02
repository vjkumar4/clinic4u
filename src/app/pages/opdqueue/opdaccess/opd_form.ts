import { FormBuilder, Validators } from '@angular/forms';
import { Priority } from '../../../services/opd_service';

export type Field = {
  key: string; label?: string; kind?: 'select' | 'textarea' | 'custom'; type?: string; ph?: string;
  opts?: string[]; span?: boolean; unit?: string; req?: boolean;
};

export const CONDITIONS = ['Diabetes', 'Hypertension', 'Asthma', 'Heart disease', 'Thyroid', 'Arthritis', 'Kidney disease'];
export const GENDERS = ['Male', 'Female', 'Other'];
export const PRIORITIES: { v: Priority; label: string }[] = [
  { v: 'normal', label: 'Normal' }, { v: 'priority', label: 'Priority' }, { v: 'emergency', label: 'Emergency' },
];

export const REG_SECTIONS: { title: string; fields: Field[] }[] = [
  { title: 'Personal details', fields: [
    { key: 'firstName', label: 'First name', req: true, ph: 'Priya' }, { key: 'lastName', label: 'Last name', req: true, ph: 'Sharma' },
    { key: 'dob', label: 'Date of birth', type: 'date', req: true },
    { key: 'bloodGroup', label: 'Blood group', kind: 'select', opts: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
    { key: 'gender', kind: 'custom', span: true },
    { key: 'marital', label: 'Marital status', kind: 'select', opts: ['Single', 'Married', 'Divorced', 'Widowed'] },
    { key: 'occupation', label: 'Occupation' } ] },
  { title: 'Contact & address', fields: [
    { key: 'phone', label: 'Mobile number', type: 'tel', req: true, ph: '+91 98765 43210' },
    { key: 'altPhone', label: 'Alternate number', type: 'tel' },
    { key: 'email', label: 'Email address', type: 'email', span: true }, { key: 'address', label: 'Street address', span: true },
    { key: 'city', label: 'City' }, { key: 'state', label: 'State' }, { key: 'zip', label: 'PIN / postal code' } ] },
  { title: 'Medical profile', fields: [
    { key: 'height', label: 'Height', type: 'number', unit: 'cm' }, { key: 'weight', label: 'Weight', type: 'number', unit: 'kg' },
    { key: 'allergies', kind: 'custom', span: true }, { key: 'conditions', kind: 'custom', span: true },
    { key: 'medications', label: 'Current medications', kind: 'textarea', span: true },
    { key: 'history', label: 'Past surgeries & notes', kind: 'textarea', span: true } ] },
  { title: 'Emergency contact & insurance', fields: [
    { key: 'ecName', label: 'Emergency contact name', req: true },
    { key: 'ecRelation', label: 'Relationship', kind: 'select', req: true, opts: ['Spouse', 'Parent', 'Child', 'Sibling', 'Friend', 'Other'] },
    { key: 'ecPhone', label: 'Emergency phone', type: 'tel', req: true, span: true },
    { key: 'insurer', label: 'Insurance provider' }, { key: 'policy', label: 'Policy number' },
    { key: 'validTill', label: 'Valid till', type: 'date', span: true },
    { key: 'consent', kind: 'custom', span: true } ] },
];

export function buildRegForm(fb: FormBuilder, defaultDoctorId: string) {
  const phone = Validators.pattern(/^[0-9+\-\s]{7,15}$/);
  return fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]], lastName: ['', Validators.required],
    dob: ['', Validators.required], gender: ['', Validators.required],
    bloodGroup: [''], marital: [''], occupation: [''],
    phone: ['', [Validators.required, phone]], altPhone: ['', phone], email: ['', Validators.email],
    address: [''], city: [''], state: [''], zip: [''],
    height: fb.control<number | null>(null, [Validators.min(30), Validators.max(250)]),
    weight: fb.control<number | null>(null, [Validators.min(1), Validators.max(500)]),
    medications: [''], history: [''],
    ecName: ['', Validators.required], ecRelation: ['', Validators.required], ecPhone: ['', [Validators.required, phone]],
    insurer: [''], policy: [''], validTill: [''], consent: [false, Validators.requiredTrue],
    doctorId: [defaultDoctorId, Validators.required], priority: ['normal' as Priority], reason: ['', Validators.required],
  });
}

export type RegValue = ReturnType<ReturnType<typeof buildRegForm>['getRawValue']>;

/** The patient part of the form: drops the consent and visit fields. */
export function toPatientInfo(raw: RegValue) {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const { consent, doctorId, priority, reason, ...info } = raw;
  return info;
}