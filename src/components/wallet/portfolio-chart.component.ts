
import { Component, ChangeDetectionStrategy, input, ViewChild, ElementRef, afterNextRender, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as d3 from 'd3';
import { WalletAsset } from '../../models/crypto.model';
import { ThemeService } from '../../services/theme.service';

// Combine asset with crypto details for the chart
export interface ChartAsset extends WalletAsset {
    name: string;
    symbol: string;
    valueIrt: number;
    logo: string;
}

@Component({
  selector: 'app-portfolio-chart',
  templateUrl: './portfolio-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class PortfolioChartComponent {
  assets = input.required<(ChartAsset & { valueIrt: number })[]>();
  irtBalance = input.required<number>();
  totalValue = input.required<number>();

  @ViewChild('chartContainer') private chartContainer!: ElementRef;
  private themeService = inject(ThemeService);

  private readonly colors = [
    '#facc15', // amber-400
    '#fb923c', // orange-400
    '#22c55e', // green-500
    '#38bdf8', // lightBlue-400
    '#818cf8', // indigo-400
    '#c084fc', // purple-400
    '#f472b6', // pink-400
    '#fb7185', // rose-400
    '#a3a3a3'  // neutral-400 for Toman
  ];
  
  constructor() {
    afterNextRender(() => {
        this.renderChart();
    });
    
    // Re-render chart when inputs change
    effect(() => {
        if(this.chartContainer) {
             this.renderChart();
        }
    });
  }

  private renderChart(): void {
    const assets = this.assets();
    const irtBalance = this.irtBalance();
    
    // Prepare data for D3 pie chart
    const chartData: { label: string, value: number, symbol: string }[] = [];
    
    if (irtBalance > 0) {
        chartData.push({ label: 'Toman', value: irtBalance, symbol: 'IRT' });
    }
    
    assets.forEach(asset => {
        if (asset.valueIrt > 0) {
            chartData.push({ label: asset.name, value: asset.valueIrt, symbol: asset.symbol });
        }
    });

    if (!this.chartContainer || chartData.length === 0) {
      if(this.chartContainer) {
        d3.select(this.chartContainer.nativeElement).selectAll('*').remove();
      }
      return;
    }
    
    const element = this.chartContainer.nativeElement;
    d3.select(element).selectAll('*').remove(); // Clear previous chart

    const width = 250;
    const height = 250;
    const margin = 10;
    const radius = Math.min(width, height) / 2 - margin;

    const svg = d3.select(element)
      .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
        .attr('transform', `translate(${width / 2}, ${height / 2})`);

    const colorScale = d3.scaleOrdinal<string>()
      .domain(chartData.map(d => d.label))
      .range(this.colors);

    const pie = d3.pie<{ label: string, value: number, symbol: string }>()
      .sort(null) // Do not sort slices
      .value(d => d.value);

    const data_ready = pie(chartData);
    
    const arc = d3.arc()
      .innerRadius(radius * 0.6)
      .outerRadius(radius);

    svg
      .selectAll('path')
      .data(data_ready)
      .enter()
      .append('path')
      .attr('d', d3.arc().innerRadius(radius * 0.6).outerRadius(radius))
      .attr('fill', d => colorScale(d.data.label))
      .attr('stroke', 'var(--chart-bg, #111827)') // Use CSS variable for dark/light mode background
      .style('stroke-width', '4px')
      .style('opacity', 0.85)
      .each(function() { (this as any).__current = {startAngle: 0, endAngle: 0}; })
      .transition()
      .duration(1000)
      .attrTween('d', function(d) {
          const i = d3.interpolate((this as any).__current, d);
          (this as any).__current = i(0);
          return function(t) {
              return arc(i(t))!;
          };
      });

    // Determine text colors based on theme
    const theme = this.themeService.theme();
    const primaryTextColor = theme === 'dark' ? '#FFFFFF' : '#111827'; // white or gray-900
    const secondaryTextColor = theme === 'dark' ? '#9ca3af' : '#6b7280'; // gray-400 or gray-500

    // Center text
    svg.append('text')
       .attr('text-anchor', 'middle')
       .attr('dy', '0.35em')
       .text(`${(this.totalValue() / 1000000).toFixed(2)} M`)
       .attr('class', 'font-black text-3xl')
       .style('fill', primaryTextColor)
       .style('opacity', 0)
       .transition()
       .duration(1000)
       .delay(500)
       .style('opacity', 1);

    svg.append('text')
       .attr('text-anchor', 'middle')
       .attr('dy', '-1.5em')
       .text('ارزش کل')
       .attr('class', 'font-semibold text-sm')
       .style('fill', secondaryTextColor)
       .style('opacity', 0)
       .transition()
       .duration(1000)
       .delay(500)
       .style('opacity', 1);
  }

  getLegendData = () => {
     const assets = this.assets();
     const irtBalance = this.irtBalance();
     const totalValue = this.totalValue();
     if(totalValue === 0) return [];
     
     const chartData: { label: string, value: number, symbol: string, color: string }[] = [];
    
     const colorScale = d3.scaleOrdinal<string>()
      .domain([...assets.map(a => a.name), 'Toman'])
      .range(this.colors);

     if (irtBalance > 0) {
         chartData.push({ label: 'Toman', value: irtBalance, symbol: 'IRT', color: colorScale('Toman') });
     }
     
     assets.forEach(asset => {
         if (asset.valueIrt > 0) {
             chartData.push({ label: asset.name, value: asset.valueIrt, symbol: asset.symbol, color: colorScale(asset.name) });
         }
     });

     return chartData.map(d => ({...d, percentage: (d.value / totalValue) * 100}))
       .sort((a,b) => b.value - a.value);
  }
}
