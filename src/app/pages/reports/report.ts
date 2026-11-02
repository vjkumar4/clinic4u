import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DoctorReport, Period, ReportTab } from './model/report.model';
import { DoctorReportService } from '../../services/report_service';

@Component({
  selector: 'app-doctor-report',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule],
  templateUrl: './report.html',
  styleUrl: './report.scss',
})
export class DoctorReportComponent {
  private readonly service = inject(DoctorReportService);

  readonly tabs: { key: ReportTab; label: string }[] = [
    { key: 'consultations', label: 'My consultations' },
    { key: 'visits', label: 'My patient visits' },
    { key: 'diagnosis', label: 'My diagnosis trends' },
    { key: 'prescriptions', label: 'My prescriptions' },
    { key: 'followUps', label: 'My follow-ups' },
  ];

  readonly period = signal<Period>(30);
  readonly tab = signal<ReportTab>('consultations');
  readonly search = signal('');
  readonly report = signal<DoctorReport | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  constructor() {
    // reload whenever the period changes
    effect(() => this.load(this.period()));
  }

  private load(p: Period) {
    this.loading.set(true);
    this.error.set('');
    this.service.getMyReport(p).subscribe({
      next: r => { this.report.set(r); this.loading.set(false); },
      error: () => {
        this.error.set('Could not load your report. Check your connection and try again.');
        this.loading.set(false);
      },
    });
  }

  retry() { this.load(this.period()); }

  setPeriod(v: string) { this.period.set(Number(v) as Period); }

  private match(text: string) {
    const q = this.search().trim().toLowerCase();
    return !q || text.toLowerCase().includes(q);
  }

  readonly consultations = computed(() =>
    (this.report()?.consultations ?? []).filter(c => this.match(c.patientName + ' ' + c.reason)));
  readonly visits = computed(() =>
    (this.report()?.visits ?? []).filter(v => this.match(v.patientName + ' ' + v.department)));
  readonly prescriptions = computed(() =>
    (this.report()?.prescriptions ?? []).filter(p =>
      this.match(p.patientName + ' ' + p.medicines.map(m => m.name).join(' '))));
  readonly followUps = computed(() =>
    (this.report()?.followUps ?? []).filter(f => this.match(f.patientName + ' ' + f.reason)));
  readonly trends = computed(() => this.report()?.diagnosisTrends ?? []);

  /** Tallest bar across all trends, used to scale the mini charts. */
  readonly trendMax = computed(() =>
    Math.max(1, ...this.trends().flatMap(t => t.counts)));

  readonly kpis = computed(() => {
    const r = this.report();
    if (!r) return [];
    return [
      { label: 'Consultations', value: r.consultations.length },
      { label: 'Patient visits', value: r.visits.length },
      { label: 'Prescriptions', value: r.prescriptions.length },
      { label: 'Follow-ups due', value: r.followUps.filter(f => f.status !== 'Done').length },
    ];
  });

  medicineSummary(p: { medicines: { name: string; dosage: string; days: number }[] }) {
    return p.medicines.map(m => `${m.name} ${m.dosage} × ${m.days}d`).join(', ');
  }

  exportCsv() {
    const r = this.report();
    if (!r) return;
    const rows: string[] = ['Section,Patient,Date,Detail,Status'];
    r.consultations.forEach(c => rows.push(['Consultation', c.patientName, c.date, `${c.mode} - ${c.reason}`, c.status].join(',')));
    r.visits.forEach(v => rows.push(['Visit', v.patientName, v.visitDate, v.type, ''].join(',')));
    r.prescriptions.forEach(p => rows.push(['Prescription', p.patientName, p.date, `"${this.medicineSummary(p)}"`, p.status].join(',')));
    r.followUps.forEach(f => rows.push(['Follow-up', f.patientName, f.dueDate, f.reason, f.status].join(',')));
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'my-report.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  print() { window.print(); }
}