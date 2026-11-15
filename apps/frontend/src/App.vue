<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';

type ViewName = 'dashboard' | 'servers' | 'notifications' | 'telegram' | 'settings';
type TagType = 'success' | 'warning' | 'danger' | 'info';

type ServerView = {
  id: number;
  name: string;
  ipAddress: string | null;
  provider: string;
  region: string;
  expiresAtUtc: string;
  renewalUrl: string | null;
  notes: string | null;
  status: 'active' | 'archived';
  reminderGeneration: number;
  archivedAtUtc: string | null;
  remainingSeconds: number;
  daysUntilExpiry: number;
};

type ServerListResponse = {
  items: ServerView[];
  total: number;
};

type NotificationItem = {
  id: number;
  planId: number;
  attemptNumber: number;
  outcome: 'sent' | 'failed' | 'unknown';
  startedAtUtc: string;
  finishedAtUtc: string | null;
  telegramMessageId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  retryable: boolean;
  serverName: string;
  triggerDaysBefore: number;
};

type NotificationListResponse = {
  items: NotificationItem[];
  total: number;
};

type TelegramStatus = {
  configured: boolean;
  schedulerEnabled: boolean;
};

type SettingsResponse = {
  displayTimezone: string;
};

type ReminderRule = {
  id: number;
  daysBefore: number;
  enabled: boolean;
  timesPerDay: number;
};

type ReminderRuleResponse = {
  rules: ReminderRule[];
};

const labels = {
  appName: '\u670d\u52a1\u5668\u5230\u671f\u63d0\u9192',
  login: '\u7ba1\u7406\u5458\u767b\u5f55',
  username: '\u7528\u6237\u540d',
  password: '\u5bc6\u7801',
  loginAction: '\u767b\u5f55',
  forgotPassword: '\u5fd8\u8bb0\u5bc6\u7801',
  recoveryCode: '\u6062\u590d\u7801',
  newPassword: '\u65b0\u5bc6\u7801',
  confirmPassword: '\u786e\u8ba4\u5bc6\u7801',
  resetPassword: '\u91cd\u7f6e\u5bc6\u7801',
  backToLogin: '\u8fd4\u56de\u767b\u5f55',
  recoveryHint: '\u8bf7\u5728\u670d\u52a1\u5668\u4e0a\u6267\u884c npm run admin:recovery:create \u83b7\u53d6 30 \u5206\u949f\u6709\u6548\u7684\u6062\u590d\u7801',
  passwordMinLength: '\u5bc6\u7801\u81f3\u5c11\u9700\u8981 8 \u4f4d',
  recoveryInvalid: '\u6062\u590d\u7801\u65e0\u6548\u6216\u5df2\u8fc7\u671f',
  dashboard: '\u4eea\u8868\u76d8',
  servers: '\u670d\u52a1\u5668',
  notifications: '\u901a\u77e5\u8bb0\u5f55',
  telegram: 'Telegram',
  settings: '\u7cfb\u7edf\u8bbe\u7f6e',
  timezone: '\u663e\u793a\u65f6\u533a',
  timezoneHint: '\u65f6\u95f4\u5728\u6570\u636e\u5e93\u4e2d\u4f7f\u7528 UTC \u4fdd\u5b58',
  saveSettings: '\u4fdd\u5b58\u8bbe\u7f6e',
  timezoneSaved: '\u65f6\u533a\u8bbe\u7f6e\u5df2\u4fdd\u5b58',
  reminderRules: '\u63d0\u9192\u9898\u89c4\u5219',
  daysBefore: '\u63d0\u524d\u5929\u6570',
  timesPerDay: '\u6bcf\u5929\u53d1\u9001\u6b21\u6570',
  ruleEnabled: '\u542f\u7528',
  ruleHint: '\u4fee\u6539\u540e\u5bf9\u65b0\u5efa\u3001\u7f16\u8f91\u5230\u671f\u65f6\u95f4\u6216\u7eed\u8d39\u540e\u751f\u6210\u7684\u8ba1\u5212\u751f\u6548',
  databaseBackup: '\u6570\u636e\u5e93\u5907\u4efd',
  exportDatabase: '\u5bfc\u51fa\u6570\u636e\u5e93',
  importDatabase: '\u5bfc\u5165\u6570\u636e\u5e93',
  databaseHint: '\u5bfc\u5165\u4f1a\u66ff\u6362\u5f53\u524d\u4e1a\u52a1\u6570\u636e\uff0c\u5b8c\u6210\u540e\u9700\u8981\u91cd\u65b0\u767b\u5f55',
  confirmImport: '\u786e\u5b9a\u5bfc\u5165\u8fd9\u4e2a\u6570\u636e\u5e93\u6587\u4ef6\u5417\uff1f\u5bfc\u5165\u540e\u5f53\u524d\u6570\u636e\u4f1a\u88ab\u66ff\u6362',
  time: '\u65f6\u95f4',
  logout: '\u9000\u51fa\u767b\u5f55',
  refresh: '\u5237\u65b0',
  activeServers: '\u6d3b\u8dc3\u670d\u52a1\u5668',
  archivedServers: '\u5386\u53f2\u8bb0\u5f55',
  expiringSoon: '\u4e03\u5929\u5185\u5230\u671f',
  overdue: '\u5df2\u5230\u671f',
  recentNotifications: '\u6700\u8fd1\u901a\u77e5',
  serverName: '\u540d\u79f0',
  ipAddress: 'IP \u5730\u5740\uff08\u53ef\u9009\uff09',
  provider: '\u670d\u52a1\u5546\uff08\u53ef\u9009\uff09',
  region: '\u5730\u533a\uff08\u53ef\u9009\uff09',
  expiresAt: '\u5230\u671f\u65f6\u95f4',
  expiresAtUtc: '\u5230\u671f\u65f6\u95f4 UTC',
  renewalUrl: '\u7eed\u8d39\u5730\u5740',
  notes: '\u5907\u6ce8',
  status: '\u72b6\u6001',
  actions: '\u64cd\u4f5c',
  addServer: '\u6dfb\u52a0\u670d\u52a1\u5668',
  editServer: '\u7f16\u8f91\u670d\u52a1\u5668',
  renewServer: '\u8bbe\u7f6e\u65b0\u5230\u671f\u65f6\u95f4',
  save: '\u4fdd\u5b58',
  cancel: '\u53d6\u6d88',
  edit: '\u7f16\u8f91',
  renew: '\u7eed\u8d39',
  archive: '\u5f52\u6863',
  restore: '\u6062\u590d',
  delete: '\u5220\u9664',
  active: '\u6d3b\u8dc3',
  archived: '\u5386\u53f2',
  search: '\u641c\u7d22\u540d\u79f0\u3001IP \u6216\u670d\u52a1\u5546',
  all: '\u5168\u90e8',
  empty: '\u6682\u65e0\u6570\u636e',
  notificationStatus: '\u53d1\u9001\u7ed3\u679c',
  sent: '\u5df2\u53d1\u9001',
  failed: '\u5931\u8d25',
  unknown: '\u7ed3\u679c\u4e0d\u786e\u5b9a',
  telegramConfigured: '\u673a\u5668\u4eba\u914d\u7f6e',
  schedulerStatus: '\u8c03\u5ea6\u5668',
  configured: '\u5df2\u914d\u7f6e',
  notConfigured: '\u672a\u914d\u7f6e',
  enabled: '\u5df2\u542f\u7528',
  disabled: '\u672a\u542f\u7528',
  testMessage: '\u6d4b\u8bd5\u6d88\u606f',
  sendTest: '\u53d1\u9001\u6d4b\u8bd5\u6d88\u606f',
  messagePlaceholder: '\u8f93\u5165\u8981\u53d1\u9001\u5230 Telegram \u7684\u6d88\u606f',
  loading: '\u52a0\u8f7d\u4e2d...',
  requestFailed: '\u8bf7\u6c42\u5931\u8d25',
  loginFailed: '\u7528\u6237\u540d\u6216\u5bc6\u7801\u9519\u8bef',
  confirmArchive: '\u786e\u5b9a\u8981\u5f52\u6863\u8fd9\u53f0\u670d\u52a1\u5668\u5417\uff1f',
  confirmRestore: '\u786e\u5b9a\u8981\u6062\u590d\u8fd9\u53f0\u670d\u52a1\u5668\u5417\uff1f',
  confirmDelete: '\u5220\u9664\u540e\u5c06\u540c\u65f6\u79fb\u9664\u8be5\u670d\u52a1\u5668\u7684\u63d0\u9192\u8ba1\u5212\u548c\u53d1\u9001\u8bb0\u5f55\uff0c\u786e\u5b9a\u7ee7\u7eed\u5417\uff1f',
  confirm: '\u786e\u5b9a',
  noNotifications: '\u6682\u65e0\u901a\u77e5\u8bb0\u5f55',
  deleteSelected: '\u5220\u9664\u9009\u4e2d',
  deleteAll: '\u5168\u90e8\u5220\u9664',
  confirmDeleteNotifications: '\u786e\u5b9a\u5220\u9664\u9009\u4e2d\u7684\u901a\u77e5\u8bb0\u5f55\u5417\uff1f',
  confirmDeleteAllNotifications: '\u786e\u5b9a\u5220\u9664\u5168\u90e8\u901a\u77e5\u8bb0\u5f55\u5417\uff1f',
  notificationRetention: '\u901a\u77e5\u8bb0\u5f55\u53ea\u4fdd\u7559\u6700\u8fd1 10 \u5929',
} as const;

const isCheckingSession = ref(true);
const isAuthenticated = ref(false);
const currentView = ref<ViewName>('dashboard');
const loginPending = ref(false);
const loginError = ref('');
const showForgotPassword = ref(false);
const recoveryPending = ref(false);
const recoveryError = ref('');
const loginForm = reactive({ username: '', password: '' });
const recoveryForm = reactive({ username: '', recoveryCode: '', newPassword: '', confirmPassword: '' });
const servers = ref<ServerView[]>([]);
const serverTotal = ref(0);
const serverSearch = ref('');
const serverStatusFilter = ref<'all'>('all');
const serverLoading = ref(false);
const notifications = ref<NotificationItem[]>([]);
const notificationTotal = ref(0);
const notificationFilter = ref<'all' | 'sent' | 'failed' | 'unknown'>('all');
const notificationLoading = ref(false);
const selectedNotificationIds = ref<number[]>([]);
const telegramStatus = ref<TelegramStatus>({ configured: false, schedulerEnabled: false });
const telegramMessage = ref('\u670d\u52a1\u5668\u5230\u671f\u63d0\u9192 Telegram \u6d4b\u8bd5\u6d88\u606f');
const telegramLoading = ref(false);
const telegramError = ref('');
const displayTimezone = ref('Asia/Shanghai');
const settingsLoading = ref(false);
const reminderRules = ref<ReminderRule[]>([]);
const rulesLoading = ref(false);
const rulesSaving = ref(false);
const databaseLoading = ref(false);
const importInput = ref<HTMLInputElement | null>(null);
const serverDialogVisible = ref(false);
const renewDialogVisible = ref(false);
const serverDialogLoading = ref(false);
const serverDialogMode = ref<'create' | 'edit'>('create');
const serverForm = reactive({
  id: null as number | null,
  name: '',
  ipAddress: '',
  provider: '',
  region: '',
  expiresAtLocal: '',
  renewalUrl: '',
  notes: '',
});
const renewForm = reactive({ id: 0, expiresAtLocal: '', renewalUrl: '', notes: '' });

const timezoneOptions = [
  { value: 'Asia/Shanghai', label: '\u5317\u4eac\u65f6\u95f4 (UTC+8)' },
  { value: 'UTC', label: 'UTC' },
];

const viewTitle = computed(() => {
  if (currentView.value === 'servers') return labels.servers;
  if (currentView.value === 'notifications') return labels.notifications;
  if (currentView.value === 'telegram') return labels.telegram;
  if (currentView.value === 'settings') return labels.settings;
  return labels.dashboard;
});

const summary = computed(() => ({
  active: servers.value.filter((server) => server.status === 'active').length,
  archived: servers.value.filter((server) => server.status === 'archived').length,
  expiringSoon: servers.value.filter((server) => server.status === 'active' && server.daysUntilExpiry >= 0 && server.daysUntilExpiry <= 7).length,
  overdue: servers.value.filter((server) => server.status === 'active' && server.daysUntilExpiry < 0).length,
}));

function timezoneParts(date: Date, timeZone: string): Record<string, string> {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
}

function formatZoned(value: string | null): string {
  if (!value) return '-';

  try {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: displayTimezone.value,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function utcToLocalInput(value: string): string {
  const parts = timezoneParts(new Date(value), displayTimezone.value);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function localInputToUtc(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    throw new Error(labels.expiresAt);
  }

  const wallTime = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    0,
  );
  let utcTime = wallTime;

  for (let index = 0; index < 3; index += 1) {
    const parts = timezoneParts(new Date(utcTime), displayTimezone.value);
    const representedTime = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    utcTime = wallTime - (representedTime - utcTime);
  }

  return new Date(utcTime).toISOString();
}

function daysLabel(server: ServerView): string {
  if (server.daysUntilExpiry < 0) return `${Math.abs(server.daysUntilExpiry)} \u5929\u524d\u5230\u671f`;
  if (server.daysUntilExpiry === 0) return '\u4eca\u5929\u5230\u671f';
  return `${server.daysUntilExpiry} \u5929`;
}

function daysTagType(server: ServerView): TagType {
  if (server.status === 'archived') return 'info';
  if (server.daysUntilExpiry < 0) return 'danger';
  if (server.daysUntilExpiry <= 7) return 'warning';
  return 'success';
}

function outcomeLabel(outcome: NotificationItem['outcome']): string {
  if (outcome === 'sent') return labels.sent;
  if (outcome === 'failed') return labels.failed;
  return labels.unknown;
}

function outcomeType(outcome: NotificationItem['outcome']): TagType {
  if (outcome === 'sent') return 'success';
  if (outcome === 'failed') return 'danger';
  return 'warning';
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (typeof init.body === 'string' && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const response = await fetch(path, { ...init, headers, credentials: 'include' });
  const payload = response.status === 204 ? undefined : (await response.json() as { error?: string; message?: string });

  if (response.status === 401) {
    isAuthenticated.value = false;
    currentView.value = 'dashboard';
    throw new Error('UNAUTHENTICATED');
  }

  if (!response.ok) {
    throw new Error(payload?.message ?? payload?.error ?? labels.requestFailed);
  }

  return payload as T;
}

async function submitLogin(): Promise<void> {
  loginPending.value = true;
  loginError.value = '';

  try {
    await apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify(loginForm) });
    isAuthenticated.value = true;
    loginForm.password = '';
    await loadDashboard();
  } catch (error) {
    loginError.value = error instanceof Error && error.message !== 'UNAUTHENTICATED' ? error.message : labels.loginFailed;
  } finally {
    loginPending.value = false;
  }
}

async function submitRecovery(): Promise<void> {
  recoveryError.value = '';

  if (recoveryForm.newPassword !== recoveryForm.confirmPassword) {
    recoveryError.value = labels.confirmPassword;
    return;
  }

  if (recoveryForm.newPassword.length < 8) {
    recoveryError.value = labels.passwordMinLength;
    return;
  }

  recoveryPending.value = true;

  try {
    await apiFetch('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({
        username: recoveryForm.username,
        recoveryCode: recoveryForm.recoveryCode,
        newPassword: recoveryForm.newPassword,
      }),
    });
    showForgotPassword.value = false;
    loginForm.username = recoveryForm.username;
    recoveryForm.recoveryCode = '';
    recoveryForm.newPassword = '';
    recoveryForm.confirmPassword = '';
    ElMessage.success(labels.resetPassword);
  } catch (error) {
    if (error instanceof Error && error.message === 'PASSWORD_TOO_SHORT') {
      recoveryError.value = labels.passwordMinLength;
    } else if (error instanceof Error && error.message === 'RECOVERY_INVALID') {
      recoveryError.value = labels.recoveryInvalid;
    } else {
      recoveryError.value = error instanceof Error ? error.message : labels.requestFailed;
    }
  } finally {
    recoveryPending.value = false;
  }
}

async function logout(): Promise<void> {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } finally {
    isAuthenticated.value = false;
    currentView.value = 'dashboard';
  }
}

async function loadServers(): Promise<void> {
  serverLoading.value = true;

  try {
    const query = new URLSearchParams({ status: serverStatusFilter.value, pageSize: '100' });
    if (serverSearch.value.trim()) query.set('q', serverSearch.value.trim());
    const response = await apiFetch<ServerListResponse>(`/api/servers?${query.toString()}`);
    servers.value = response.items;
    serverTotal.value = response.total;
  } catch (error) {
    if (!(error instanceof Error && error.message === 'UNAUTHENTICATED')) {
      ElMessage.error(error instanceof Error ? error.message : labels.requestFailed);
    }
  } finally {
    serverLoading.value = false;
  }
}

async function loadNotifications(): Promise<void> {
  notificationLoading.value = true;

  try {
    const query = new URLSearchParams({ limit: '100', outcome: notificationFilter.value });
    const response = await apiFetch<NotificationListResponse>(`/api/notifications?${query.toString()}`);
    notifications.value = response.items;
    notificationTotal.value = response.total;
  } catch (error) {
    if (!(error instanceof Error && error.message === 'UNAUTHENTICATED')) {
      ElMessage.error(error instanceof Error ? error.message : labels.requestFailed);
    }
  } finally {
    notificationLoading.value = false;
  }
}

function selectNotifications(rows: NotificationItem[]): void {
  selectedNotificationIds.value = rows.map((row) => row.id);
}

async function deleteSelectedNotifications(): Promise<void> {
  if (selectedNotificationIds.value.length === 0) return;

  try {
    await ElMessageBox.confirm(labels.confirmDeleteNotifications, labels.confirm, { type: 'warning', confirmButtonText: labels.delete });
    await apiFetch('/api/notifications', {
      method: 'DELETE',
      body: JSON.stringify({ ids: selectedNotificationIds.value }),
    });
    selectedNotificationIds.value = [];
    await loadNotifications();
    ElMessage.success(labels.delete);
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(error instanceof Error ? error.message : labels.requestFailed);
  }
}

async function deleteAllNotifications(): Promise<void> {
  try {
    await ElMessageBox.confirm(labels.confirmDeleteAllNotifications, labels.confirm, { type: 'warning', confirmButtonText: labels.delete });
    await apiFetch('/api/notifications', { method: 'DELETE', body: JSON.stringify({ all: true }) });
    selectedNotificationIds.value = [];
    await loadNotifications();
    ElMessage.success(labels.deleteAll);
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(error instanceof Error ? error.message : labels.requestFailed);
  }
}

async function loadTelegramStatus(): Promise<void> {
  try {
    telegramStatus.value = await apiFetch<TelegramStatus>('/api/telegram/status');
  } catch (error) {
    if (!(error instanceof Error && error.message === 'UNAUTHENTICATED')) {
      telegramError.value = error instanceof Error ? error.message : labels.requestFailed;
    }
  }
}

async function loadSettings(): Promise<void> {
  try {
    const response = await apiFetch<SettingsResponse>('/api/settings');
    displayTimezone.value = response.displayTimezone;
  } catch (error) {
    if (!(error instanceof Error && error.message === 'UNAUTHENTICATED')) {
      ElMessage.error(error instanceof Error ? error.message : labels.requestFailed);
    }
  }
}

async function saveSettings(): Promise<void> {
  settingsLoading.value = true;

  try {
    const response = await apiFetch<SettingsResponse>('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify({ displayTimezone: displayTimezone.value }),
    });
    displayTimezone.value = response.displayTimezone;
    await loadServers();
    ElMessage.success(labels.timezoneSaved);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : labels.requestFailed);
  } finally {
    settingsLoading.value = false;
  }
}

async function loadReminderRules(): Promise<void> {
  rulesLoading.value = true;

  try {
    const response = await apiFetch<ReminderRuleResponse>('/api/reminder-rules');
    reminderRules.value = response.rules;
  } catch (error) {
    if (!(error instanceof Error && error.message === 'UNAUTHENTICATED')) {
      ElMessage.error(error instanceof Error ? error.message : labels.requestFailed);
    }
  } finally {
    rulesLoading.value = false;
  }
}

async function saveReminderRules(): Promise<void> {
  rulesSaving.value = true;

  try {
    const response = await apiFetch<ReminderRuleResponse>('/api/reminder-rules', {
      method: 'PATCH',
      body: JSON.stringify({
        rules: reminderRules.value.map((rule) => ({
          daysBefore: rule.daysBefore,
          enabled: rule.enabled,
          timesPerDay: rule.timesPerDay,
        })),
      }),
    });
    reminderRules.value = response.rules;
    ElMessage.success(labels.saveSettings);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : labels.requestFailed);
  } finally {
    rulesSaving.value = false;
  }
}

async function exportDatabase(): Promise<void> {
  databaseLoading.value = true;

  try {
    const response = await fetch('/api/database/export', { credentials: 'include' });
    if (!response.ok) throw new Error(labels.requestFailed);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'server-expiry-backup.sqlite';
    anchor.click();
    URL.revokeObjectURL(url);
    ElMessage.success(labels.exportDatabase);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : labels.requestFailed);
  } finally {
    databaseLoading.value = false;
  }
}

function chooseDatabaseFile(): void {
  importInput.value?.click();
}

async function importDatabase(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';

  if (!file) return;

  try {
    await ElMessageBox.confirm(labels.confirmImport, labels.confirm, { type: 'warning', confirmButtonText: labels.importDatabase });
    databaseLoading.value = true;
    const formData = new FormData();
    formData.append('file', file);
    await apiFetch('/api/database/import', { method: 'POST', body: formData });
    await ElMessageBox.alert('\u6570\u636e\u5e93\u5bfc\u5165\u6210\u529f\uff0c\u70b9\u51fb\u786e\u5b9a\u540e\u91cd\u65b0\u767b\u5f55', labels.importDatabase);
    window.location.reload();
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(error instanceof Error ? error.message : labels.requestFailed);
  } finally {
    databaseLoading.value = false;
  }
}

async function loadDashboard(): Promise<void> {
  await Promise.all([loadServers(), loadNotifications(), loadTelegramStatus(), loadSettings(), loadReminderRules()]);
}

function selectView(view: string): void {
  currentView.value = view as ViewName;
  if (currentView.value === 'servers') void loadServers();
  if (currentView.value === 'notifications') void loadNotifications();
  if (currentView.value === 'telegram') void loadTelegramStatus();
  if (currentView.value === 'settings') void loadSettings();
  if (currentView.value === 'settings') void loadReminderRules();
}

function resetServerForm(): void {
  Object.assign(serverForm, {
    id: null,
    name: '',
    ipAddress: '',
    provider: '',
    region: '',
    expiresAtLocal: '',
    renewalUrl: '',
    notes: '',
  });
}

function openCreateServer(): void {
  resetServerForm();
  serverDialogMode.value = 'create';
  serverDialogVisible.value = true;
}

function openEditServer(server: ServerView): void {
  Object.assign(serverForm, {
    id: server.id,
    name: server.name,
    ipAddress: server.ipAddress,
    provider: server.provider,
    region: server.region,
    expiresAtLocal: utcToLocalInput(server.expiresAtUtc),
    renewalUrl: server.renewalUrl ?? '',
    notes: server.notes ?? '',
  });
  serverDialogMode.value = 'edit';
  serverDialogVisible.value = true;
}

function openRenewServer(server: ServerView): void {
  Object.assign(renewForm, {
    id: server.id,
    expiresAtLocal: utcToLocalInput(server.expiresAtUtc),
    renewalUrl: server.renewalUrl ?? '',
    notes: server.notes ?? '',
  });
  renewDialogVisible.value = true;
}

async function saveServer(): Promise<void> {
  serverDialogLoading.value = true;

  try {
    const body = JSON.stringify({
      name: serverForm.name,
      ipAddress: serverForm.ipAddress,
      provider: serverForm.provider,
      region: serverForm.region,
      expiresAtUtc: localInputToUtc(serverForm.expiresAtLocal),
      renewalUrl: serverForm.renewalUrl || null,
      notes: serverForm.notes || null,
    });

    await apiFetch(serverForm.id ? `/api/servers/${serverForm.id}` : '/api/servers', {
      method: serverForm.id ? 'PATCH' : 'POST',
      body,
    });
    serverDialogVisible.value = false;
    ElMessage.success(labels.save);
    await loadServers();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : labels.requestFailed);
  } finally {
    serverDialogLoading.value = false;
  }
}

async function renewServer(server: ServerView): Promise<void> {
  serverDialogLoading.value = true;

  try {
    await apiFetch(`/api/servers/${server.id}/renew`, {
      method: 'POST',
      body: JSON.stringify({
        expiresAtUtc: localInputToUtc(renewForm.expiresAtLocal),
        renewalUrl: renewForm.renewalUrl || null,
        notes: renewForm.notes || null,
      }),
    });
    renewDialogVisible.value = false;
    ElMessage.success(labels.renew);
    await loadServers();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : labels.requestFailed);
  } finally {
    serverDialogLoading.value = false;
  }
}

async function submitRenew(): Promise<void> {
  const server = servers.value.find((item) => item.id === renewForm.id);
  if (server) {
    await renewServer(server);
  }
}

async function deleteServer(server: ServerView): Promise<void> {
  try {
    await ElMessageBox.confirm(labels.confirmDelete, labels.confirm, { type: 'warning', confirmButtonText: labels.delete });
    await apiFetch(`/api/servers/${server.id}`, { method: 'DELETE' });
    ElMessage.success(labels.delete);
    await loadServers();
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(error instanceof Error ? error.message : labels.requestFailed);
  }
}

async function sendTelegramTest(): Promise<void> {
  telegramLoading.value = true;
  telegramError.value = '';

  try {
    await apiFetch('/api/telegram/test', { method: 'POST', body: JSON.stringify({ message: telegramMessage.value }) });
    ElMessage.success(labels.sendTest);
  } catch (error) {
    telegramError.value = error instanceof Error ? error.message : labels.requestFailed;
  } finally {
    telegramLoading.value = false;
  }
}

onMounted(async () => {
  try {
    await apiFetch('/api/auth/me');
    isAuthenticated.value = true;
    await loadDashboard();
  } catch {
    isAuthenticated.value = false;
  } finally {
    isCheckingSession.value = false;
  }
});
</script>

<template>
  <div v-if="isCheckingSession" class="loading-page">{{ labels.loading }}</div>

  <div v-else-if="!isAuthenticated" class="login-page">
    <el-card class="login-card" shadow="never">
      <p class="eyebrow">SERVER EXPIRY REMINDER</p>
      <h1>{{ showForgotPassword ? labels.forgotPassword : labels.login }}</h1>
      <p class="login-subtitle">{{ labels.appName }}</p>
      <el-alert v-if="showForgotPassword ? recoveryError : loginError" :title="showForgotPassword ? recoveryError : loginError" type="error" show-icon :closable="false" />
      <el-form v-if="!showForgotPassword" class="login-form" label-position="top" @submit.prevent="submitLogin">
        <el-form-item :label="labels.username"><el-input v-model="loginForm.username" autocomplete="username" /></el-form-item>
        <el-form-item :label="labels.password"><el-input v-model="loginForm.password" type="password" show-password autocomplete="current-password" @keyup.enter="submitLogin" /></el-form-item>
        <el-button class="login-button" type="primary" :loading="loginPending" @click="submitLogin">{{ labels.loginAction }}</el-button>
        <el-link class="forgot-link" type="primary" :underline="true" @click="showForgotPassword = true">{{ labels.forgotPassword }}</el-link>
      </el-form>
      <el-form v-else class="login-form" label-position="top" @submit.prevent="submitRecovery">
        <p class="recovery-hint">{{ labels.recoveryHint }}</p>
        <el-form-item :label="labels.username"><el-input v-model="recoveryForm.username" autocomplete="username" /></el-form-item>
        <el-form-item :label="labels.recoveryCode"><el-input v-model="recoveryForm.recoveryCode" /></el-form-item>
        <el-form-item :label="labels.newPassword"><el-input v-model="recoveryForm.newPassword" type="password" show-password /></el-form-item>
        <el-form-item :label="labels.confirmPassword"><el-input v-model="recoveryForm.confirmPassword" type="password" show-password @keyup.enter="submitRecovery" /></el-form-item>
        <el-button class="login-button" type="primary" :loading="recoveryPending" @click="submitRecovery">{{ labels.resetPassword }}</el-button>
        <el-link class="forgot-link" type="primary" :underline="true" @click="showForgotPassword = false">{{ labels.backToLogin }}</el-link>
      </el-form>
    </el-card>
  </div>

  <el-container v-else class="admin-shell">
    <el-aside class="sidebar" width="230px">
      <div class="brand-block">
        <p class="eyebrow">SERVER EXPIRY REMINDER</p>
        <strong>{{ labels.appName }}</strong>
      </div>
      <el-menu :default-active="currentView" class="side-menu" @select="selectView">
        <el-menu-item index="dashboard">{{ labels.dashboard }}</el-menu-item>
        <el-menu-item index="servers">{{ labels.servers }}</el-menu-item>
        <el-menu-item index="notifications">{{ labels.notifications }}</el-menu-item>
        <el-menu-item index="telegram">{{ labels.telegram }}</el-menu-item>
        <el-menu-item index="settings">{{ labels.settings }}</el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="topbar">
        <h1>{{ viewTitle }}</h1>
        <el-button text @click="logout">{{ labels.logout }}</el-button>
      </el-header>

      <el-main class="content-area">
        <section v-if="currentView === 'dashboard'" class="view-section">
          <div class="section-heading">
            <div>
              <p class="eyebrow">OVERVIEW</p>
              <h2>{{ labels.dashboard }}</h2>
            </div>
            <el-button @click="loadDashboard">{{ labels.refresh }}</el-button>
          </div>

          <div class="metric-grid">
            <el-card shadow="never"><span>{{ labels.activeServers }}</span><strong>{{ summary.active }}</strong></el-card>
            <el-card shadow="never"><span>{{ labels.expiringSoon }}</span><strong class="warning-text">{{ summary.expiringSoon }}</strong></el-card>
            <el-card shadow="never"><span>{{ labels.overdue }}</span><strong class="danger-text">{{ summary.overdue }}</strong></el-card>
            <el-card shadow="never"><span>{{ labels.archivedServers }}</span><strong>{{ summary.archived }}</strong></el-card>
          </div>

          <el-card class="panel-card" shadow="never">
            <template #header><div class="panel-heading"><span>{{ labels.recentNotifications }}</span><el-button link @click="selectView('notifications')">{{ labels.notifications }}</el-button></div></template>
            <el-table :data="notifications.slice(0, 5)" row-key="id">
              <el-table-column prop="serverName" :label="labels.serverName" />
              <el-table-column :label="labels.notificationStatus"><template #default="{ row }"><el-tag :type="outcomeType(row.outcome)">{{ outcomeLabel(row.outcome) }}</el-tag></template></el-table-column>
              <el-table-column :label="labels.time"><template #default="{ row }">{{ formatZoned(row.startedAtUtc) }}</template></el-table-column>
            </el-table>
            <el-empty v-if="notifications.length === 0" :description="labels.noNotifications" />
          </el-card>
        </section>

        <section v-else-if="currentView === 'servers'" class="view-section">
          <div class="section-heading"><div><p class="eyebrow">SERVER INVENTORY</p><h2>{{ labels.servers }} <small>{{ serverTotal }}</small></h2></div><el-button type="primary" @click="openCreateServer">{{ labels.addServer }}</el-button></div>
          <el-card class="panel-card" shadow="never">
            <div class="toolbar">
              <el-input v-model="serverSearch" :placeholder="labels.search" clearable @keyup.enter="loadServers" />
              <el-select v-model="serverStatusFilter" @change="loadServers"><el-option value="all" :label="labels.all" /></el-select>
              <el-button @click="loadServers">{{ labels.search }}</el-button>
            </div>
            <el-table v-loading="serverLoading" :data="servers" row-key="id" empty-text="">
              <el-table-column prop="name" :label="labels.serverName" min-width="160" />
              <el-table-column :label="labels.ipAddress" min-width="140"><template #default="{ row }">{{ row.ipAddress || '-' }}</template></el-table-column>
              <el-table-column prop="provider" :label="labels.provider" min-width="130" />
              <el-table-column prop="region" :label="labels.region" min-width="100" />
              <el-table-column :label="`${labels.expiresAt} (${displayTimezone})`" min-width="190"><template #default="{ row }"><div>{{ formatZoned(row.expiresAtUtc) }}</div><el-tag size="small" :type="daysTagType(row)">{{ daysLabel(row) }}</el-tag></template></el-table-column>
              <el-table-column :label="labels.status" width="100"><template #default="{ row }"><el-tag :type="row.status === 'active' ? 'success' : 'info'">{{ row.status === 'active' ? labels.active : labels.archived }}</el-tag></template></el-table-column>
              <el-table-column fixed="right" :label="labels.actions" width="230"><template #default="{ row }"><el-button link type="primary" @click="openEditServer(row)">{{ labels.edit }}</el-button><el-button v-if="row.status === 'active'" link type="primary" @click="openRenewServer(row)">{{ labels.renew }}</el-button><el-button link type="danger" @click="deleteServer(row)">{{ labels.delete }}</el-button></template></el-table-column>
            </el-table>
            <el-empty v-if="!serverLoading && servers.length === 0" :description="labels.empty" />
          </el-card>
        </section>

        <section v-else-if="currentView === 'notifications'" class="view-section">
          <div class="section-heading"><div><p class="eyebrow">DELIVERY HISTORY</p><h2>{{ labels.notifications }} <small>{{ notificationTotal }}</small></h2></div><el-button @click="loadNotifications">{{ labels.refresh }}</el-button></div>
          <el-card class="panel-card" shadow="never">
            <div class="toolbar"><el-select v-model="notificationFilter" @change="loadNotifications"><el-option value="all" :label="labels.all" /><el-option value="sent" :label="labels.sent" /><el-option value="failed" :label="labels.failed" /><el-option value="unknown" :label="labels.unknown" /></el-select><el-button type="danger" :disabled="selectedNotificationIds.length === 0" @click="deleteSelectedNotifications">{{ labels.deleteSelected }}</el-button><el-button type="danger" plain :disabled="notificationTotal === 0" @click="deleteAllNotifications">{{ labels.deleteAll }}</el-button></div>
            <p class="form-hint">{{ labels.notificationRetention }}</p>
            <el-table v-loading="notificationLoading" :data="notifications" row-key="id" @selection-change="selectNotifications">
              <el-table-column type="selection" width="48" />
              <el-table-column prop="serverName" :label="labels.serverName" min-width="160" />
              <el-table-column :label="labels.notificationStatus" width="130"><template #default="{ row }"><el-tag :type="outcomeType(row.outcome)">{{ outcomeLabel(row.outcome) }}</el-tag></template></el-table-column>
              <el-table-column prop="attemptNumber" label="#" width="70" />
              <el-table-column :label="labels.time" min-width="190"><template #default="{ row }">{{ formatZoned(row.startedAtUtc) }}</template></el-table-column>
              <el-table-column prop="errorMessage" :label="labels.notes" min-width="220" />
            </el-table>
            <el-empty v-if="!notificationLoading && notifications.length === 0" :description="labels.noNotifications" />
          </el-card>
        </section>

        <section v-else-if="currentView === 'telegram'" class="view-section">
          <div class="section-heading"><div><p class="eyebrow">TELEGRAM</p><h2>{{ labels.telegram }}</h2></div><el-button @click="loadTelegramStatus">{{ labels.refresh }}</el-button></div>
          <el-card class="panel-card telegram-panel" shadow="never">
            <div class="status-row"><span>{{ labels.telegramConfigured }}</span><el-tag :type="telegramStatus.configured ? 'success' : 'danger'">{{ telegramStatus.configured ? labels.configured : labels.notConfigured }}</el-tag></div>
            <div class="status-row"><span>{{ labels.schedulerStatus }}</span><el-tag :type="telegramStatus.schedulerEnabled ? 'success' : 'warning'">{{ telegramStatus.schedulerEnabled ? labels.enabled : labels.disabled }}</el-tag></div>
            <el-divider />
            <el-form label-position="top"><el-form-item :label="labels.testMessage"><el-input v-model="telegramMessage" type="textarea" :rows="4" :placeholder="labels.messagePlaceholder" /></el-form-item><el-alert v-if="telegramError" :title="telegramError" type="error" show-icon :closable="false" /><el-button type="primary" :loading="telegramLoading" :disabled="!telegramStatus.configured" @click="sendTelegramTest">{{ labels.sendTest }}</el-button></el-form>
          </el-card>
        </section>

        <section v-else class="view-section">
          <div class="section-heading"><div><p class="eyebrow">SETTINGS</p><h2>{{ labels.settings }}</h2></div><el-button @click="loadSettings">{{ labels.refresh }}</el-button></div>
          <el-card class="panel-card settings-panel" shadow="never">
            <el-form label-position="top">
              <el-form-item :label="labels.timezone">
                <el-select v-model="displayTimezone" style="width: 100%">
                  <el-option v-for="option in timezoneOptions" :key="option.value" :value="option.value" :label="option.label" />
                </el-select>
                <p class="form-hint">{{ labels.timezoneHint }}</p>
              </el-form-item>
              <el-button type="primary" :loading="settingsLoading" @click="saveSettings">{{ labels.saveSettings }}</el-button>
            </el-form>
          </el-card>
          <el-card class="panel-card settings-panel rules-card" shadow="never">
            <template #header><div class="panel-heading"><span>{{ labels.reminderRules }}</span><el-button link @click="loadReminderRules">{{ labels.refresh }}</el-button></div></template>
            <p class="form-hint">{{ labels.ruleHint }}</p>
            <el-table v-loading="rulesLoading" :data="reminderRules" row-key="id">
              <el-table-column :label="labels.daysBefore" width="150"><template #default="{ row }">{{ row.daysBefore === 0 ? '\u5f53\u5929' : `${row.daysBefore} \u5929` }}</template></el-table-column>
              <el-table-column :label="labels.timesPerDay" width="220"><template #default="{ row }"><el-input-number v-model="row.timesPerDay" :min="1" :max="24" /></template></el-table-column>
              <el-table-column :label="labels.ruleEnabled" width="120"><template #default="{ row }"><el-switch v-model="row.enabled" /></template></el-table-column>
            </el-table>
            <div class="rules-footer"><el-button type="primary" :loading="rulesSaving" @click="saveReminderRules">{{ labels.saveSettings }}</el-button></div>
          </el-card>
          <el-card class="panel-card settings-panel rules-card" shadow="never">
            <template #header><div class="panel-heading"><span>{{ labels.databaseBackup }}</span></div></template>
            <p class="form-hint">{{ labels.databaseHint }}</p>
            <div class="database-actions">
              <el-button :loading="databaseLoading" @click="exportDatabase">{{ labels.exportDatabase }}</el-button>
              <el-button type="primary" :loading="databaseLoading" @click="chooseDatabaseFile">{{ labels.importDatabase }}</el-button>
              <input ref="importInput" class="hidden-file-input" type="file" accept=".sqlite,.db,application/octet-stream" @change="importDatabase" />
            </div>
          </el-card>
        </section>
      </el-main>
    </el-container>
  </el-container>

  <el-dialog v-model="serverDialogVisible" :title="serverDialogMode === 'create' ? labels.addServer : labels.editServer" width="600px">
    <el-form label-position="top">
      <div class="form-grid"><el-form-item :label="labels.serverName"><el-input v-model="serverForm.name" /></el-form-item><el-form-item :label="labels.ipAddress"><el-input v-model="serverForm.ipAddress" /></el-form-item><el-form-item :label="labels.provider"><el-input v-model="serverForm.provider" clearable /></el-form-item><el-form-item :label="labels.region"><el-input v-model="serverForm.region" clearable /></el-form-item></div>
      <el-form-item :label="`${labels.expiresAt} (${displayTimezone})`"><el-date-picker v-model="serverForm.expiresAtLocal" popper-class="apple-date-picker" type="datetime" value-format="YYYY-MM-DD HH:mm" format="YYYY-MM-DD HH:mm" :placeholder="labels.expiresAt" style="width: 100%" /></el-form-item>
      <el-form-item :label="labels.renewalUrl"><el-input v-model="serverForm.renewalUrl" placeholder="https://" /></el-form-item>
      <el-form-item :label="labels.notes"><el-input v-model="serverForm.notes" type="textarea" :rows="3" /></el-form-item>
    </el-form>
    <template #footer><el-button @click="serverDialogVisible = false">{{ labels.cancel }}</el-button><el-button type="primary" :loading="serverDialogLoading" @click="saveServer">{{ labels.save }}</el-button></template>
  </el-dialog>

  <el-dialog v-model="renewDialogVisible" :title="labels.renewServer" width="520px">
    <el-form label-position="top"><el-form-item :label="`${labels.expiresAt} (${displayTimezone})`"><el-date-picker v-model="renewForm.expiresAtLocal" popper-class="apple-date-picker" type="datetime" value-format="YYYY-MM-DD HH:mm" format="YYYY-MM-DD HH:mm" :placeholder="labels.expiresAt" style="width: 100%" /></el-form-item><el-form-item :label="labels.renewalUrl"><el-input v-model="renewForm.renewalUrl" /></el-form-item><el-form-item :label="labels.notes"><el-input v-model="renewForm.notes" type="textarea" :rows="3" /></el-form-item></el-form>
    <template #footer><el-button @click="renewDialogVisible = false">{{ labels.cancel }}</el-button><el-button type="primary" :loading="serverDialogLoading" @click="submitRenew">{{ labels.save }}</el-button></template>
  </el-dialog>
</template>
