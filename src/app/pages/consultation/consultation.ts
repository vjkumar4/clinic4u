import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, catchError, debounceTime, distinctUntilChanged, map, of, switchMap, tap, timer } from 'rxjs';
import { ConsultationService } from '../../services/consultation_service';
import { ConsultationDraft, ConsultationTab, SearchKind, Suggestion } from './model/consultation.model';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-consultation',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe, NgTemplateOutlet],
  templateUrl: './consultation.html',
  styleUrl: './consultation.scss',
})
export class Consultation {
  readonly svc = inject(ConsultationService);
  /** From the route (`consultation/:visitId` + withComponentInputBinding) or <app-consultation visitId="V-1001" />. */
  readonly visitId = input<string>('V-1001');


private route = inject(ActivatedRoute);
patientId = toSignal(this.route.queryParamMap.pipe(map(p => p.get('patientId'))));



  readonly tabs: { id: ConsultationTab; label: string; icon: string }[] = [
    { id: 'complaint', label: 'Complaint', icon: 'M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6' },
    { id: 'vitals', label: 'Vitals', icon: 'M2 12h5l3-7 4 14 3-7h5' },
    { id: 'examination', label: 'Examination', icon: 'M6 3v6a4 4 0 0 0 8 0V3M4 3h4m2 0h4m-8 6v2a6 6 0 0 0 12 0v-1M18 9v7a4 4 0 0 0 4 4' },
    { id: 'diagnosis', label: 'Diagnosis', icon: 'M5 5h14v16H5zM9 5V3h6v2M8 11h8M8 15h6' },
    { id: 'prescription', label: 'Prescription', icon: 'm4 15 7-7a5 5 0 0 1 7 7l-7 7a5 5 0 0 1-7-7ZM8 11l7 7' },
    { id: 'tests', label: 'Tests & Follow-up', icon: 'M9 3h6m-5 0v7l-6 9a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-9V3M7 16h10' },
  ];
  readonly durations = ['1 day', '3 days', '1 week', '2 weeks', '3 weeks', '1 month', 'More than 1 month'];
  readonly severities = ['Mild', 'Moderate', 'Severe'];
  readonly frequencies = ['1-0-1', '1-0-0', '0-0-1', '1-1-1', 'SOS'];
  readonly timings = ['After food', 'Before food', 'Anytime'];
  readonly symptoms = ['Numbness', 'Tingling', 'Pain', 'Swelling', 'Weakness', 'Fatigue'];

  readonly activeTab = signal<ConsultationTab>('complaint');
  readonly query = signal('');
  readonly suggestions = signal<Suggestion[]>([]);
  readonly searching = signal(false);
  readonly review = signal<'preview' | 'complete' | null>(null);
  readonly completing = signal(false);
  readonly toast = signal<{ type: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;
  private readonly search$ = new Subject<{ kind: SearchKind; q: string }>();

  private readonly now = toSignal(timer(0, 1000).pipe(map(() => Date.now())), { initialValue: Date.now() });
  readonly elapsed = computed(() => {
    const start = this.svc.visit()?.startedAt;
    if (!start) return '00:00';
    const s = Math.max(0, Math.floor((this.now() - Date.parse(start)) / 1000));
    const p = (n: number) => String(n).padStart(2, '0');
    return s >= 3600 ? `${Math.floor(s / 3600)}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}` : `${p(Math.floor(s / 60))}:${p(s % 60)}`;
  });
  readonly initials = computed(() =>
    (this.svc.patient()?.name ?? '').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase());

  readonly saveLabel = computed(() => {
    switch (this.svc.saveState()) {
      case 'dirty': return 'Unsaved changes';
      case 'saving': return 'Saving…';
      case 'saved': return 'Saved ' + (this.svc.lastSaved()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) ?? '');
      case 'error': return 'Save failed. Tap to retry';
      default: return 'Auto-save on';
    }
  });

  readonly done = computed<Record<ConsultationTab, boolean>>(() => {
    const d = this.svc.draft();
    return {
      complaint: !!d.complaint.trim(), vitals: (this.svc.visit()?.vitals.length ?? 0) > 0,
      examination: !!(d.examGeneral.trim() || d.examSystem.trim()),
      diagnosis: this.svc.diagnoses().length > 0, prescription: this.svc.prescriptions().length > 0,
      tests: this.svc.investigations().length > 0,
    };
  });
  readonly doneCount = computed(() => Object.values(this.done()).filter(Boolean).length);
  readonly blockers = computed(() => {
    const out: { text: string; tab: ConsultationTab }[] = [];
    if (!this.done().complaint) out.push({ text: 'Enter the chief complaint', tab: 'complaint' });
    if (!this.done().diagnosis) out.push({ text: 'Add at least one diagnosis', tab: 'diagnosis' });
    return out;
  });
  readonly warnings = computed(() =>
    this.svc.prescriptions().filter(p => p.allergyConflict).map(p => `${p.name} conflicts with a recorded allergy`));

  constructor() {
    effect(() => { const id = this.visitId(); untracked(() => this.svc.load(id)); });
    this.search$.pipe(
      debounceTime(250),
      distinctUntilChanged((a, b) => a.kind === b.kind && a.q === b.q),
      tap(({ q }) => this.searching.set(q.trim().length >= 2)),
      switchMap(({ kind, q }) => q.trim().length < 2 ? of([] as Suggestion[])
        : this.svc.search(kind, q.trim()).pipe(catchError(() => of([] as Suggestion[])))),
      takeUntilDestroyed(),
    ).subscribe(r => { this.suggestions.set(r); this.searching.set(false); });
  }

  setTab(tab: ConsultationTab): void { this.activeTab.set(tab); this.query.set(''); this.suggestions.set([]); }
  set(field: keyof ConsultationDraft, value: string): void { this.svc.updateDraft({ [field]: value }); }
  addSymptom(s: string): void {
    const cur = this.svc.draft().complaint.trim();
    if (!cur.toLowerCase().includes(s.toLowerCase())) this.set('complaint', cur ? `${cur}, ${s.toLowerCase()}` : s);
  }

  spark(trend?: number[]): string {
    if (!trend || trend.length < 2) return '';
    const min = Math.min(...trend), max = Math.max(...trend), span = max - min || 1;
    return trend.map((v, i) => `${(i / (trend.length - 1)) * 68 + 1},${18 - ((v - min) / span) * 16}`).join(' ');
  }

  onSearch(kind: SearchKind, q: string): void { this.query.set(q); this.search$.next({ kind, q }); }
  pick(kind: SearchKind, s: Suggestion): void {
    if (kind === 'icd') this.svc.addDiagnosis(s);
    if (kind === 'lab') this.svc.addInvestigation(s);
    if (kind === 'medicine') {
      this.svc.addPrescription(s)
        ? this.notify('warn', `Allergy warning: ${s.name} may conflict with this patient's allergies.`)
        : this.notify('ok', `${s.name} added`);
    }
    this.query.set(''); this.suggestions.set([]);
  }
  addTyped(kind: SearchKind): void {
    const name = this.query().trim();
    if (name) this.pick(kind, { name, code: kind === 'lab' ? 'CUSTOM-' + name.toUpperCase().slice(0, 8) : undefined });
  }

  saveNow(): void {
    this.svc.flush().subscribe({ next: () => this.notify('ok', 'Saved'), error: () => this.notify('err', 'Could not save. Check your connection.') });
  }
  openReview(mode: 'preview' | 'complete'): void {
    const first = this.blockers()[0];
    if (mode === 'complete' && first) { this.notify('err', first.text); this.setTab(first.tab); return; }
    this.review.set(mode);
  }
  confirmComplete(): void {
    this.completing.set(true);
    this.svc.complete().subscribe({
      next: r => { this.completing.set(false); this.review.set(null); this.notify('ok', `Visit completed. Bill ${r.billId} · ₹${r.total}`); },
      error: () => { this.completing.set(false); this.notify('err', 'Could not complete the visit. Please retry.'); },
    });
  }
  retryLoad(): void { this.svc.load(this.visitId()); }
  print(): void { window.print(); }

  private notify(type: 'ok' | 'warn' | 'err', text: string): void {
    clearTimeout(this.toastTimer);
    this.toast.set({ type, text });
    this.toastTimer = setTimeout(() => this.toast.set(null), 3500);
  }
}