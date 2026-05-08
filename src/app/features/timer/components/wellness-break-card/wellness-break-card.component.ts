import { Component, Input } from '@angular/core';

import { WellnessBreakSuggestion } from '../../models/wellness-break.model';

@Component({
  selector: 'app-wellness-break-card',
  standalone: false,
  templateUrl: './wellness-break-card.component.html',
})
export class WellnessBreakCardComponent {
  @Input({ required: true }) suggestion!: WellnessBreakSuggestion;
}
