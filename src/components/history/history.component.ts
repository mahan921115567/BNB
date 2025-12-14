
import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CryptoService } from '../../services/crypto.service';
import { Cryptocurrency } from '../../models/crypto.model';

@Component({
  selector: 'app-history',
  templateUrl: './history.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class HistoryComponent {
  private cryptoService = inject(CryptoService);
  
  cryptos = this.cryptoService.cryptos;

  historyItems = computed(() => {
    const history = this.cryptoService.userHistory();
    const cryptosMap = new Map<string, Cryptocurrency>(this.cryptos().map(c => [c.id, c]));
    
    return history.map(item => {
      let cryptoName = 'تومان';
      let cryptoSymbol = 'IRT';
      
      if ('cryptoId' in item) {
        const crypto = cryptosMap.get(item.cryptoId);
        cryptoName = crypto?.name || item.cryptoId;
        cryptoSymbol = crypto?.symbol || '???';
      }
      
      return { ...item, cryptoName, cryptoSymbol };
    });
  });
}
