
import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-username-rules',
  templateUrl: './username-rules.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class UsernameRulesComponent {
  username = input<string>('');

  rules = computed(() => {
    const u = this.username();
    return [
      { label: 'حداقل ۴ کاراکتر', met: u.length >= 4 },
      { label: 'حداکثر ۲۰ کاراکتر', met: u.length <= 20 },
      { label: 'شروع با حرف انگلیسی', met: /^[a-zA-Z]/.test(u) },
      { label: 'فقط شامل حروف انگلیسی، عدد و _', met: /^[a-zA-Z0-9_]*$/.test(u) && !/\s/.test(u) },
    ];
  });
}
