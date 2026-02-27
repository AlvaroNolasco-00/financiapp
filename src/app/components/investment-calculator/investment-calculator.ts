import { Component, OnInit, signal, computed, ChangeDetectionStrategy, input, Output, EventEmitter, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';

interface InvestmentRow {
  month: number;
  year: number;
  startingBalance: number;
  contribution: number;
  interestEarned: number;
  endingBalance: number;
  totalInvested: number;
  totalInterestEarned: number;
  realEquity: number;
  leveragedBalance: number;
}

@Component({
  selector: 'app-investment-calculator',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseChartDirective],
  providers: [provideCharts(withDefaultRegisterables())],
  templateUrl: './investment-calculator.html',
  styleUrls: ['./investment-calculator.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InvestmentCalculatorComponent implements OnInit {
  // Inputs
  initialInvestment = signal<number>(10000);
  monthlyContribution = signal<number>(500);
  annualRate = signal<number>(8);
  annualRates = signal<number[]>([]);
  years = signal<number>(10);
  interestType = signal<'compuesto' | 'simple'>('compuesto');
  capitalizationFrequency = signal<'mensual' | 'anual'>('mensual');
  isRatePerYear = signal<boolean>(false);
  leverage = signal<number>(1);

  // New inputs for embedding
  isEmbedded = input<boolean>(false);
  injectedCapital = input<number>(0);
  withdrawals = input<{month: number, amount: number}[]>([]);

  @Output() dataChanged = new EventEmitter<any>();

  constructor() {
    // Emit data whenever investmentResults changes
    effect(() => {
      const results = this.investmentResults();
      if (results) {
        this.dataChanged.emit({
          initialInvestment: this.initialInvestment(),
          injectedCapital: this.injectedCapital(),
          monthlyContribution: this.monthlyContribution(),
          years: this.years(),
          annualRate: this.annualRate(),
          isRatePerYear: this.isRatePerYear(),
          annualRates: this.annualRates(),
          results: results
        });
      }
    });
  }


  // Educational Content
  interestDescriptions = {
    compuesto: 'El interés se suma al capital inicial y genera nuevos intereses en cada periodo, creando un efecto multiplicador.',
    simple: 'El interés se calcula únicamente sobre el capital inicial aportado, manteniendo un crecimiento constante y lineal.'
  };

  interestRecommendations = {
    compuesto: 'Ideal para metas a largo plazo (retiro, educación) donde el tiempo maximiza tus ganancias sin esfuerzo adicional.',
    simple: 'Recomendado para préstamos personales de corto plazo o si necesitas retirar tus ganancias periódicamente.'
  };

  interestFacts = {
    compuesto: 'Albert Einstein lo llamó la "Octava Maravilla del Mundo". Quien lo entiende, lo gana; quien no, lo paga.',
    simple: 'Es el sistema más transparente y fácil de calcular, muy común en préstamos informales y microcréditos.'
  };

  // Growth Chart
  public lineChartOptions: ChartConfiguration<'line'>['options'] = {
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

  public doughnutChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#94a3b8', font: { family: 'Inter' } }
      }
    },
    cutout: '70%'
  };

  // Derived Results
  investmentResults = computed(() => {
    const yearsValue = this.years();
    const initialInvestmentValue = this.initialInvestment();
    const monthlyContributionValue = this.monthlyContribution();
    const leverageValue = this.leverage();
    const isRatePerYearValue = this.isRatePerYear();
    const annualRateValue = this.annualRate();
    const annualRatesValue = this.annualRates();
    const interestTypeValue = this.interestType();
    const capitalizationFrequencyValue = this.capitalizationFrequency();

    const totalMonths = Math.max(1, Math.round(yearsValue * 12));
    const activeMonthlyContribution = leverageValue > 1 ? 0 : monthlyContributionValue;

    const currentInjected = this.injectedCapital() || 0;
    let realEquity = initialInvestmentValue + currentInjected;
    let leveragedBalance = realEquity * leverageValue;

    let totalContributed = initialInvestmentValue + currentInjected;
    let accumulatedInterest = 0;
    let pendingYearlyInterest = 0;

    let noLevBalance = initialInvestmentValue;
    let pendingNoLevYearlyInterest = 0;
    let noLevYield = 0;

    const schedule: InvestmentRow[] = [];
    const chartLabels: string[] = ['Mes 0'];
    const totalBalanceTrend: number[] = [leveragedBalance];
    const investedTrend: number[] = [totalContributed];
    const realEquityTrend: number[] = [realEquity];
    const leveragedBalanceTrend: number[] = [leveragedBalance];

    const bankYieldTrend: number[] = [0];
    const noLevYieldTrend: number[] = [0];
    const levYieldTrend: number[] = [0];

    let bankNoLevBalance = initialInvestmentValue;

    for (let i = 1; i <= totalMonths; i++) {
      const yearIndex = Math.ceil(i / 12) - 1;
      const currentAnnualRate = isRatePerYearValue ? annualRatesValue[yearIndex] : annualRateValue;
      const monthlyRate = currentAnnualRate / 100 / 12;

      const startingBalance = leveragedBalance;

      const principalForInterest =
        interestTypeValue === 'compuesto'
          ? leveragedBalance
          : (initialInvestmentValue + currentInjected) * leverageValue + activeMonthlyContribution * i;
      const interestEarned = principalForInterest * monthlyRate;

      if (capitalizationFrequencyValue === 'anual') {
        pendingYearlyInterest += interestEarned;
        realEquity += activeMonthlyContribution;
        if (i % 12 === 0 || i === totalMonths) {
          realEquity += pendingYearlyInterest;
          pendingYearlyInterest = 0;
        }
      } else {
        realEquity += interestEarned + activeMonthlyContribution;
      }

      // Deduct withdrawals if any
      const withdrawalForMonth = (this.withdrawals() || [])
        .filter(w => w.month === i)
        .reduce((sum, w) => sum + w.amount, 0);

      if (withdrawalForMonth > 0) {
        realEquity = Math.max(0, realEquity - withdrawalForMonth);
        noLevBalance = Math.max(0, noLevBalance - withdrawalForMonth);
        // We DO NOT subtract from totalContributed because it's a "gross" figure
      }

      leveragedBalance = realEquity * leverageValue;

      totalContributed += activeMonthlyContribution;
      accumulatedInterest += interestEarned;

      // No Leverage Calculation
      const noLevPrincipalForInt =
        interestTypeValue === 'compuesto'
          ? noLevBalance
          : initialInvestmentValue + monthlyContributionValue * i;
      const noLevInterest = noLevPrincipalForInt * monthlyRate;

      if (capitalizationFrequencyValue === 'anual') {
        pendingNoLevYearlyInterest += noLevInterest;
        noLevBalance += monthlyContributionValue;
        if (i % 12 === 0 || i === totalMonths) {
          noLevBalance += pendingNoLevYearlyInterest;
          pendingNoLevYearlyInterest = 0;
        }
      } else {
        noLevBalance += noLevInterest + monthlyContributionValue;
      }

      noLevYield += noLevInterest;

      // Bank Reference Calculation (3% simple interest)
      const bankMonthlyRate = 0.03 / 12;
      const bankInterest = (initialInvestmentValue + monthlyContributionValue * i) * bankMonthlyRate;
      bankNoLevBalance += bankInterest + monthlyContributionValue;
      const totalBankInterest = bankNoLevBalance - (initialInvestmentValue + monthlyContributionValue * i);

      schedule.push({
        month: i,
        year: Math.ceil(i / 12),
        startingBalance,
        contribution: activeMonthlyContribution,
        interestEarned,
        endingBalance: leveragedBalance,
        totalInvested: totalContributed, // Now shows gross contribution
        totalInterestEarned: accumulatedInterest,
        realEquity,
        leveragedBalance
      });

      const interval = capitalizationFrequencyValue === 'mensual' ? 1 : 12;
      if (i % interval === 0 || i === totalMonths) {
        chartLabels.push(interval === 1 ? `Mes ${i}` : `Año ${i / 12}`);
        totalBalanceTrend.push(leveragedBalance);
        investedTrend.push(totalContributed);
        realEquityTrend.push(realEquity);
        leveragedBalanceTrend.push(leveragedBalance);

        bankYieldTrend.push(totalBankInterest);
        noLevYieldTrend.push(noLevYield);
        levYieldTrend.push(accumulatedInterest);
      }
    }

    const baseCapital = initialInvestmentValue + monthlyContributionValue * totalMonths;
    const bankReferenceBalance = baseCapital + baseCapital * 0.03 * yearsValue;

    return {
      finalBalance: realEquity, // Returns real net equity to avoiding counting broker margin as profit
      leveragedFinalBalance: leveragedBalance,
      totalInvested: totalContributed, // Gross contributions
      totalInterestEarned: accumulatedInterest,
      investmentSchedule: schedule,
      bankReferenceBalance,
      chartLabels,
      totalBalanceTrend,
      investedTrend,
      realEquityTrend,
      leveragedBalanceTrend,
      bankYieldTrend,
      noLevYieldTrend,
      levYieldTrend,
    };
  });

  // Chart Signals
  lineChartData = computed<ChartData<'line'>>(() => {
    const results = this.investmentResults();
    return {
      labels: results.chartLabels,
      datasets: [
        {
          data: results.totalBalanceTrend,
          label: 'Saldo Total',
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
        },
        {
          data: results.investedTrend,
          label: 'Capital Invertido',
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
        },
      ],
    };
  });

  doughnutChartData = computed<ChartData<'doughnut'>>(() => {
    const results = this.investmentResults();
    return {
      labels: ['Capital Invertido', 'Intereses Ganados'],
      datasets: [
        {
          data: [results.totalInvested, results.totalInterestEarned],
          backgroundColor: ['#10b981', '#6366f1'],
          hoverBackgroundColor: ['#059669', '#4f46e5'],
          borderWidth: 0,
        },
      ],
    };
  });

  leverageChartData = computed<ChartData<'line'>>(() => {
    const results = this.investmentResults();
    const leverageValue = this.leverage();

    if (leverageValue === 1) {
      return {
        labels: results.chartLabels,
        datasets: [
          {
            data: results.bankYieldTrend,
            label: 'Rendimiento Banco (3% Anual)',
            borderColor: '#94a3b8',
            backgroundColor: 'rgba(148, 163, 184, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 0,
          },
          {
            data: results.noLevYieldTrend,
            label: 'Rendimiento Inversión (1x)',
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 0,
          },
        ],
      };
    } else {
      return {
        labels: results.chartLabels,
        datasets: [
          {
            data: results.noLevYieldTrend,
            label: 'Sin Apalancamiento (1x)',
            borderColor: '#94a3b8',
            backgroundColor: 'rgba(148, 163, 184, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 0,
          },
          {
            data: results.levYieldTrend,
            label: `Con Apalancamiento (${leverageValue}x)`,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 0,
          },
        ],
      };
    }
  });

  ngOnInit() {
    this.updateYears();
  }

  updateYears() {
    let y = this.years();
    if (y <= 0) {
      this.years.set(0.1);
      y = 0.1;
    }
    if (y > 50) {
      this.years.set(50);
      y = 50;
    }

    const targetLength = Math.max(1, Math.ceil(y));
    const currentRates = this.annualRates();
    const newRates = [...currentRates];

    if (newRates.length < targetLength) {
      for (let i = newRates.length; i < targetLength; i++) {
        newRates.push(this.annualRate());
      }
    } else if (newRates.length > targetLength) {
      newRates.length = targetLength;
    }

    if (newRates.length !== currentRates.length) {
      this.annualRates.set(newRates);
    }
  }

  onRateTypeChange() {
    if (this.isRatePerYear()) {
      this.updateYears();
    }
  }

  updateAnnualRate(index: number, value: number) {
    const newRates = [...this.annualRates()];
    newRates[index] = value;
    this.annualRates.set(newRates);
  }

  trackByIndex(index: number, item: any) {
    return index;
  }
}
