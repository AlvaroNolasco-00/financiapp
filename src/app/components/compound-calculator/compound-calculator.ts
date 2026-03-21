import { Component, OnInit, signal, computed, ChangeDetectionStrategy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ChartConfiguration, ChartData, Chart, Plugin } from 'chart.js';
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
  @ViewChild('withdrawalsSection') withdrawalsSection!: ElementRef;

  // UI State
  activeStep = signal<'loan' | 'investment' | 'results'>('loan');
  monthHighlighted = signal<boolean>(false);

  // --- STATE FROM CHILDREN ---
  loanData = signal<any>(null);
  investmentData = signal<any>(null);
  withdrawals = signal<{id: string, month: number, amount: number}[]>([]);

  // Form state for adding withdrawals
  newWithdrawalMonth = signal<number>(12);
  newWithdrawalAmount = signal<number>(1000);

  // Manejo de la comisión de desembolso
  disbursementHandling = signal<'deduct_from_capital' | 'pay_in_first_installment'>('pay_in_first_installment');

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
      years: data.years,
      calculatorMode: data.calculatorMode
    };
  });

  investmentResults = computed(() => {
    const data = this.extendedInvestmentData();
    if (!data) return null;
    return {
      finalBalance: data.finalBalance,
      totalInvested: data.totalInvested,
      totalInterestEarned: data.totalInterestEarned,
      schedule: data.investmentSchedule,
      chartLabels: data.chartLabels,
      balanceTrend: data.totalBalanceTrend
    };
  });

  // Signal to handle disbursement subtraction based on user selection
  injectedCapitalForInvestment = computed(() => {
    const loan = this.loanData();
    if (!loan) return 0;

    // Si se resta del capital, el monto a invertir es principal - comisión
    // Si se paga en la primera cuota, el monto completo se invierte
    if (this.disbursementHandling() === 'deduct_from_capital') {
      return loan.principal - loan.totalCommission;
    } else {
      return loan.principal;
    }
  });

  // Derived signal that extends the investment schedule if the loan lasts longer
  extendedInvestmentData = computed(() => {
    const inv = this.investmentData();
    const loan = this.loanData();
    if (!inv || !loan) return null;

    const invSchedule = [...inv.results.investmentSchedule];
    const loanSchedule = loan.amortizationSchedule;
    
    // We extend the schedule IF loan duration > investment duration
    if (loanSchedule.length > invSchedule.length) {
      let currentBalance = inv.results.finalBalance; // realEquity
      const monthlyPayment = loan.monthlyPayment;

      for (let i = invSchedule.length + 1; i <= loanSchedule.length; i++) {
        currentBalance = Math.max(0, currentBalance - monthlyPayment);
        
        // Push a row that simulates the decay
        // Note: leveragedBalance also decays
        invSchedule.push({
          month: i,
          year: Math.ceil(i / 12),
          startingBalance: (currentBalance + monthlyPayment) * (inv.leverage || 1),
          contribution: 0,
          interestEarned: 0,
          endingBalance: currentBalance * (inv.leverage || 1),
          totalInvested: inv.results.totalInvested,
          totalInterestEarned: inv.results.totalInterestEarned,
          realEquity: currentBalance,
          leveragedBalance: currentBalance * (inv.leverage || 1)
        });
      }

      return {
        ...inv.results,
        finalBalance: currentBalance,
        investmentSchedule: invSchedule
      };
    }

    return inv.results;
  });

  // Re-calculating the chart trends specifically for the comparativa
  lineChartData = computed<ChartData<'line'>>(() => {
    const invExtended = this.extendedInvestmentData();
    const inv = this.investmentData();
    const loan = this.loanData();

    if (!invExtended || !loan || !inv) return { labels: [], datasets: [] };

    const invSchedule = invExtended.investmentSchedule;
    const loanSchedule = loan.amortizationSchedule;

    // Determine max duration in months
    const maxMonths = Math.max(invSchedule.length, loanSchedule.length);
    const interval = 1;

    const labels: string[] = ['Mes 0'];
    const initialReal = (inv.initialInvestment || 0) + this.injectedCapitalForInvestment();
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
        const invRow = invSchedule.find((r: any) => r.month === i);
        
        if (invRow) {
          realEquityPoints.push(invRow.realEquity);
          leveragedPoints.push(invRow.leveragedBalance);
          interestPoints.push(invRow.totalInterestEarned);
        } else if (i > invSchedule.length) {
          const lastRow = invSchedule[invSchedule.length - 1];
          realEquityPoints.push(lastRow.realEquity);
          leveragedPoints.push(lastRow.leveragedBalance);
          interestPoints.push(lastRow.totalInterestEarned);
        } else {
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
    const invest = this.extendedInvestmentData();

    if (!loan || !invest) return { netProfit: 0, totalOutofPocket: 0, totalCosts: 0, totalEarnings: 0 };

    // Total out of pocket = Inversion Propia Inicial + Pagos Préstamo al Banco
    const initialOwnInvestment = invest.totalInvested - this.injectedCapitalForInvestment();

    // Si la inversión dura menos que el préstamo, ya estamos restando las cuotas en extendedInvestmentData
    // Por lo tanto, el totalOutofPocket solo debe contar las cuotas pagadas MIENTRAS la inversión estaba activa
    // para no cobrar doble.
    // Pero para simplificar y ser conservadores:
    // Profit = Final Balance (ya neto de deuda post-inversion) - Initial Own Investment - Pagos durante inversion.
    
    // Mejor lógica: 
    // Si loan duration > inv duration:
    // netProfit = invest.finalBalance (que ya tiene restadas las cuotas restantes) - initialOwnInvestment - (cuotas pagadas durante vida inversion)
    
    const invMonths = this.investmentData()?.results.investmentSchedule.length || 0;
    const paymentsDuringInversion = loan.schedule
      .filter((r: any) => r.month <= invMonths)
      .reduce((sum: number, r: any) => sum + r.payment, 0);

    // Si la comisión se paga en la primera cuota, se resta del profit
    // (no está incluida en row.payment del schedule)
    // Si se resta del capital, ya está contabilizada via injectedCapitalForInvestment
    const commissionCost = (this.disbursementHandling() === 'pay_in_first_installment') ? loan.totalCommission : 0;

    const totalOutofPocket = initialOwnInvestment + paymentsDuringInversion + commissionCost;

    const netProfit = invest.finalBalance - initialOwnInvestment - paymentsDuringInversion - commissionCost;
    const totalCosts = loan.totalInterest + loan.totalCommission + loan.totalInsurance;

    return {
      netProfit,
      totalOutofPocket,
      totalCosts,
      totalEarnings: invest.totalInterestEarned
    };
  });

  // --- CHARTS ---
  public chartPlugins: Plugin[] = [
    {
      id: 'crosshair',
      afterDraw: (chart: any) => {
        if (chart.tooltip?._active?.length) {
          const activePoint = chart.tooltip._active[0];
          const ctx = chart.ctx;
          const x = activePoint.element.x;
          const topY = chart.scales.y.top;
          const bottomY = chart.scales.y.bottom;

          // Draw vertical line
          ctx.save();
          ctx.beginPath();
          ctx.setLineDash([5, 5]);
          ctx.moveTo(x, topY);
          ctx.lineTo(x, bottomY);
          ctx.lineWidth = 1;
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
          ctx.stroke();
          
          // Draw "Click to add" label
          ctx.setLineDash([]);
          ctx.fillStyle = '#6366f1';
          const labelText = chart.data.labels?.[activePoint.index] || '';
          const label = `📌 Clic: Abonar en ${labelText}`;
          ctx.font = 'bold 11px Inter';
          const textWidth = ctx.measureText(label).width;
          
          ctx.beginPath();
          ctx.roundRect(x - textWidth/2 - 8, topY - 25, textWidth + 16, 20, 5);
          ctx.fill();
          
          ctx.fillStyle = '#ffffff';
          ctx.fillText(label, x - textWidth/2, topY - 11);
          
          ctx.restore();
        }
      }
    }
  ];

  public lineChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: (event: any, elements, chart) => {
      const points = chart.getElementsAtEventForMode(event, 'index', { intersect: false }, false);
      if (points.length > 0) {
        const activePoint = points[0];
        const label = chart.data.labels?.[activePoint.index];
        
        if (label && typeof label === 'string') {
          const monthNumber = parseInt(label.replace('Mes ', ''));
          this.newWithdrawalMonth.set(monthNumber);
          
          // Scroll to section
          this.withdrawalsSection?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Trigger pulse highlight
          this.monthHighlighted.set(true);
          setTimeout(() => this.monthHighlighted.set(false), 2000);
        }
      }
    },
    onHover: (event: any, elements, chart) => {
      const points = chart.getElementsAtEventForMode(event, 'index', { intersect: false }, false);
      if (event.native?.target) {
        event.native.target.style.cursor = points.length > 0 ? 'pointer' : 'default';
      }
    },
    plugins: {
      legend: { 
        display: true, 
        position: 'top',
        labels: { 
          color: '#94a3b8', 
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 20,
          font: { family: 'Inter', size: 12, weight: 600 } 
        } 
      },
      tooltip: { 
        mode: 'index', 
        intersect: false, 
        backgroundColor: '#1e293b', 
        titleColor: '#f8fafc', 
        bodyColor: '#cbd5e1',
        padding: 10,
        cornerRadius: 8,
        displayColors: true
      }
    },
    scales: {
      y: { 
        grid: { color: 'rgba(255, 255, 255, 0.05)' }, 
        ticks: { 
          color: '#94a3b8',
          callback: (value: any) => '$' + value.toLocaleString()
        } 
      },
      x: { grid: { display: false }, ticks: { color: '#94a3b8', autoSkip: true, maxTicksLimit: 12 } }
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
