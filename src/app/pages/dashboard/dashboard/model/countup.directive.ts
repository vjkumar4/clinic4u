import { Directive, ElementRef, Input, OnChanges } from '@angular/core';

/** Animates a number from 0 to its value, keeping any prefix/suffix (e.g. "₹ 18,450", "12%"). */
@Directive({ selector: '[appCountUp]', standalone: true })
export class CountUpDirective implements OnChanges {
  @Input('appCountUp') value = '';
  @Input() duration = 1100;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngOnChanges(): void {
    const node = this.el.nativeElement;
    const m = String(this.value).match(/^([^\d]*)([\d,]+(?:\.\d+)?)(.*)$/);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!m || reduce) { node.textContent = this.value; return; }

    const [, prefix, num, suffix] = m;
    const target = parseFloat(num.replace(/,/g, ''));
    const decimals = num.includes('.') ? num.split('.')[1].length : 0;
    const grouped = num.includes(',');
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min((now - start) / this.duration, 1);
      const v = target * (1 - Math.pow(1 - t, 3)); // ease-out
      const text = grouped
        ? v.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        : v.toFixed(decimals);
      node.textContent = prefix + text + suffix;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}