// End-to-end check of every user story against a RUNNING API, the way a real client uses it.
//
//   docker compose up -d --build      (or: npm run dev)
//   npm run smoke                     (SMOKE_URL=http://host:port npm run smoke for another server)
//
// It creates fresh accounts (Asha, Ben and an outsider, Cara) with unique emails, so it is safe to run
// repeatedly against a development database. It does not clean up after itself.
import { io } from 'socket.io-client';

const BASE = (process.env.SMOKE_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const API = `${BASE}/api/v1`;
const run = Date.now().toString(36);

let passed = 0;
const failures = [];

function check(story, description, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  ✔ ${description}`);
  } else {
    failures.push(`${story}: ${description}`);
    console.log(`  ✘ ${description}${detail === undefined ? '' : ` → ${JSON.stringify(detail)}`}`);
  }
}

async function call(method, path, { token, body, form, cookie } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${API}${path}`, { method, headers, body: payload });
  const type = res.headers.get('content-type') ?? '';
  const json = type.includes('application/json') ? await res.json() : null;
  if (res.status === 429) {
    // The auth endpoints allow 20 attempts per 15 minutes per IP; each run uses about 11.
    console.error(`\n${method} ${path} was rate limited (429): ${json?.error?.message}`);
    console.error('Wait 15 minutes or restart the API (docker compose restart api), then retry.');
    process.exit(1);
  }
  return { status: res.status, json, data: json?.data, res };
}

function waitFor(socket, event, predicate = () => true, ms = 5000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve(null);
    }, ms);
    function handler(payload) {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    }
    socket.on(event, handler);
  });
}

function story(title) {
  console.log(`\n${title}`);
}

async function main() {
  console.log(`TaskMaster smoke test against ${BASE}`);
  const health = await call('GET', '/health').catch(() => null);
  if (!health || health.status !== 200) {
    console.error(`\nThe API is not reachable at ${BASE}. Start it first (see README).`);
    process.exit(1);
  }

  const password = 'Smoke-test-1';
  const ashaEmail = `asha.${run}@example.com`;
  const benEmail = `ben.${run}@example.com`;

  // ── US1 ──
  story('US1  Create an account');
  const regA = await call('POST', '/auth/register', {
    body: { name: 'Asha', email: ashaEmail, password },
  });
  check(
    'US1',
    'Asha registers (201) and gets an access token',
    regA.status === 201 && !!regA.data?.accessToken,
    regA.json,
  );
  const regB = await call('POST', '/auth/register', {
    body: { name: 'Ben', email: benEmail, password },
  });
  check('US1', 'Ben registers', regB.status === 201, regB.json);
  const dup = await call('POST', '/auth/register', {
    body: { name: 'Asha again', email: ashaEmail.toUpperCase(), password },
  });
  check('US1', 'Same email (any case) is rejected with 409', dup.status === 409, dup.json);
  const weak = await call('POST', '/auth/register', {
    body: { name: 'Weak', email: `weak.${run}@example.com`, password: 'short' },
  });
  check('US1', 'Weak password is rejected with 400', weak.status === 400, weak.json);
  check(
    'US1',
    'Password hash is never returned',
    !JSON.stringify(regA.json).includes('passwordHash'),
  );

  // ── US2 ──
  story('US2  Log in securely');
  const badLogin = await call('POST', '/auth/login', {
    body: { email: ashaEmail, password: 'Wrong-password-1' },
  });
  check('US2', 'Wrong password is rejected with 401', badLogin.status === 401, badLogin.json);
  const loginA = await call('POST', '/auth/login', { body: { email: ashaEmail, password } });
  check(
    'US2',
    'Correct credentials log in (200)',
    loginA.status === 200 && !!loginA.data?.accessToken,
    loginA.json,
  );
  const setCookie = loginA.res.headers.get('set-cookie') ?? '';
  check(
    'US2',
    'Refresh token is set as an httpOnly cookie',
    /tm_refresh=.*HttpOnly/i.test(setCookie),
    setCookie,
  );
  const ben = regB.data.accessToken;
  const noToken = await call('GET', '/users/me');
  check('US2', 'Protected endpoints need a token (401)', noToken.status === 401);
  const refreshed = await call('POST', '/auth/refresh', {
    body: { refreshToken: loginA.data.refreshToken },
  });
  check(
    'US2',
    'Refresh token gives a new access token',
    refreshed.status === 200 && !!refreshed.data?.accessToken,
    refreshed.json,
  );
  const reused = await call('POST', '/auth/refresh', {
    body: { refreshToken: loginA.data.refreshToken },
  });
  check('US2', 'An already-used refresh token is rejected', reused.status === 401, reused.json);
  // Reuse detection revokes that session, so log in again for the rest of the run.
  const ashaToken = (await call('POST', '/auth/login', { body: { email: ashaEmail, password } }))
    .data.accessToken;

  // ── US3 ──
  story('US3  View and update my profile');
  const me = await call('GET', '/users/me', { token: ashaToken });
  check(
    'US3',
    'GET /users/me returns my profile',
    me.status === 200 && me.data?.email === ashaEmail,
    me.json,
  );
  const upd = await call('PATCH', '/users/me', {
    token: ashaToken,
    body: { name: 'Asha Rao', bio: 'Team lead' },
  });
  check(
    'US3',
    'PATCH /users/me updates name and bio',
    upd.status === 200 && upd.data?.name === 'Asha Rao' && upd.data?.bio === 'Team lead',
    upd.json,
  );
  const me2 = await call('GET', '/users/me', { token: ashaToken });
  check('US3', 'The change is saved', me2.data?.name === 'Asha Rao');

  // ── US11 (needed before assigning to a team member) ──
  story('US11 Create a team/project and invite members');
  const proj = await call('POST', '/projects', {
    token: ashaToken,
    body: { name: `Launch ${run}`, description: 'Smoke test project' },
  });
  check(
    'US11',
    'Asha creates a project (201) and is its owner',
    proj.status === 201 && proj.data?.myRole === 'OWNER',
    proj.json,
  );
  const projectId = proj.data?.id;
  const inv = await call('POST', `/projects/${projectId}/invitations`, {
    token: ashaToken,
    body: { email: benEmail },
  });
  check('US11', 'Asha invites Ben by email (201)', inv.status === 201, inv.json);
  const benInvites = await call('GET', '/invitations', { token: ben });
  const invitation = benInvites.data?.find?.((i) => i.project?.id === projectId);
  check('US11', 'Ben sees the invitation', !!invitation, benInvites.json);
  const beforeJoin = await call('GET', `/projects/${projectId}`, { token: ben });
  check(
    'US11',
    'Ben cannot see the project before joining (404)',
    beforeJoin.status === 404,
    beforeJoin.json,
  );
  const accept = await call('POST', `/invitations/${invitation?.id}/accept`, { token: ben });
  check('US11', 'Ben accepts and joins', accept.status === 200, accept.json);
  const members = await call('GET', `/projects/${projectId}/members`, { token: ben });
  check('US11', 'Both are listed as members', members.data?.length === 2, members.json);
  const benId = members.data?.find?.((m) => m.email === benEmail)?.id;

  // Ben listens for live notifications from here on (US13).
  const socket = io(BASE, { auth: { token: ben }, transports: ['websocket'] });
  const connected = await new Promise((resolve) => {
    socket.once('connect', () => resolve(true));
    socket.once('connect_error', () => resolve(false));
    setTimeout(() => resolve(false), 5000);
  });

  // ── US4 ──
  story('US4  Create a task with title, description and due date');
  const due = new Date(Date.now() + 3 * 864e5).toISOString();
  const t1 = await call('POST', '/tasks', {
    token: ashaToken,
    body: {
      title: `Prepare invoice ${run}`,
      description: 'Quarterly billing for Acme',
      dueDate: due,
      projectId,
      priority: 'HIGH',
    },
  });
  check(
    'US4',
    'Task created (201) with title, description and due date',
    t1.status === 201 &&
      t1.data?.title.startsWith('Prepare invoice') &&
      t1.data?.description === 'Quarterly billing for Acme' &&
      t1.data?.dueDate === due,
    t1.json,
  );
  const t2 = await call('POST', '/tasks', {
    token: ashaToken,
    body: { title: `Write release notes ${run}`, projectId },
  });
  check('US4', 'Second task created', t2.status === 201, t2.json);
  const noTitle = await call('POST', '/tasks', {
    token: ashaToken,
    body: { description: 'no title' },
  });
  check('US4', 'Missing title is rejected with 400', noTitle.status === 400, noTitle.json);
  const taskId = t1.data?.id;

  // ── US7 + US13 ──
  story('US7  Assign a task to a team member  (+ US13 live notification)');
  const assignedEvent = waitFor(socket, 'notification', (n) => n.type === 'TASK_ASSIGNED');
  const assign = await call('PATCH', `/tasks/${taskId}`, {
    token: ashaToken,
    body: { assigneeId: benId },
  });
  check(
    'US7',
    'Asha assigns the task to Ben',
    assign.status === 200 && assign.data?.assignee?.id === benId,
    assign.json,
  );
  const outsider = await call('POST', '/auth/register', {
    body: { name: 'Cara', email: `cara.${run}@example.com`, password },
  });
  const badAssign = await call('PATCH', `/tasks/${taskId}`, {
    token: ashaToken,
    body: { assigneeId: outsider.data?.user?.id },
  });
  check(
    'US7',
    'Assigning to someone outside the project is rejected',
    badAssign.status === 400 || badAssign.status === 422,
    badAssign.json,
  );
  check('US13', 'Ben’s WebSocket connected with his access token', connected);
  const assignedNote = await assignedEvent;
  check('US13', 'Ben receives a live "task assigned" notification', !!assignedNote, assignedNote);

  // ── US5 ──
  story('US5  View tasks assigned to me');
  const mine = await call('GET', '/tasks?assigneeId=me', { token: ben });
  check(
    'US5',
    'Ben’s list contains exactly the task assigned to him',
    mine.status === 200 && mine.data?.length === 1 && mine.data[0].id === taskId,
    mine.json,
  );
  check(
    'US5',
    'The list is paginated',
    typeof mine.json?.meta?.total === 'number',
    mine.json?.meta,
  );

  // ── US10 ──
  story('US10 Comments and attachments');
  const commentEvent = waitFor(socket, 'notification', (n) => n.type === 'TASK_COMMENTED');
  const comment = await call('POST', `/tasks/${taskId}/comments`, {
    token: ashaToken,
    body: { body: 'Please use the new template.' },
  });
  check('US10', 'Asha comments on the task (201)', comment.status === 201, comment.json);
  const reply = await call('POST', `/tasks/${taskId}/comments`, {
    token: ben,
    body: { body: 'On it!' },
  });
  check('US10', 'Ben replies', reply.status === 201, reply.json);
  const comments = await call('GET', `/tasks/${taskId}/comments`, { token: ben });
  check('US10', 'Both comments are listed', comments.data?.length === 2, comments.json);
  check('US13', 'Ben is notified live about Asha’s comment', !!(await commentEvent));
  const form = new FormData();
  const fileText = `Invoice draft ${run}\n`;
  form.append('file', new Blob([fileText], { type: 'text/plain' }), 'invoice-draft.txt');
  const upload = await call('POST', `/tasks/${taskId}/attachments`, { token: ben, form });
  check(
    'US10',
    'Ben attaches a file (201)',
    upload.status === 201 && upload.data?.originalName === 'invoice-draft.txt',
    upload.json,
  );
  const files = await call('GET', `/tasks/${taskId}/attachments`, { token: ashaToken });
  check('US10', 'Asha sees the attachment', files.data?.length === 1, files.json);
  const dl = await fetch(`${API}/tasks/${taskId}/attachments/${upload.data?.id}/download`, {
    headers: { Authorization: `Bearer ${ashaToken}` },
  });
  check(
    'US10',
    'Asha downloads it and gets the same content',
    dl.status === 200 && (await dl.text()) === fileText,
  );
  const exe = new FormData();
  exe.append('file', new Blob(['MZ'], { type: 'application/x-msdownload' }), 'virus.exe');
  const badUpload = await call('POST', `/tasks/${taskId}/attachments`, { token: ben, form: exe });
  check(
    'US10',
    'A disallowed file type is rejected (415)',
    badUpload.status === 415,
    badUpload.json,
  );
  const cara = outsider.data?.accessToken;
  const peek = await call('GET', `/tasks/${taskId}/comments`, { token: cara });
  check(
    'US10',
    'Someone outside the project cannot read the comments (404)',
    peek.status === 404,
    peek.json,
  );

  // ── US6 + US13 ──
  story('US6  Mark a task completed  (+ US13 update notification)');
  const doneEvent = waitFor(
    socket,
    'notification',
    (n) => n.type === 'TASK_COMPLETED' || n.type === 'TASK_UPDATED',
  );
  const done = await call('PATCH', `/tasks/${taskId}`, {
    token: ashaToken,
    body: { status: 'COMPLETED' },
  });
  check(
    'US6',
    'Task marked COMPLETED with a completion time',
    done.status === 200 && done.data?.status === 'COMPLETED' && !!done.data?.completedAt,
    done.json,
  );
  check('US13', 'Ben is notified live that the task was completed', !!(await doneEvent));

  // ── US8 ──
  story('US8  Filter tasks by status');
  const open = await call('GET', `/tasks?projectId=${projectId}&status=OPEN`, { token: ashaToken });
  check(
    'US8',
    'status=OPEN returns only the open task',
    open.data?.length === 1 && open.data[0].id === t2.data?.id,
    open.json,
  );
  const completed = await call('GET', `/tasks?projectId=${projectId}&status=COMPLETED`, {
    token: ashaToken,
  });
  check(
    'US8',
    'status=COMPLETED returns only the completed task',
    completed.data?.length === 1 && completed.data[0].id === taskId,
    completed.json,
  );
  const badStatus = await call('GET', '/tasks?status=DONEISH', { token: ashaToken });
  check('US8', 'An unknown status is rejected with 400', badStatus.status === 400, badStatus.json);

  // ── US9 ──
  story('US9  Search tasks by title or description');
  const byTitle = await call('GET', `/tasks?q=invoice ${run}`, { token: ashaToken });
  check(
    'US9',
    'Search matches the title',
    byTitle.data?.length === 1 && byTitle.data[0].id === taskId,
    byTitle.json,
  );
  const byDesc = await call('GET', `/tasks?projectId=${projectId}&q=acme`, { token: ashaToken });
  check(
    'US9',
    'Search matches the description, case-insensitively',
    byDesc.data?.length === 1 && byDesc.data[0].id === taskId,
    byDesc.json,
  );
  const leak = await call('GET', `/tasks?q=${run}`, { token: cara });
  check(
    'US9',
    'Search never returns tasks the user cannot see',
    leak.data?.length === 0,
    leak.json,
  );

  // ── US13 (stored notifications) ──
  story('US13 Notifications inbox');
  const inbox = await call('GET', '/notifications', { token: ben });
  check(
    'US13',
    'Ben’s notifications are stored and listed with an unread count',
    inbox.status === 200 && inbox.data?.length >= 3 && inbox.json?.meta?.unread >= 3,
    inbox.json?.meta,
  );
  const readAll = await call('POST', '/notifications/read-all', { token: ben });
  const after = await call('GET', '/notifications?unread=true', { token: ben });
  check(
    'US13',
    'Mark all as read clears the unread list',
    readAll.status < 300 && after.data?.length === 0,
    after.json,
  );

  // ── US12 ──
  story('US12 Log out securely');
  const disconnected = new Promise((resolve) => {
    socket.once('disconnect', () => resolve(true));
    setTimeout(() => resolve(false), 5000);
  });
  const logout = await call('POST', '/auth/logout', { token: ben });
  check('US12', 'Ben logs out (204)', logout.status === 204, logout.json);
  const afterLogout = await call('GET', '/users/me', { token: ben });
  check(
    'US12',
    'His access token stops working immediately (401)',
    afterLogout.status === 401,
    afterLogout.json,
  );
  check('US12', 'His live connection is closed', await disconnected);
  const stillA = await call('GET', '/users/me', { token: ashaToken });
  check('US12', 'Asha stays signed in', stillA.status === 200);
  socket.close();

  console.log(`\n${passed} checks passed, ${failures.length} failed.`);
  if (failures.length) {
    console.log('Failed:\n' + failures.map((f) => `  - ${f}`).join('\n'));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
