import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Patient,PatientService } from '../../../services/patient_service';

@Component({
  selector: 'app-patients',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './viewpatients.html',
  styleUrl: './viewpatients.scss',
  host: { '(document:keydown.escape)': 'selected.set(null); confirm.set(null)' },
})
export class PatientsviewComponent {
  store = inject(PatientService);
  readonly size = 8;
  genders = ['All', 'Male', 'Female', 'Other'];

  q = signal('');
  gender = signal('All');
  sort = signal<'recent' | 'name' | 'age'>('recent');
  page = signal(1);
  selected = signal<Patient | null>(null);
  confirm = signal<Patient | null>(null);

  all = this.store.patients;

  filtered = computed(() => {
    const q = this.q().toLowerCase().trim(), g = this.gender();
    const l = this.all().filter(p => (g === 'All' || p.gender === g) &&
      (!q || [p.firstName, p.lastName, p.id, p.phone, p.email].join(' ').toLowerCase().includes(q)));
    const s = this.sort();
    return [...l].sort((a, b) => s === 'name' ? this.name(a).localeCompare(this.name(b))
      : s === 'age' ? (this.age(b) ?? 0) - (this.age(a) ?? 0) : b.createdAt.localeCompare(a.createdAt));
  });
  last = computed(() => Math.min(Math.min(this.page(), this.pages()) * this.size, this.filtered().length));
  cur = computed(() => Math.min(this.page(), this.pages()));
  pages = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.size)));
  pageList = computed(() => Array.from({ length: this.pages() }, (_, i) => i + 1));
  paged = computed(() => { const p = Math.min(this.page(), this.pages()); return this.filtered().slice((p - 1) * this.size, p * this.size); });

  stats = computed(() => {
    const l = this.all(), week = Date.now() - 7 * 86400000;
    return [
      { label: 'Total patients', value: l.length, tone: 'green', icon: 'M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
      { label: 'Added this week', value: l.filter(p => +new Date(p.createdAt) > week).length, tone: 'blue', icon: 'M12 5v14M5 12h14' },
      { label: 'With allergies', value: l.filter(p => p.allergies.length).length, tone: 'rose', icon: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z' },
      { label: 'Chronic conditions', value: l.filter(p => p.conditions.length).length, tone: 'amber', icon: 'M22 12h-4l-3 9L9 3l-3 9H2' },
    ];
  });

  setQuery(v: string) { this.q.set(v); this.page.set(1); }
  setGender(g: string) { this.gender.set(g); this.page.set(1); }

  name = (p: Patient) => `${p.firstName} ${p.lastName}`.trim();
  initials = (p: Patient) => ((p.firstName[0] ?? '') + (p.lastName[0] ?? '')).toUpperCase();
  tone = (p: Patient) => 't' + ([...p.id].reduce((a, c) => a + c.charCodeAt(0), 0) % 5);
  age(p: Patient): number | null {
    if (!p.dob) return null;
    const a = Math.floor((Date.now() - new Date(p.dob).getTime()) / 31557600000);
    return a >= 0 && a < 130 ? a : null;
  }
  fmt = (iso: string) => iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  bmi(p: Patient) { return p.height && p.weight ? (p.weight / (p.height / 100) ** 2).toFixed(1) : ''; }

  sections(p: Patient) {
    return [
      { title: 'Personal', rows: [['Date of birth', this.fmt(p.dob)], ['Blood group', p.bloodGroup], ['Marital status', p.marital], ['Occupation', p.occupation]] },
      { title: 'Contact', rows: [['Mobile', p.phone], ['Alternate', p.altPhone], ['Email', p.email], ['Address', [p.address, p.city, p.state, p.zip].filter(Boolean).join(', ')]] },
      { title: 'Vitals', rows: [['Height', p.height ? p.height + ' cm' : ''], ['Weight', p.weight ? p.weight + ' kg' : ''], ['BMI', this.bmi(p)]] },
      { title: 'Notes', rows: [['Medications', p.medications], ['Past surgeries & notes', p.history]] },
      { title: 'Emergency contact', rows: [['Name', p.ecName], ['Relationship', p.ecRelation], ['Phone', p.ecPhone]] },
      { title: 'Insurance', rows: [['Provider', p.insurer], ['Policy number', p.policy], ['Valid till', this.fmt(p.validTill)]] },
    ];
  }

  remove() {
    const p = this.confirm(); if (!p) return;
    this.store.remove(p.id);
    if (this.selected()?.id === p.id) this.selected.set(null);
    this.confirm.set(null);
  }
}