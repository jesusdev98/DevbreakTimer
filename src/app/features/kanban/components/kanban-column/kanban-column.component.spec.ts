import { DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ShortcutService } from '../../../../services/shortcut.service';
import { KanbanColumnComponent } from './kanban-column.component';
import { TaskCardComponent } from '../task-card/task-card.component';
import { TaskCreateRequest } from '../../models/task.model';

describe('KanbanColumnComponent', () => {
  let fixture: ComponentFixture<KanbanColumnComponent>;
  let component: KanbanColumnComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [KanbanColumnComponent, TaskCardComponent],
      imports: [CommonModule, DragDropModule, FormsModule],
      providers: [ShortcutService],
    }).compileComponents();

    fixture = TestBed.createComponent(KanbanColumnComponent);
    component = fixture.componentInstance;
    component.title = 'To Do';
    component.status = 'todo';
    component.tasks = [];
    component.dropListId = 'todo-list';
    component.connectedDropLists = [];
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('submits quick-add tasks with the column status', async () => {
    component.quickAddOpen = true;
    fixture.detectChanges();
    await fixture.whenStable();

    const created: TaskCreateRequest[] = [];
    component.quickTaskCreated.subscribe((request) => created.push(request));

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'Ship reliability tests';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(created).toEqual([{ title: 'Ship reliability tests', status: 'todo' }]);
    expect((component as any).quickAddTitle).toBe('');
  });

  it('ignores empty quick-add submissions', () => {
    component.quickAddOpen = true;
    fixture.detectChanges();

    const emitSpy = vi.spyOn(component.quickTaskCreated, 'emit');

    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('cancels quick-add on Escape and clears the draft', () => {
    component.quickAddOpen = true;
    fixture.detectChanges();

    const cancelled: void[] = [];
    component.quickAddCancelled.subscribe(() => cancelled.push(undefined));

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'Draft task';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    (component as any).handleQuickAddEscape(event);
    fixture.detectChanges();

    expect(event.defaultPrevented).toBe(true);
    expect(cancelled.length).toBe(1);
    expect((component as any).quickAddTitle).toBe('');
  });

  it('focuses the quick-add input when opened', async () => {
    const focusSpy = vi.spyOn(HTMLInputElement.prototype, 'focus');
    component.quickAddOpen = true;

    fixture.detectChanges();
    await new Promise((resolve) => window.setTimeout(resolve));

    expect(focusSpy).toHaveBeenCalled();
  });
});
