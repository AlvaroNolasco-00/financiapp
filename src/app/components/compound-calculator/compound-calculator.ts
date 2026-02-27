import { Component, OnInit, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { LoanCalculatorComponent } from '../loan-calculator/loan-calculator';
import { InvestmentCalculatorComponent } from '../investment-calculator/investment-calculator';

interface AmortizationRow {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  insurance: number;
  balance: number;
}

interface InvestmentRow {
  month: number;
  year: number;
  startingBalance: number;
  contribution: number;
  interestEarned: number;
  endingBalance: number;
  totalInvested: number;
  totalInterestEarned: number;
}

interface ExtraPayment {
  id: string;
  month: number;
  amount: number;
  loanAction: 'reduce_term' | 'reduce_payment';
}

@Component({
  selector: 'app-compound-calculator',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseChartDirective, LoanCalculatorComponent, InvestmentCalculatorComponent],
  providers: [provideCharts(withDefaultRegisterables())],
  templateUrl: './compound-calculator.html',
  styleUrls: ['./compound-calculator.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CompoundCalculatorComponent implements OnInit {
  // UI State
  activeStep = signal<'loan' | 'investment' | 'results'>('loan');

  // --- STATE FROM CHILDREN ---
  loanData = signal<any>(null);
  investmentData = signal<any>(null);
  withdrawals = signal<{id: string, month: number, amount: number}[]>([]);

  // Form state for adding withdrawals
  newWithdrawalMonth = signal<number>(12);
  newWithdrawalAmount = signal<number>(1000);

  // --- CALCULATIONS ---

  // Result mappings
  loanResults = computed(() => {
    const data = this.loanData();
    if (!data) return null;
    return {
      monthlyPayment: data.monthlyPayment,
      totalInterest: data.totalInterest,
      totalCommission: data.totalCommission,
      totalInsurance: data.totalInsurance,
      totalPayment: data.totalPayment,
      totalExtraPaid: data.totalExtraPaid,
      totalRegularPrincipalPaid: data.totalRegularPrincipalPaid,
      monthsPaid: data.amortizationSchedule?.length || 0,
      schedule: data.amortizationSchedule,
      principal: data.principal,
      years: data.years
    };
  });

  investmentResults = computed(() => {
    const data = this.investmentData();
    if (!data) return null;
    return {
      finalBalance: data.results.finalBalance,
      totalInvested: data.results.totalInvested,
      totalInterestEarned: data.results.totalInterestEarned,
      schedule: data.results.investmentSchedule,
      chartLabels: data.results.chartLabels,
      balanceTrend: data.results.totalBalanceTrend
    };
  });

  // Re-calculating the chart trends specifically for the comparativa
  lineChartData = computed<ChartData<'line'>>(() => {
    const inv = this.investmentData();
    const loan = this.loanData();

    if (!inv || !loan) return { labels: [], datasets: [] };

    const invSchedule = inv.results.investmentSchedule;
    const loanSchedule = loan.amortizationSchedule;

    // Determine max duration in months
    const maxMonths = Math.max(invSchedule.length, loanSchedule.length);
    const interval = 1;

    const labels: string[] = ['Mes 0'];
    const initialReal = (inv.initialInvestment || 0) + (inv.injectedCapital || 0);
    const initialLeveraged = initialReal * (inv.leverage || 1);

    const realEquityPoints: number[] = [initialReal];
    const leveragedPoints: number[] = [initialLeveraged];
    const interestPoints: number[] = [0];
    const loanPoints: number[] = [loan.principal];

    for (let i = 1; i <= maxMonths; i++) {
      if (i % interval === 0 || i === maxMonths) {
        // Label logic consistent with child components
        labels.push(`Mes ${i}`);

        // Investment data point
        let invRow = invSchedule.find((r: any) => r.month === i);
        if (!invRow && i > invSchedule.length) {
          invRow = invSchedule[invSchedule.length - 1]; // Carry forward
        }

        if (invRow) {
          realEquityPoints.push(invRow.realEquity);
          leveragedPoints.push(invRow.leveragedBalance);
          interestPoints.push(invRow.totalInterestEarned);
        } else {
          // Fallback if not exactly at interval
          realEquityPoints.push(realEquityPoints[realEquityPoints.length - 1]);
          leveragedPoints.push(leveragedPoints[leveragedPoints.length - 1]);
          interestPoints.push(interestPoints[interestPoints.length - 1]);
        }

        // Loan data point
        const loanRow = loanSchedule.find((r: any) => r.month === i);
        if (loanRow) {
          loanPoints.push(loanRow.balance);
        } else {
          // If loan is paid off, it's 0
          loanPoints.push(0);
        }
      }
    }

    return {
      labels: labels,
      datasets: [
        {
          data: realEquityPoints,
          label: 'Mi Saldo Real',
          borderColor: '#10b981', // emerald
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 0
        },
        {
          data: leveragedPoints,
          label: 'Balance Apalancado',
          borderColor: '#8b5cf6', // violet
          backgroundColor: 'transparent',
          borderDash: [5, 5],
          fill: false,
          tension: 0.4,
          pointRadius: 0
        },
        {
          data: interestPoints,
          label: 'Intereses Ganados',
          borderColor: '#f59e0b', // amber
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 0
        },
        {
          data: loanPoints,
          label: 'Deuda Pendiente',
          borderColor: '#ef4444', // red
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.4,
          pointRadius: 0
        }
      ]
    };
  });

  netResult = computed(() => {
    const loan = this.loanResults();
    const invest = this.investmentResults();

    if (!loan || !invest) return { netProfit: 0, totalOutofPocket: 0, totalCosts: 0, totalEarnings: 0 };

    // Total out of pocket = Inversion Propia Inicial + Pagos Préstamo al Banco
    const initialOwnInvestment = invest.totalInvested - (this.loanData()?.principal || 0);

    const totalOutofPocket = initialOwnInvestment + loan.totalPayment;

    const netProfit = invest.finalBalance - totalOutofPocket;
    const totalCosts = loan.totalInterest + loan.totalCommission + loan.totalInsurance;

    /* Logic:
       Investment Term is independent because app-investment-calculator
       has its own internal years signal.
       The annual rate field visibility is handled internally in
       app-investment-calculator.html using *ngIf="!isRatePerYear()".
    */

    return {
      netProfit,
      totalOutofPocket,
      totalCosts,
      totalEarnings: invest.totalInterestEarned
    };
  });

  // --- CHARTS ---
  public lineChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, labels: { color: '#94a3b8', font: { family: 'Inter' } } },
      tooltip: { mode: 'index', intersect: false, backgroundColor: '#1e293b', titleColor: '#f8fafc', bodyColor: '#cbd5e1' }
    },
    scales: {
      y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } },
      x: { grid: { display: false }, ticks: { color: '#94a3b8', autoSkip: true, maxTicksLimit: 10 } }
    }
  };

  onLoanData(data: any) {
    this.loanData.set(data);
  }

  onInvestmentData(data: any) {
    this.investmentData.set(data);
  }

  ngOnInit() {}

  addWithdrawal() {
    const month = this.newWithdrawalMonth();
    const amount = this.newWithdrawalAmount();
    if (month > 0 && amount > 0) {
      const id = Math.random().toString(36).substring(2, 9);
      this.withdrawals.update(ws => [...ws, { id, month, amount }].sort((a,b) => a.month - b.month));
    }
  }

  removeWithdrawal(id: string) {
    this.withdrawals.update(ws => ws.filter(w => w.id !== id));
  }

  setStep(step: 'loan' | 'investment' | 'results') {
    this.activeStep.set(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  trackByIndex(index: number, item: any) {
    return index;
  }
}
