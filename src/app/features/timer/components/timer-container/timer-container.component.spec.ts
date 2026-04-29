import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TimerContainerComponent } from './timer-container.component';

describe('TimerContainerComponent', () => {
  let component: TimerContainerComponent;
  let fixture: ComponentFixture<TimerContainerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TimerContainerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TimerContainerComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
