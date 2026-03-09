import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { SalaryCalculatorService, SalaryBreakdown } from '../../services/salary-calculator.service';

@Component({
  selector: 'app-salary-calculator',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseChartDirective],
  providers: [provideCharts(withDefaultRegisterables())],
  templateUrl: './salary-calculator.html',
  styleUrls: ['./salary-calculator.css']
})
export class SalaryCalculatorComponent implements OnInit {
  private salaryService = inject(SalaryCalculatorService);

  // Input
  grossSalary: number = 1500;

  // Output
  breakdown: SalaryBreakdown | null = null;

  // Chart
  public doughnutChartData: ChartData<'doughnut'> = {
    labels: ['Net Salary', 'ISSS', 'AFP', 'Renta (ISR)'],
    datasets: [
      {
        data: [],
        backgroundColor: [
          '#6366f1', // Net (Primary)
          '#10b981', // ISSS (Success)
          '#fbbf24', // AFP (Warning/Gold)
          '#ec4899'  // Renta (Secondary/Pink)
        ],
        hoverOffset: 4,
        borderWidth: 0
      }
    ]
  };

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
            const percentage = ((value / total) * 100).toFixed(1);
            return `${context.label}: $${value.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${percentage}%)`;
          }
        }
      }
    }
  };

  ngOnInit() {
    this.calculateSalary();
  }

  calculateSalary() {
    this.breakdown = this.salaryService.calculateBreakdown(this.grossSalary);
    this.updateChart();
  }

  updateChart() {
    if (!this.breakdown) return;

    this.doughnutChartData = {
      ...this.doughnutChartData,
      datasets: [
        {
          ...this.doughnutChartData.datasets[0],
          data: [
            this.breakdown.netSalary,
            this.breakdown.isss,
            this.breakdown.afp,
            this.breakdown.renta
          ]
        }
      ]
    };
  }

  getTramoActive(tramo: number): boolean {
    return this.breakdown?.rentaTramo === tramo;
  }
}
