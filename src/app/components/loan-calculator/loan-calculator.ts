import { Component, OnInit, OnDestroy, ViewChild, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';

interface AmortizationRow {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  insurance: number;
  balance: number;
}

interface ExtraPayment {
  month: number;
  amount: number;
}

@Component({
  selector: 'app-loan-calculator',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseChartDirective],
  providers: [provideCharts(withDefaultRegisterables())],
  templateUrl: './loan-calculator.html',
  styleUrls: ['./loan-calculator.css']
})
export class LoanCalculatorComponent implements OnInit, OnDestroy {
  @Input() isEmbedded = false;
  @Output() dataChanged = new EventEmitter<any>();

  private _externalExtraPayments: ExtraPayment[] = [];
  @Input() set externalExtraPayments(val: ExtraPayment[]) {
    this._externalExtraPayments = val || [];
    this.calculateLoan();
  }

  // Mode: 'loan' (French) or 'extra' (Flat)
  calculatorMode: 'loan' | 'extra' = 'loan';

  // Inputs
  principal: number = 250000;
  annualRate: number = 7.5; // In Extra mode this is Flat Annual Rate
  years: number = 20;
  termMonths: number = 240; // Default for 20 years
  commissionRate: number = 2.0;
  commissionFixedAmount: number = 0;
  commissionType: 'percentage' | 'fixed' = 'percentage';
  insuranceFee: number = 0;
  includeCommission: boolean = true;
  includeInsurance: boolean = true;

  // Extra Payments
  extraPayments: ExtraPayment[] = [];
  newExtraPaymentAmount: number | null = null;

  // Modal State
  showPaymentModal: boolean = false;
  selectedMonthForPayment: number | null = null;

  // Results
  monthlyPayment: number = 0;
  totalInterest: number = 0;
  totalCommission: number = 0;
  totalInsurance: number = 0;
  totalPayment: number = 0;
  bankProfitPercentage: number = 0;
  totalBankProfit: number = 0;
  yearlyBankProfits: { year: number, profit: number }[] = [];
  actualMonthsPaid: number = 0;
  totalExtraPaid: number = 0;
  totalRegularPrincipalPaid: number = 0;
  amortizationSchedule: AmortizationRow[] = [];

  // Base scenario (no extra payments)
  baseTotalPayment: number = 0;
  baseTotalInterest: number = 0;
  baseActualMonthsPaid: number = 0;

  // Comparison Metrics
  savedInterest: number = 0;
  savedMonths: number = 0;
  hasExtraPayments: boolean = false;

  // Chart
  public lineChartData: ChartData<'line'> = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Saldo de Capital',
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 0
      },
      {
        data: [],
        label: 'Interés Acumulado',
        borderColor: '#ec4899',
        backgroundColor: 'rgba(236, 72, 153, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 0
      }
    ]
  };

  public barChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [
      {
        data: [],
        label: '% Capital',
        backgroundColor: '#6366f1',
        stack: 'a'
      },
      {
        data: [],
        label: '% Interés',
        backgroundColor: '#ec4899',
        stack: 'a'
      },
      {
        data: [],
        label: '% Seguro',
        backgroundColor: '#10b981',
        stack: 'a'
      }
    ]
  };

  public comparisonChartData: ChartData<'bar'> = {
    labels: ['Sin Abonos', 'Con Abonos'],
    datasets: [
      {
        data: [],
        label: 'Capital',
        backgroundColor: '#6366f1',
      },
      {
        data: [],
        label: 'Interés',
        backgroundColor: '#ec4899',
      },
      {
        data: [],
        label: 'Seguro',
        backgroundColor: '#10b981',
      }
    ]
  };

  public comparisonChartOptions: ChartConfiguration['options'] = {
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
        stacked: true,
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8' }
      },
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { color: '#94a3b8' }
      }
    }
  };

  public barChartOptions: ChartConfiguration['options'] = {
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
        bodyColor: '#cbd5e1',
        callbacks: {
          label: (context) => {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += context.parsed.y.toFixed(2) + '%';
            }
            return label;
          }
        }
      }
    },
    scales: {
      y: {
        stacked: true,
        min: 0,
        max: 100,
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: {
          color: '#94a3b8',
          callback: (value) => value + '%'
        }
      },
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { color: '#94a3b8', maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }
      }
    }
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
        ticks: { color: '#94a3b8' }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#94a3b8', maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }
      }
    }
  };

  ngOnInit() {
    this.calculateLoan();
  }

  ngOnDestroy() {
    document.body.classList.remove('no-scroll');
  }

  setMode(mode: 'loan' | 'extra') {
    this.calculatorMode = mode;
    if (mode === 'extra' && this.years > 5) {
      this.years = 3; // Reset to a more typical extrafinancing term
    }
    this.calculateLoan();
  }

  calculateLoan() {
    this.termMonths = this.years * 12;
    this.hasExtraPayments = this.extraPayments.length > 0;

    // Step 1: Calculate Base Scenario (without extras)
    const originalExtras = [...this.extraPayments];
    this.extraPayments = []; // Temporarily clear extras

    if (this.calculatorMode === 'loan') {
      this.calculateFrenchAmortization();
    } else {
      this.calculateFlatAmortization();
    }

    this.baseTotalPayment = this.totalPayment;
    this.baseTotalInterest = this.totalInterest;
    this.baseActualMonthsPaid = this.actualMonthsPaid;

    // Step 2: Calculate Actual Scenario (with extras)
    this.extraPayments = originalExtras;
    if (this.calculatorMode === 'loan') {
      this.calculateFrenchAmortization();
    } else {
      this.calculateFlatAmortization();
    }

    // Step 3: Compute savings
    this.savedInterest = Math.max(0, this.baseTotalInterest - this.totalInterest);
    this.savedMonths = Math.max(0, this.baseActualMonthsPaid - this.actualMonthsPaid);

    // Step 4: Update comparison chart
    this.updateComparisonChart();

    // Step 5: Emit data for parent
    this.emitData();
  }

  private emitData() {
    this.dataChanged.emit({
      principal: this.principal,
      annualRate: this.annualRate,
      years: this.years,
      monthlyPayment: this.monthlyPayment,
      totalInterest: this.totalInterest,
      totalCommission: this.totalCommission,
      totalInsurance: this.totalInsurance,
      totalPayment: this.totalPayment,
      totalExtraPaid: this.totalExtraPaid,
      totalRegularPrincipalPaid: this.totalRegularPrincipalPaid,
      amortizationSchedule: this.amortizationSchedule,
      calculatorMode: this.calculatorMode
    });
  }

  private updateComparisonChart() {
    this.comparisonChartData = {
      ...this.comparisonChartData,
      datasets: [
        {
          ...this.comparisonChartData.datasets[0],
          data: [this.principal, this.principal]
        },
        {
          ...this.comparisonChartData.datasets[1],
          data: [this.baseTotalInterest, this.totalInterest]
        },
        {
          ...this.comparisonChartData.datasets[2],
          data: [this.includeInsurance ? this.insuranceFee * this.baseActualMonthsPaid : 0, this.totalInsurance]
        }
      ]
    };
  }

  private calculateFrenchAmortization() {
    const monthlyRate = this.annualRate / 100 / 12;
    const n = this.termMonths;

    if (monthlyRate === 0) {
      this.monthlyPayment = this.principal / n;
    } else {
      this.monthlyPayment = (this.principal * monthlyRate * Math.pow(1 + monthlyRate, n)) /
                           (Math.pow(1 + monthlyRate, n) - 1);
    }

    this.totalPayment = this.monthlyPayment * n;
    this.totalInterest = this.totalPayment - this.principal;

    if (this.includeCommission) {
      if (this.commissionType === 'percentage') {
        this.totalCommission = (this.principal * (this.commissionRate / 100));
      } else {
        this.totalCommission = this.commissionFixedAmount;
      }
    } else {
      this.totalCommission = 0;
    }

    this.totalInsurance = (this.includeInsurance ? this.insuranceFee : 0) * n;

    this.generateAmortizationSchedule(monthlyRate, n, 'french');
  }

  private calculateFlatAmortization() {
    const totalInterest = this.principal * (this.annualRate / 100) * this.years;

    if (this.includeCommission) {
      if (this.commissionType === 'percentage') {
        this.totalCommission = (this.principal * (this.commissionRate / 100));
      } else {
        this.totalCommission = this.commissionFixedAmount;
      }
    } else {
      this.totalCommission = 0;
    }

    this.totalInsurance = (this.includeInsurance ? this.insuranceFee : 0) * this.termMonths;
    this.totalPayment = this.principal + totalInterest + this.totalCommission + this.totalInsurance;
    this.monthlyPayment = (this.principal + totalInterest) / this.termMonths;
    this.totalInterest = totalInterest;

    this.generateAmortizationSchedule(0, this.termMonths, 'flat');
  }

  addExtraPayment() {
    if (this.selectedMonthForPayment && this.selectedMonthForPayment > 0) {
      // Remove existing payment for this month always before potentially adding new one
      this.extraPayments = this.extraPayments.filter(p => p.month !== this.selectedMonthForPayment);

      if (this.newExtraPaymentAmount && this.newExtraPaymentAmount > 0) {
        this.extraPayments.push({
          amount: this.newExtraPaymentAmount,
          month: this.selectedMonthForPayment
        });

        // Sort by month
        this.extraPayments.sort((a, b) => a.month - b.month);
      }

      this.closePaymentModal();
      this.calculateLoan();
    }
  }

  removeExtraPayment(index: number) {
    this.extraPayments.splice(index, 1);
    this.calculateLoan();
  }

  openPaymentModal(month: number) {
    this.selectedMonthForPayment = month;
    const existing = this.extraPayments.find(p => p.month === month);
    this.newExtraPaymentAmount = existing ? existing.amount : null;
    this.showPaymentModal = true;
    document.body.classList.add('no-scroll');
  }

  closePaymentModal() {
    this.showPaymentModal = false;
    this.selectedMonthForPayment = null;
    this.newExtraPaymentAmount = null;
    document.body.classList.remove('no-scroll');
  }

  getExtraPaymentForMonth(month: number): number {
    const p = this.extraPayments.find(p => p.month === month);
    return p ? p.amount : 0;
  }

  private updateTotalsFromSchedule() {
    let totalInt = 0;
    let totalPay = 0;
    let totalIns = 0;
    this.amortizationSchedule.forEach(row => {
      totalInt += row.interest;
      totalPay += row.payment;
      totalIns += row.insurance;
    });
    this.totalInterest = totalInt;
    this.totalInsurance = totalIns;
    this.totalPayment = totalPay + this.totalCommission;

    // Bank profit is interest + commissions
    this.totalBankProfit = this.totalInterest + this.totalCommission;
    this.bankProfitPercentage = (this.totalBankProfit / this.principal) * 100;

    // Group profits by year
    const profitsMap = new Map<number, number>();
    this.amortizationSchedule.forEach(row => {
      const year = Math.ceil(row.month / 12);
      const current = profitsMap.get(year) || 0;
      profitsMap.set(year, current + row.interest);
    });

    // Add commission to Year 1 profit
    if (this.totalCommission > 0) {
      const year1Profit = profitsMap.get(1) || 0;
      profitsMap.set(1, year1Profit + this.totalCommission);
    }

    this.yearlyBankProfits = Array.from(profitsMap.entries())
      .map(([year, profit]) => ({ year, profit }))
      .sort((a, b) => a.year - b.year);
  }

  generateAmortizationSchedule(monthlyRate: number, numberOfPayments: number, type: 'french' | 'flat') {
    let balance = this.principal;
    let accumulatedInterest = 0;
    this.totalExtraPaid = 0;
    this.totalRegularPrincipalPaid = 0;
    this.amortizationSchedule = [];

    const chartLabels: string[] = ['Mes 0'];
    const principalTrend: number[] = [this.principal];
    const interestTrend: number[] = [0];

    const barLabels: string[] = [];
    const barPrincipal: number[] = [];
    const barInterest: number[] = [];
    const barInsurance: number[] = [];

    const currentInsurance = this.includeInsurance ? this.insuranceFee : 0;

    for (let i = 1; i <= numberOfPayments; i++) {
      let interest = 0;
      let principalPart = 0;

      if (type === 'french') {
        interest = balance * monthlyRate;
        principalPart = this.monthlyPayment - interest;
      } else {
        // Flat rate: interest is constant every month based on initial principal
        interest = this.totalInterest / numberOfPayments;
        principalPart = this.principal / numberOfPayments;
      }

      // Apply extra payments for this month
      const internalExtra = this.extraPayments
        .filter(p => p.month === i)
        .reduce((sum, p) => sum + p.amount, 0);

      const externalExtra = this._externalExtraPayments
        .filter(p => p.month === i)
        .reduce((sum, p) => sum + p.amount, 0);

      let extra = internalExtra + externalExtra;

      // Cap principalPart + extra to balance
      if (principalPart + extra > balance) {
        if (principalPart >= balance) {
          principalPart = balance;
          extra = 0;
        } else {
          extra = balance - principalPart;
        }
      }

      balance -= (principalPart + extra);

      // Fix floating point precision issue
      if (balance < 0.001) {
        balance = 0;
      }

      accumulatedInterest += interest;

      this.totalExtraPaid += extra;
      this.totalRegularPrincipalPaid += principalPart;

      this.amortizationSchedule.push({
        month: i,
        payment: principalPart + interest + extra + currentInsurance,
        principal: principalPart + extra,
        interest: interest,
        insurance: currentInsurance,
        balance: Math.max(0, balance)
      });

      // Update chart labels and trends
      const interval = 1;
      if (i % interval === 0 || i === numberOfPayments || balance <= 0) {
        chartLabels.push(`Mes ${i}`);
        principalTrend.push(Math.max(0, balance));
        interestTrend.push(accumulatedInterest);
      }

      // Populate Bar Chart (Payment Distribution %)
      const totalForBar = principalPart + interest + extra + currentInsurance;
      if (totalForBar > 0) {
        barLabels.push(`Mes ${i}`);
        barPrincipal.push(((principalPart + extra) / totalForBar) * 100);
        barInterest.push((interest / totalForBar) * 100);
        barInsurance.push((currentInsurance / totalForBar) * 100);
      }

      if (balance <= 0) break;
    }

    this.actualMonthsPaid = this.amortizationSchedule.length;
    this.updateTotalsFromSchedule();

    this.lineChartData = {
      ...this.lineChartData,
      labels: chartLabels,
      datasets: [
        { ...this.lineChartData.datasets[0], data: principalTrend },
        { ...this.lineChartData.datasets[1], data: interestTrend }
      ]
    };

    this.barChartData = {
      ...this.barChartData,
      labels: barLabels,
      datasets: [
        { ...this.barChartData.datasets[0], data: barPrincipal },
        { ...this.barChartData.datasets[1], data: barInterest },
        { ...this.barChartData.datasets[2], data: barInsurance }
      ]
    };
  }
}
