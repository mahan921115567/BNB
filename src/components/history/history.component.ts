import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CryptoService } from '../../services/crypto.service';
import { Cryptocurrency, HistoryItem } from '../../models/crypto.model';

type FilterType = 'all' | 'buy' | 'sell' | 'deposit' | 'withdraw';
type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

@Component({
  selector: 'app-history',
  templateUrl: './history.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class HistoryComponent {
  private cryptoService = inject(CryptoService);
  
  cryptos = this.cryptoService.cryptos;
  filterStatus = signal<FilterStatus>('all');
  filterType = signal<FilterType>('all');

  setFilterStatus(status: FilterStatus) {
    this.filterStatus.set(status);
  }

  setFilterType(type: FilterType) {
    this.filterType.set(type);
  }

  historyItems = computed(() => {
    const history = this.cryptoService.userHistory();
    const cryptosMap = new Map<string, Cryptocurrency>(this.cryptos().map(c => [c.id, c]));
    const currentStatus = this.filterStatus();
    const currentType = this.filterType();
    
    const enrichedHistory: (HistoryItem & { cryptoName: string, cryptoSymbol: string })[] = history.map(item => {
      let cryptoName = 'تومان';
      let cryptoSymbol = 'IRT';
      
      if ('cryptoId' in item) {
        const crypto = cryptosMap.get(item.cryptoId);
        cryptoName = crypto?.name || item.cryptoId;
        cryptoSymbol = crypto?.symbol || '???';
      }
      
      return { ...item, cryptoName, cryptoSymbol };
    });

    let filteredItems = enrichedHistory;

    // Apply status filter
    if (currentStatus !== 'all') {
      filteredItems = filteredItems.filter(item => item.status === currentStatus);
    }

    // Apply type filter
    if (currentType !== 'all') {
      filteredItems = filteredItems.filter(item => {
        if (currentType === 'deposit') {
            return item.type === 'deposit' || item.type === 'toman_deposit';
        }
        if (currentType === 'withdraw') {
            return item.type === 'withdraw' || item.type === 'toman_withdraw';
        }
        return item.type === currentType;
      });
    }

    return filteredItems;
  });
}