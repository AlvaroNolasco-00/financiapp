import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { RentaCalculatorService, RentaBreakdown, AguinaldoBreakdown } from '../../services/renta-calculator.service';

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

  // Signals principales
  income = signal<number>(1500);
  isMonthly = signal<boolean>(true);
  contractType = signal<'employee' | 'professional'>('employee');

  // Modo de entrada en declaración anual
  annualInputIsMonthly = signal<boolean>(false); // Ingresar salario mensual en modo anual
  ivaIncluded = signal<boolean>(false); // Profesional mensual: monto incluye IVA

  // Deducciones anuales
  medicalExpenses = signal<number>(0);
  educationExpenses = signal<number>(0);
  donations = signal<number>(0);
  operatingExpenses = signal<number>(0);

  // Empleado con ingresos adicionales (modo anual)
  additionalIncome = signal<number>(0);

  // Retención acumulada real (profesionales, modo anual)
  accumulatedWithholding = signal<number>(0);

  // Aguinaldo
  showAguinaldo = signal<boolean>(false);
  aguinaldoAmount = signal<number>(0);
  includeAguinaldoInAnnual = signal<boolean>(false);

  // Ingreso anual efectivo: resuelve si el usuario ingresó mensual o anual en modo anual
  effectiveAnnualIncome = computed<number>(() => {
    if (!this.isMonthly() && this.annualInputIsMonthly()) {
      return this.income() * 12;
    }
    return this.income();
  });

  // Computed: cálculo principal
  breakdown = computed<RentaBreakdown>(() => {
    if (this.isMonthly()) {
      return this.rentaService.calculateMonthly(this.income(), this.contractType(), this.ivaIncluded());
    } else {
      const aguinaldoTaxable = this.includeAguinaldoInAnnual()
        ? this.aguinaldoBreakdown().taxableAmount
        : 0;
      return this.rentaService.calculateAnnual(
        this.effectiveAnnualIncome(),
        this.contractType(),
        this.medicalExpenses(),
        this.educationExpenses(),
        this.donations(),
        this.operatingExpenses(),
        this.contractType() === 'professional' ? this.accumulatedWithholding() : 0,
        this.contractType() === 'employee' ? this.additionalIncome() : 0,
        this.contractType() === 'employee' ? aguinaldoTaxable : 0
      );
    }
  });

  // Computed: aguinaldo
  aguinaldoBreakdown = computed<AguinaldoBreakdown>(() => {
    return this.rentaService.calculateAguinaldo(this.aguinaldoAmount());
  });

  // Computed: datos del gráfico
  doughnutChartData = computed<ChartData<'doughnut'>>(() => {
    const b = this.breakdown();
    const isEmployee = b.contractType === 'employee';
    const isssAfp = (b.isssDeduction ?? 0) + (b.afpDeduction ?? 0);

    if (isEmployee && isssAfp > 0) {
      return {
        labels: ['Ingreso Neto', 'ISR', 'ISSS + AFP'],
        datasets: [{
          data: [b.netIncome, b.netTax, isssAfp],
          backgroundColor: ['#6366f1', '#ec4899', '#f59e0b'],
          hoverOffset: 4,
          borderWidth: 0
        }]
      };
    }

    return {
      labels: ['Ingreso Neto', 'Impuesto a la Renta (ISR)'],
      datasets: [{
        data: [b.netIncome, b.netTax],
        backgroundColor: ['#6366f1', '#ec4899'],
        hoverOffset: 4,
        borderWidth: 0
      }]
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
    const annualIncome = this.effectiveAnnualIncome();
    if (monthly) {
      // Anual → Mensual: convertir ingreso anual a mensual
      this.income.set(Math.round(annualIncome / 12));
      this.annualInputIsMonthly.set(false);
    } else {
      // Mensual → Anual: convertir ingreso mensual a anual
      this.income.set(this.income() * 12);
    }
    this.isMonthly.set(monthly);
  }

  toggleAnnualInputMode(monthly: boolean) {
    const current = this.income();
    if (monthly) {
      // Cambiar de ingresar anual a ingresar mensual: dividir por 12
      this.income.set(Math.round(current / 12));
    } else {
      // Cambiar de ingresar mensual a ingresar anual: multiplicar por 12
      this.income.set(current * 12);
    }
    this.annualInputIsMonthly.set(monthly);
  }

  setContractType(type: 'employee' | 'professional') {
    this.contractType.set(type);
    this.additionalIncome.set(0);
    this.ivaIncluded.set(false);
    this.includeAguinaldoInAnnual.set(false);
  }

  getTramoActive(tramo: number): boolean {
    return this.breakdown().activeTramo === tramo;
  }

  getMonthlyBrackets() { return this.rentaService.getMonthlyBrackets(); }
  getAnnualBrackets() { return this.rentaService.getAnnualBrackets(); }
  getAguinaldoExempt() { return this.rentaService.getAguinaldoExempt(); }
  getWithholdingThreshold() { return this.rentaService.getWithholdingThreshold(); }
}
