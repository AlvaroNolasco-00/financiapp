import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { RentaCalculatorService, RentaBreakdown } from '../../services/renta-calculator.service';

@Component({
  selector: 'app-renta-calculator',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseChartDirective],
  providers: [provideCharts(withDefaultRegisterables())],
  templateUrl: './renta-calculator.html',
  styleUrls: ['./renta-calculator.css']
})
export class RentaCalculatorComponent implements OnInit {
  private rentaService = inject(RentaCalculatorService);

  // Signals for reactivity
  income = signal<number>(1500);
  isMonthly = signal<boolean>(true);
  contractType = signal<'employee' | 'professional'>('employee');

  // Deductions signals
  medicalExpenses = signal<number>(0);
  educationExpenses = signal<number>(0);
  donations = signal<number>(0);
  operatingExpenses = signal<number>(0);

  // Computed breakdown
  breakdown = computed<RentaBreakdown>(() => {
    if (this.isMonthly()) {
      return this.rentaService.calculateMonthly(this.income(), this.contractType());
    } else {
      return this.rentaService.calculateAnnual(
        this.income(),
        this.contractType(),
        this.medicalExpenses(),
        this.educationExpenses(),
        this.donations(),
        this.operatingExpenses()
      );
    }
  });

  // Chart data computation
  doughnutChartData = computed<ChartData<'doughnut'>>(() => {
    const b = this.breakdown();
    return {
      labels: ['Ingreso Neto', 'Impuesto a la Renta (ISR)'],
      datasets: [
        {
          data: [b.netIncome, b.netTax],
          backgroundColor: [
            '#6366f1', // Net (Primary)
            '#ec4899'  // Renta (Secondary/Pink)
          ],
          hoverOffset: 4,
          borderWidth: 0
        }
      ]
    };
  });

  public doughnutChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: { color: '#94a3b8', font: { family: 'Inter' } }
      },
      tooltip: {
        backgroundColor: '#1e293b',
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
        callbacks: {
          label: (context) => {
            const value = context.parsed as number;
            const total = context.dataset.data.reduce((a: any, b: any) => a + b, 0) as number;
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
            return `${context.label}: $${value.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${percentage}%)`;
          }
        }
      }
    }
  };

  ngOnInit() {}

  setMode(monthly: boolean) {
    this.isMonthly.set(monthly);
    // Adjust default income when switching for better context
    if (monthly && this.income() > 20000) {
      this.income.set(1500);
    } else if (!monthly && this.income() < 5000) {
      this.income.set(18000);
    }
  }

  setContractType(type: 'employee' | 'professional') {
    this.contractType.set(type);
  }

  getTramoActive(tramo: number): boolean {
    return this.breakdown().activeTramo === tramo;
  }

  getMonthlyBrackets() { return this.rentaService.getMonthlyBrackets(); }
  getAnnualBrackets() { return this.rentaService.getAnnualBrackets(); }
}
