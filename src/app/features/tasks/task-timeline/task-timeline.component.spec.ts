import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { T } from '../../../t.const';
import { TaskTimelineComponent } from './task-timeline.component';
import { TaskTimeline } from './task-timeline.model';

describe('TaskTimelineComponent', () => {
  let fixture: ComponentFixture<TaskTimelineComponent>;
  let component: TaskTimelineComponent;

  const timeline: TaskTimeline = {
    stages: [
      {
        id: 'stage-a',
        title: 'A',
        nodes: [
          {
            id: 'node-a',
            title: 'Collect context',
            startedAt: 1000,
            completedAt: 1000,
          },
        ],
      },
      {
        id: 'stage-b',
        title: 'B',
        nodes: [
          { id: 'node-b1', title: 'Validate samples' },
          { id: 'node-b2', title: 'Compare logs' },
        ],
      },
      {
        id: 'stage-c',
        title: 'C',
        nodes: [{ id: 'node-c', title: 'Write summary' }],
      },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, TranslateModule.forRoot(), TaskTimelineComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskTimelineComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('timeline', timeline);
    fixture.detectChanges();
  });

  it('renders stages and nodes', () => {
    const element: HTMLElement = fixture.nativeElement;
    const inputValues = Array.from(
      element.querySelectorAll<HTMLInputElement>('input'),
    ).map((input) => input.value);

    expect(inputValues).toContain('A');
    expect(inputValues).toContain('B');
    expect(inputValues).toContain('C');
    expect(inputValues).toContain('Validate samples');
    expect(inputValues).toContain('Compare logs');
  });

  it('provides accessible labels for title inputs and icon actions', () => {
    const element: HTMLElement = fixture.nativeElement;
    const inputLabels = Array.from(
      element.querySelectorAll<HTMLInputElement>('input'),
    ).map((input) => input.getAttribute('aria-label'));
    const buttonLabels = Array.from(
      element.querySelectorAll<HTMLButtonElement>('button[mat-icon-button]'),
    ).map((button) => button.getAttribute('aria-label'));

    expect(inputLabels).toContain(T.F.TASK.ADDITIONAL_INFO.TIMELINE_STAGE_TITLE);
    expect(inputLabels).toContain(T.F.TASK.ADDITIONAL_INFO.TIMELINE_NODE_TITLE);
    expect(buttonLabels).toContain(T.F.TASK.ADDITIONAL_INFO.TIMELINE_ADD_NODE);
    expect(buttonLabels).toContain(T.F.TASK.ADDITIONAL_INFO.TIMELINE_DELETE_STAGE);
    expect(buttonLabels).toContain(T.F.TASK.ADDITIONAL_INFO.TIMELINE_START_NODE);
    expect(buttonLabels).toContain(T.F.TASK.ADDITIONAL_INFO.TIMELINE_REOPEN_NODE);
    expect(buttonLabels).toContain(T.F.TASK.ADDITIONAL_INFO.TIMELINE_DELETE_NODE);
  });

  it('does not emit when trying to start a locked node', () => {
    spyOn(component.timelineChange, 'emit');

    component.start('node-c');

    expect(component.timelineChange.emit).not.toHaveBeenCalled();
  });

  it('does not emit for no-op edit, delete, and add-node actions', () => {
    spyOn(component.timelineChange, 'emit');

    component.updateStageTitle('stage-b', 'B');
    component.updateNodeTitle('node-b1', 'Validate samples');
    component.deleteStage('missing-stage');
    component.deleteNode('missing-node');
    component.addNode('missing-stage');

    expect(component.timelineChange.emit).not.toHaveBeenCalled();
  });

  it('emits a timeline with a new stage when empty', () => {
    fixture.componentRef.setInput('timeline', undefined);
    fixture.detectChanges();
    spyOn(component.timelineChange, 'emit');

    component.addStage();

    expect(component.timelineChange.emit).toHaveBeenCalled();
    const emitted = (component.timelineChange.emit as jasmine.Spy).calls.mostRecent()
      .args[0] as TaskTimeline;
    expect(emitted.stages).toHaveSize(1);
    expect(emitted.stages[0].nodes).toEqual([]);
  });

  it('emits an updated timeline when starting an unlocked node', () => {
    spyOn(component.timelineChange, 'emit');

    component.start('node-b1');

    expect(component.timelineChange.emit).toHaveBeenCalled();
    const emitted = (component.timelineChange.emit as jasmine.Spy).calls.mostRecent()
      .args[0] as TaskTimeline;
    expect(emitted.stages[1].nodes[0].startedAt).toEqual(jasmine.any(Number));
  });

  it('unlocks the next stage after every current stage node is complete', () => {
    let emitted: TaskTimeline | undefined;
    spyOn(component.timelineChange, 'emit').and.callFake((value: TaskTimeline) => {
      emitted = value;
      fixture.componentRef.setInput('timeline', value);
      fixture.detectChanges();
    });

    component.complete('node-b1');
    component.complete('node-b2');

    expect(emitted?.stages[2].nodes[0].completedAt).toBeUndefined();
    expect(component.nodeStatus('node-c')).toBe('notStarted');
  });
});
