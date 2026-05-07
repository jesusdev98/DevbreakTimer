import { Task } from '../models/task.model';

export const MOCK_TASKS: Task[] = [
  {
    id: 'task-landing-page',
    title: 'Build landing page',
    description: 'Create the first public-facing view for the productivity workflow.',
    status: 'ideas',
    createdAt: 1714399200000,
    archived: false,
  },
  {
    id: 'task-timer-sounds',
    title: 'Improve timer sounds',
    description: 'Explore softer session start and completion cues.',
    status: 'todo',
    createdAt: 1714485600000,
    archived: false,
  },
  {
    id: 'task-streak-system',
    title: 'Add streak system',
    status: 'todo',
    createdAt: 1714572000000,
    archived: false,
  },
  {
    id: 'task-settings-panel',
    title: 'Refactor settings panel',
    description: 'Prepare the settings surface for future productivity preferences.',
    status: 'in-progress',
    createdAt: 1714658400000,
    archived: false,
  },
  {
    id: 'task-mobile-responsive',
    title: 'Mobile responsiveness improvements',
    status: 'done',
    createdAt: 1714744800000,
    archived: false,
  },
];
