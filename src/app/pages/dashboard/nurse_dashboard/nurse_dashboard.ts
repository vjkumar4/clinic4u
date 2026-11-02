import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClinicTab, QueueEntry, Vitals } from './model/nursedashboard.model';
import { NurseClinicService } from '../../../services/nursedashboard_service';

@Component({
  selector: 'app-nurse-clinic',
  standalone: true,
  imports: [DatePipe, FormsModule],
  templateUrl: './nurse_dashboard.html',
  styleUrl: './nurse_dashboard.scss',
})
export class NurseClinicComponent implements OnInit {
  private readonly service = inject(NurseClinicService);

  readonly tabs: { key: ClinicTab; label: string }[] = [
    { key: 'queue', label: "Today's queue" },
    { key: 'procedures', label: 'Procedures' },
    { key: 'followUps', label: 'Follow-up calls' },
    { key: 'tasks', label: 'Tasks and notes' },
  ];

  readonly data = this.service.data;
  readonly today = new Date();
  readonly loading = signal(true);
  readonly error = signal('');
  readonly tab = signal<ClinicTab>('queue');
  readonly search = signal('');

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.service.load().subscribe({
      next: () => this.loading.set(false),
      error: () => {
        this.error.set('Could not load the clinic dashboard. Check your connection and try again.');
        this.loading.set(false);
      },
    });
  }

  readonly queue = computed(() => {
    const q = this.search().trim().toLowerCase();
    return (this.data()?.queue ?? [])
      .filter(e => !q || (e.patientName + ' ' + e.reason + ' ' + e.token).toLowerCase().includes(q))
      .sort((a, b) => (a.status === 'Done' ? 1 : 0) - (b.status === 'Done' ? 1 : 0) || a.token - b.token);
  });

  readonly kpis = computed(() => {
    const q = this.data()?.queue ?? [];
    const n = (s: string) => q.filter(e => e.status === s).length;
    return [
      { label: 'Waiting', value: n('Waiting'), tone: 'warn' },
      { label: 'Vitals done', value: n('Vitals done'), tone: '' },
      { label: 'With doctor', value: n('With doctor'), tone: '' },
      { label: 'Seen today', value: n('Done'), tone: 'ok' },
    ];
  });

  waitMinutes(e: QueueEntry): number {
    return Math.max(0, Math.round((Date.now() - new Date(e.arrivedAt).getTime()) / 60_000));
  }

  /** Out-of-range values to point out. This is a display hint, not a diagnosis. */
  vitalFlags(v?: Vitals): string[] {
    if (!v) return [];
    const f: string[] = [];
    if (v.temperatureC >= 38) f.push('High temperature');
    if (v.spo2 < 94) f.push('Low SpO₂');
    if (v.pulse > 110 || v.pulse < 50) f.push('Abnormal pulse');
    if (v.systolic > 160 || v.systolic < 90) f.push('Abnormal BP');
    return f;
  }
}