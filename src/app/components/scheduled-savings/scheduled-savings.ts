import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';

@Component({
  selector: 'app-scheduled-savings',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseChartDirective],
  providers: [provideCharts(withDefaultRegisterables())],
  templateUrl: './scheduled-savings.html',
  styleUrls: ['./scheduled-savings.css']
})
export class ScheduledSavingsComponent implements OnInit {
  depositAmount: number = 20;
  intervalValue: number = 15;
  intervalUnit: 'days' | 'months' | 'years' = 'days';

  durationValue: number = 10;
  durationUnit: 'days' | 'months' | 'years' = 'years';

  totalSaved: number = 0;
  totalDeposits: number = 0;

  randomFacts: string[] = [];

  private allFacts: string[] = [
    "Empezar a ahorrar temprano aprovecha el poder del tiempo, incluso con montos pequeños.",
    "Automatizar tus ahorros es la forma más efectiva de ser consistente sin pensarlo.",
    "El ahorro programado reduce la tentación de gastar dinero en cosas innecesarias.",
    "Tener un fondo de emergencia de 3 a 6 meses de gastos es el primer paso a la libertad financiera.",
    "Ahorrar el 20% de tus ingresos es la regla general recomendada para unas finanzas saludables.",
    "Pequeños cortes en gastos hormiga pueden duplicar tus ahorros a largo plazo.",
    "El hábito de ahorrar es más importante inicialmente que la cantidad que ahorras.",
    "Guardar tu dinero en cuentas separadas evita que lo gastes por accidente.",
    "Ponerle nombre y objetivo a tus ahorros aumenta la probabilidad de cumplirlos.",
    "Revisar tus metas de ahorro cada mes te mantiene motivado y enfocado."
  ];

  public lineChartData: ChartData<'line'> = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Ahorro Acumulado',
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 0
      }
    ]
  };

  public lineChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        labels: { color: '#94a3b8', font: { family: 'Inter' } }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: '#1e293b',
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1'
      }
    },
    scales: {
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8' },
        beginAtZero: true
      },
      x: {
        grid: { display: false },
        ticks: { color: '#94a3b8', maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }
      }
    }
  };

  ngOnInit() {
    this.selectRandomFacts();
    this.calculateSavings();
  }

  selectRandomFacts() {
    const shuffled = [...this.allFacts].sort(() => 0.5 - Math.random());
    this.randomFacts = shuffled.slice(0, 2);
  }

  calculateSavings() {
    // Basic day conversion
    const getDays = (value: number, unit: string) => {
      if (unit === 'days') return value;
      if (unit === 'months') return value * 30.4167; // average days in a month
      if (unit === 'years') return value * 365;
      return value;
    };

    const intervalInDays = getDays(this.intervalValue, this.intervalUnit);
    const durationInDays = getDays(this.durationValue, this.durationUnit);

    if (intervalInDays <= 0 || durationInDays <= 0) {
      this.totalSaved = 0;
      this.totalDeposits = 0;
      this.updateChart([], []);
      return;
    }

    this.totalDeposits = Math.floor(durationInDays / intervalInDays);
    this.totalSaved = this.totalDeposits * this.depositAmount;

    this.generateChartData(intervalInDays, durationInDays);
  }

  generateChartData(intervalInDays: number, durationInDays: number) {
    const labels: string[] = [];
    const data: number[] = [];
    let currentSaved = 0;

    // We'll plot up to 50 points so the chart doesn't get too heavy
    const maxPoints = 50;
    const depositsPerPoint = Math.ceil(this.totalDeposits / maxPoints) || 1;

    for (let i = 0; i <= this.totalDeposits; i++) {
        currentSaved = i * this.depositAmount;

        if (i % depositsPerPoint === 0 || i === this.totalDeposits) {
            labels.push(`Abono ${i}`);
            data.push(currentSaved);
        }
    }

    this.updateChart(labels, data);
  }

  updateChart(labels: string[], data: number[]) {
    this.lineChartData = {
      ...this.lineChartData,
      labels: labels,
      datasets: [
        {
          ...this.lineChartData.datasets[0],
          data: data
        }
      ]
    };
  }
}
