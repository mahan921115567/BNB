
import { Component, ElementRef, input, ViewChild, inject, signal, afterNextRender, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as d3 from 'd3';
import { CryptoService } from '../../services/crypto.service';

@Component({
  selector: 'app-price-chart',
  templateUrl: './price-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  styles: [`
    :host {
      display: block;
      width: 120px;
      height: 40px;
    }
  `]
})
export class PriceChartComponent {
  private cryptoService = inject(CryptoService);
  
  // Inputs
  cryptoId = input.required<string>();
  
  @ViewChild('chartContainer') private chartContainer!: ElementRef;

  isLoading = signal(true);
  trendColor = signal('#9ca3af'); // Default gray

  constructor() {
    afterNextRender(() => {
      this.fetchAndRender();
    });
  }

  private fetchAndRender() {
    this.cryptoService.getHistory(this.cryptoId()).subscribe(data => {
      this.isLoading.set(false);
      if (data && data.length > 0) {
        this.renderChart(data);
      }
    });
  }

  private renderChart(data: number[]) {
    const element = this.chartContainer.nativeElement;
    d3.select(element).selectAll('*').remove(); // Clear previous

    const width = 120;
    const height = 40;
    const margin = { top: 2, right: 0, bottom: 2, left: 0 };

    const svg = d3.select(element)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'none');

    // Determine color based on trend (start vs end)
    const isUp = data[data.length - 1] >= data[0];
    const color = isUp ? '#4ade80' : '#f87171'; // Green-400 or Red-400
    this.trendColor.set(color);

    // X Scale
    const x = d3.scaleLinear()
      .domain([0, data.length - 1])
      .range([margin.left, width - margin.right]);

    // Y Scale
    const y = d3.scaleLinear()
      .domain([d3.min(data) || 0, d3.max(data) || 0])
      .range([height - margin.bottom, margin.top]);

    // Line Generator
    const line = d3.line<number>()
      .x((d, i) => x(i))
      .y(d => y(d))
      .curve(d3.curveMonotoneX);

    // Append Path
    svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 2)
      .attr('d', line);
      
    // Add a gradient area below the line for a nice effect
    const area = d3.area<number>()
      .x((d, i) => x(i))
      .y0(height)
      .y1(d => y(d))
      .curve(d3.curveMonotoneX);
      
    const defs = svg.append("defs");
    const gradientId = `gradient-${this.cryptoId()}`;
    const gradient = defs.append("linearGradient")
      .attr("id", gradientId)
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");
      
    gradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", color)
      .attr("stop-opacity", 0.2);
      
    gradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", color)
      .attr("stop-opacity", 0);
      
    svg.append("path")
      .datum(data)
      .attr("fill", `url(#${gradientId})`)
      .attr("d", area);
  }
}
