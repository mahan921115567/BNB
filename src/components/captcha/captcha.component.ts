
import { Component, ChangeDetectionStrategy, output, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-captcha',
  templateUrl: './captcha.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
})
export class CaptchaComponent {
  verified = output<boolean>();

  num1 = signal(0);
  num2 = signal(0);
  operator = signal<'+' | '-' | '×'>('+');
  userAnswer = signal<string>('');
  private correctAnswer = signal(0);

  constructor() {
    this.generateQuestion();
    effect(() => {
        this.checkAnswer(this.userAnswer());
    });
  }

  generateQuestion() {
    this.userAnswer.set('');
    let n1 = Math.floor(Math.random() * 9) + 1;
    let n2 = Math.floor(Math.random() * 9) + 1;
    const opRand = Math.random();

    if (opRand < 0.5) { // Addition
      this.operator.set('+');
      this.correctAnswer.set(n1 + n2);
    } else { // Subtraction
      // Ensure result is not negative for simplicity
      if (n1 < n2) {
        [n1, n2] = [n2, n1]; // Swap them
      }
      this.operator.set('-');
      this.correctAnswer.set(n1 - n2);
    } 
    
    this.num1.set(n1);
    this.num2.set(n2);
    this.verified.emit(false);
  }

  private checkAnswer(answer: string) {
    const isCorrect = parseInt(answer, 10) === this.correctAnswer();
    this.verified.emit(isCorrect);
  }
}
