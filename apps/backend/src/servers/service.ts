import type { SqliteDatabase } from '../db/database.js';

const millisecondsPerDay = 24 * 60 * 60 * 1000;

export type ServerStatus = 'active' | 'archived';

export type ServerRecord = {
  id: number;
  name: string;
  ip_address: string;
  provider: string;
  region: string;
  expires_at_utc: string;
  renewal_url: string | null;
  notes: string | null;
  status: ServerStatus;
  reminder_generation: number;
  archived_at_utc: string | null;
  created_at_utc: string;
  updated_at_utc: string;
};

export type ServerView = {
  id: number;
  name: string;
  ipAddress: string;
  provider: string;
  region: string;
  expiresAtUtc: string;
  renewalUrl: string | null;
  notes: string | null;
  status: ServerStatus;
  reminderGeneration: number;
  archivedAtUtc: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  remainingSeconds: number;
  daysUntilExpiry: number;
};

export type ServerInput = {
  name?: unknown;
  ipAddress?: unknown;
  provider?: unknown;
  region?: unknown;
  expiresAtUtc?: unknown;
  renewalUrl?: unknown;
  notes?: unknown;
};

export type ServerListOptions = {
  status: 'active' | 'archived' | 'all';
  search: string;
  page: number;
  pageSize: number;
};

export class ServerServiceError extends Error {
  constructor(
    public readonly statusCode: 400 | 404 | 409,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function requiredText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') {
    throw new ServerServiceError(400, 'INVALID_REQUEST', `${field} must be a string`);
  }

  const normalized = value.trim();

  if (!normalized || normalized.length > maxLength) {
    throw new ServerServiceError(400, 'INVALID_REQUEST', `${field} is required and must be at most ${maxLength} characters`);
  }

  return normalized;
}

function optionalText(value: unknown, field: string, maxLength: number): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string' || value.trim().length > maxLength) {
    throw new ServerServiceError(400, 'INVALID_REQUEST', `${field} must be at most ${maxLength} characters`);
  }

  return value.trim() || null;
}

function utcTimestamp(value: unknown): string {
  if (typeof value !== 'string' || !value.endsWith('Z')) {
    throw new ServerServiceError(400, 'INVALID_REQUEST', 'expiresAtUtc must be an ISO timestamp ending in Z');
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new ServerServiceError(400, 'INVALID_REQUEST', 'expiresAtUtc is invalid');
  }

  return parsed.toISOString();
}

function optionalRenewalUrl(value: unknown): string | null {
  const normalized = optionalText(value, 'renewalUrl', 2048);

  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(normalized);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Unsupported protocol');
    }
  } catch {
    throw new ServerServiceError(400, 'INVALID_REQUEST', 'renewalUrl must be an HTTP or HTTPS URL');
  }

  return normalized;
}

function nowUtc(): string {
  return new Date().toISOString();
}

function toView(record: ServerRecord, now = Date.now()): ServerView {
  const remainingSeconds = Math.ceil((new Date(record.expires_at_utc).getTime() - now) / 1000);

  return {
    id: record.id,
    name: record.name,
    ipAddress: record.ip_address,
    provider: record.provider,
    region: record.region,
    expiresAtUtc: record.expires_at_utc,
    renewalUrl: record.renewal_url,
    notes: record.notes,
    status: record.status,
    reminderGeneration: record.reminder_generation,
    archivedAtUtc: record.archived_at_utc,
    createdAtUtc: record.created_at_utc,
    updatedAtUtc: record.updated_at_utc,
    remainingSeconds,
    daysUntilExpiry: Math.ceil(remainingSeconds / (millisecondsPerDay / 1000)),
  };
}

function findRecord(database: SqliteDatabase, id: number): ServerRecord | undefined {
  return database
    .prepare(
      `SELECT id, name, ip_address, provider, region, expires_at_utc, renewal_url, notes,
              status, reminder_generation, archived_at_utc, created_at_utc, updated_at_utc
       FROM servers
       WHERE id = ?`,
    )
    .get(id) as ServerRecord | undefined;
}

function parseId(rawId: string): number {
  const id = Number.parseInt(rawId, 10);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new ServerServiceError(400, 'INVALID_ID', 'Server id must be a positive integer');
  }

  return id;
}

function cancelPendingPlans(database: SqliteDatabase, serverId: number, timestamp: string): void {
  database
    .prepare(
      `UPDATE notification_plans
       SET status = 'cancelled', cancelled_at_utc = ?, updated_at_utc = ?
       WHERE server_id = ?
         AND status IN ('pending', 'processing', 'failed', 'unknown')`,
    )
    .run(timestamp, timestamp, serverId);
}

function createPlans(database: SqliteDatabase, serverId: number, generation: number, expiresAtUtc: string, timestamp: string): void {
  const rules = database
    .prepare('SELECT days_before, times_per_day FROM reminder_rules WHERE enabled = 1 ORDER BY days_before DESC')
    .all() as Array<{ days_before: number; times_per_day: number }>;
  const insertPlan = database.prepare(
    `INSERT INTO notification_plans
      (server_id, plan_generation, trigger_days_before, occurrence_index, times_per_day,
       scheduled_for_utc, created_at_utc, updated_at_utc)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const expiryMs = new Date(expiresAtUtc).getTime();

  for (const rule of rules) {
    const timesPerDay = Math.min(Math.max(rule.times_per_day, 1), 24);
    const windowEndMs = expiryMs - rule.days_before * millisecondsPerDay;
    const intervalMs = millisecondsPerDay / timesPerDay;

    for (let occurrenceIndex = 1; occurrenceIndex <= timesPerDay; occurrenceIndex += 1) {
      const scheduledForUtc = new Date(windowEndMs - millisecondsPerDay + intervalMs * occurrenceIndex).toISOString();
      insertPlan.run(
        serverId,
        generation,
        rule.days_before,
        occurrenceIndex,
        timesPerDay,
        scheduledForUtc,
        timestamp,
        timestamp,
      );
    }
  }
}

function parseCreateInput(input: ServerInput): {
  name: string;
  ipAddress: string;
  provider: string;
  region: string;
  expiresAtUtc: string;
  renewalUrl: string | null;
  notes: string | null;
} {
  return {
    name: requiredText(input.name, 'name', 200),
    ipAddress: optionalText(input.ipAddress, 'ipAddress', 255) ?? '',
    provider: optionalText(input.provider, 'provider', 200) ?? '',
    region: optionalText(input.region, 'region', 200) ?? '',
    expiresAtUtc: utcTimestamp(input.expiresAtUtc),
    renewalUrl: optionalRenewalUrl(input.renewalUrl),
    notes: optionalText(input.notes, 'notes', 5000),
  };
}

export function createServer(database: SqliteDatabase, input: ServerInput): ServerView {
  const values = parseCreateInput(input);
  const timestamp = nowUtc();
  const create = database.transaction(() => {
    const result = database
      .prepare(
        `INSERT INTO servers (name, ip_address, provider, region, expires_at_utc, renewal_url, notes, updated_at_utc)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        values.name,
        values.ipAddress,
        values.provider,
        values.region,
        values.expiresAtUtc,
        values.renewalUrl,
        values.notes,
        timestamp,
      );
    const id = Number(result.lastInsertRowid);
    createPlans(database, id, 1, values.expiresAtUtc, timestamp);
    return findRecord(database, id);
  });
  const record = create();

  if (!record) {
    throw new Error('Created server could not be loaded');
  }

  return toView(record);
}

export function listServers(database: SqliteDatabase, options: ServerListOptions): {
  items: ServerView[];
  page: number;
  pageSize: number;
  total: number;
} {
  const filters: string[] = [];
  const parameters: Array<string | number> = [];

  if (options.status !== 'all') {
    filters.push('status = ?');
    parameters.push(options.status);
  }

  if (options.search) {
    filters.push('(name LIKE ? OR ip_address LIKE ? OR provider LIKE ? OR region LIKE ?)');
    const search = `%${options.search}%`;
    parameters.push(search, search, search, search);
  }

  const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  const totalRow = database.prepare(`SELECT COUNT(*) AS count FROM servers ${where}`).get(...parameters) as { count: number };
  const rows = database
    .prepare(
      `SELECT id, name, ip_address, provider, region, expires_at_utc, renewal_url, notes,
              status, reminder_generation, archived_at_utc, created_at_utc, updated_at_utc
       FROM servers
       ${where}
       ORDER BY expires_at_utc ASC, id ASC
       LIMIT ? OFFSET ?`,
    )
    .all(...parameters, options.pageSize, (options.page - 1) * options.pageSize) as ServerRecord[];

  return {
    items: rows.map((row) => toView(row)),
    page: options.page,
    pageSize: options.pageSize,
    total: totalRow.count,
  };
}

export function getServer(database: SqliteDatabase, rawId: string): ServerView {
  const record = findRecord(database, parseId(rawId));

  if (!record) {
    throw new ServerServiceError(404, 'SERVER_NOT_FOUND', 'Server was not found');
  }

  return toView(record);
}

export function updateServer(database: SqliteDatabase, rawId: string, input: ServerInput): ServerView {
  const id = parseId(rawId);
  const current = findRecord(database, id);

  if (!current) {
    throw new ServerServiceError(404, 'SERVER_NOT_FOUND', 'Server was not found');
  }

  const values = {
    name: input.name === undefined ? current.name : requiredText(input.name, 'name', 200),
    ipAddress: input.ipAddress === undefined ? current.ip_address : optionalText(input.ipAddress, 'ipAddress', 255) ?? '',
    provider: input.provider === undefined ? current.provider : optionalText(input.provider, 'provider', 200) ?? '',
    region: input.region === undefined ? current.region : optionalText(input.region, 'region', 200) ?? '',
    expiresAtUtc: input.expiresAtUtc === undefined ? current.expires_at_utc : utcTimestamp(input.expiresAtUtc),
    renewalUrl: input.renewalUrl === undefined ? current.renewal_url : optionalRenewalUrl(input.renewalUrl),
    notes: input.notes === undefined ? current.notes : optionalText(input.notes, 'notes', 5000),
  };
  const timestamp = nowUtc();
  const expiryChanged = values.expiresAtUtc !== current.expires_at_utc;
  const update = database.transaction(() => {
    const generation = expiryChanged ? current.reminder_generation + 1 : current.reminder_generation;
    database
      .prepare(
        `UPDATE servers
         SET name = ?, ip_address = ?, provider = ?, region = ?, expires_at_utc = ?,
             renewal_url = ?, notes = ?, reminder_generation = ?, updated_at_utc = ?
         WHERE id = ?`,
      )
      .run(
        values.name,
        values.ipAddress,
        values.provider,
        values.region,
        values.expiresAtUtc,
        values.renewalUrl,
        values.notes,
        generation,
        timestamp,
        id,
      );

    if (expiryChanged) {
      cancelPendingPlans(database, id, timestamp);
      if (current.status === 'active') {
        createPlans(database, id, generation, values.expiresAtUtc, timestamp);
      }
    }

    return findRecord(database, id);
  });
  const record = update();

  if (!record) {
    throw new Error('Updated server could not be loaded');
  }

  return toView(record);
}

export function renewServer(database: SqliteDatabase, rawId: string, input: ServerInput): ServerView {
  const id = parseId(rawId);
  const current = findRecord(database, id);

  if (!current) {
    throw new ServerServiceError(404, 'SERVER_NOT_FOUND', 'Server was not found');
  }

  const expiresAtUtc = utcTimestamp(input.expiresAtUtc);
  const renewalUrl = input.renewalUrl === undefined ? current.renewal_url : optionalRenewalUrl(input.renewalUrl);
  const notes = input.notes === undefined ? current.notes : optionalText(input.notes, 'notes', 5000);
  const timestamp = nowUtc();
  const renew = database.transaction(() => {
    const generation = current.reminder_generation + 1;
    cancelPendingPlans(database, id, timestamp);
    database
      .prepare(
        `UPDATE servers
         SET expires_at_utc = ?, renewal_url = ?, notes = ?, status = 'active', archived_at_utc = NULL,
             reminder_generation = ?, updated_at_utc = ?
         WHERE id = ?`,
      )
      .run(expiresAtUtc, renewalUrl, notes, generation, timestamp, id);
    createPlans(database, id, generation, expiresAtUtc, timestamp);
    return findRecord(database, id);
  });
  const record = renew();

  if (!record) {
    throw new Error('Renewed server could not be loaded');
  }

  return toView(record);
}

export function archiveServer(database: SqliteDatabase, rawId: string): ServerView {
  const id = parseId(rawId);
  const timestamp = nowUtc();
  const archive = database.transaction(() => {
    const current = findRecord(database, id);

    if (!current) {
      throw new ServerServiceError(404, 'SERVER_NOT_FOUND', 'Server was not found');
    }

    cancelPendingPlans(database, id, timestamp);
    database
      .prepare(
        `UPDATE servers
         SET status = 'archived', archived_at_utc = ?, updated_at_utc = ?
         WHERE id = ?`,
      )
      .run(timestamp, timestamp, id);
    return findRecord(database, id);
  });
  const record = archive();

  if (!record) {
    throw new Error('Archived server could not be loaded');
  }

  return toView(record);
}

export function deleteServer(database: SqliteDatabase, rawId: string): void {
  const id = parseId(rawId);
  const remove = database.transaction(() => {
    const current = findRecord(database, id);

    if (!current) {
      throw new ServerServiceError(404, 'SERVER_NOT_FOUND', 'Server was not found');
    }

    database.prepare('DELETE FROM servers WHERE id = ?').run(id);
  });

  remove();
}

export function restoreServer(database: SqliteDatabase, rawId: string): ServerView {
  const id = parseId(rawId);
  const timestamp = nowUtc();
  const restore = database.transaction(() => {
    const current = findRecord(database, id);

    if (!current) {
      throw new ServerServiceError(404, 'SERVER_NOT_FOUND', 'Server was not found');
    }

    const generation = current.reminder_generation + 1;
    cancelPendingPlans(database, id, timestamp);
    database
      .prepare(
        `UPDATE servers
         SET status = 'active', archived_at_utc = NULL, reminder_generation = ?, updated_at_utc = ?
         WHERE id = ?`,
      )
      .run(generation, timestamp, id);
    createPlans(database, id, generation, current.expires_at_utc, timestamp);
    return findRecord(database, id);
  });
  const record = restore();

  if (!record) {
    throw new Error('Restored server could not be loaded');
  }

  return toView(record);
}

export function parseListOptions(query: { status?: string; q?: string; page?: string; pageSize?: string }): ServerListOptions {
  const status = query.status ?? 'active';
  const page = Number.parseInt(query.page ?? '1', 10);
  const pageSize = Number.parseInt(query.pageSize ?? '20', 10);

  if (status !== 'active' && status !== 'archived' && status !== 'all') {
    throw new ServerServiceError(400, 'INVALID_QUERY', 'status must be active, archived, or all');
  }

  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new ServerServiceError(400, 'INVALID_QUERY', 'page must be positive and pageSize must be between 1 and 100');
  }

  return {
    status,
    search: query.q?.trim() ?? '',
    page,
    pageSize,
  };
}

export function parseServerId(rawId: string): number {
  return parseId(rawId);
}
