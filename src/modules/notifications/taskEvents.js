// Turns task-related changes into notifications. Keeping the wording and recipient rules
// here (instead of scattered through the task/comment services) makes them easy to review.
//
// Every function takes the transaction client `db` and returns the created notifications,
// which the caller pushes into the outbox of withNotifications().
import { notify } from './notifications.service.js';

const quote = (title) => `"${title.length > 80 ? `${title.slice(0, 77)}...` : title}"`;

const FIELD_LABELS = {
  title: 'title',
  description: 'description',
  status: 'status',
  priority: 'priority',
  dueDate: 'due date',
};

export function taskAssigned(db, actorId, task) {
  return notify(db, {
    recipients: [task.assignee?.id],
    actorId,
    type: 'TASK_ASSIGNED',
    title: (actor) => `${actor} assigned you ${quote(task.title)}`,
    body: task.dueDate ? `Due ${task.dueDate.toISOString().slice(0, 10)}` : undefined,
    taskId: task.id,
    projectId: task.project?.id,
  });
}

/**
 * After an update: a new assignee hears "assigned"; the creator and assignee hear about
 * other changes ("completed" gets its own type, since that's what people care about most).
 */
export async function taskUpdated(db, actorId, task, previous, changes) {
  const reassigned = changes.assigneeId !== undefined && changes.assigneeId !== previous.assigneeId;
  const created = reassigned && task.assignee ? await taskAssigned(db, actorId, task) : [];

  const changed = Object.keys(FIELD_LABELS).filter(
    (field) =>
      changes[field] !== undefined && !(field === 'status' && changes.status === previous.status),
  );
  if (changed.length === 0) return created;

  // Whoever was just assigned already got the "assigned" notification.
  const recipients = [task.creator.id, reassigned ? null : task.assignee?.id];
  const completed = changes.status === 'COMPLETED' && previous.status !== 'COMPLETED';

  const updated = await notify(db, {
    recipients,
    actorId,
    type: completed ? 'TASK_COMPLETED' : 'TASK_UPDATED',
    title: (actor) =>
      completed
        ? `${actor} completed ${quote(task.title)}`
        : `${actor} updated ${quote(task.title)}`,
    body: `Changed: ${changed.map((f) => FIELD_LABELS[f]).join(', ')}`,
    taskId: task.id,
    projectId: task.project?.id,
  });
  return [...created, ...updated];
}

export function taskCommented(db, actorId, task, comment) {
  return notify(db, {
    recipients: [task.creatorId, task.assigneeId],
    actorId,
    type: 'TASK_COMMENTED',
    title: (actor) => `${actor} commented on ${quote(task.title)}`,
    body: comment.body,
    taskId: task.id,
    projectId: task.projectId,
  });
}

export function attachmentAdded(db, actorId, task, attachment) {
  return notify(db, {
    recipients: [task.creatorId, task.assigneeId],
    actorId,
    type: 'TASK_UPDATED',
    title: (actor) => `${actor} attached a file to ${quote(task.title)}`,
    body: attachment.originalName,
    taskId: task.id,
    projectId: task.projectId,
  });
}

export function invited(db, actorId, inviteeId, invitation) {
  return notify(db, {
    recipients: [inviteeId],
    actorId,
    type: 'PROJECT_INVITATION',
    title: (actor) => `${actor} invited you to join ${quote(invitation.project.name)}`,
    body: `Role: ${invitation.role.toLowerCase()}`,
    projectId: invitation.project.id,
  });
}
