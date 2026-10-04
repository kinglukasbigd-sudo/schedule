import { createBackup, parseBackup as parseBackupData, type Backup as BackupFile, type BackupData, type EncodedAttachment } from '@/logic/backup';
import type { Attachment } from '@/logic/types';
import { useData } from '@/state/data';
import { useSettings } from '@/state/settings';
import { db } from './db';

/** A parsed backup, ready to restore. */
export type Backup = BackupData;
export type { BackupFile };

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function base64ToBlob(data: string, mime: string): Blob {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function encode(a: Attachment): Promise<EncodedAttachment> {
  const { blob, thumb, ...meta } = a;
  return { ...meta, data: await blobToBase64(blob), thumb: thumb ? await blobToBase64(thumb) : null };
}

function decode(a: EncodedAttachment): Attachment {
  const { data, thumb, ...meta } = a;
  return { ...meta, blob: base64ToBlob(data, a.mime), thumb: thumb ? base64ToBlob(thumb, 'image/jpeg') : null };
}

/** Everything, as one backup file (F-12): version 2, attachments inlined. */
export async function exportBackup(now = new Date()): Promise<BackupFile> {
  const { subjects, timetables, holidays, tasks } = useData.getState();
  const attachments = await Promise.all((await db.attachments.toArray()).map(encode));
  return createBackup({ settings: useSettings.getState().settings, subjects, timetables, holidays, tasks, attachments }, now);
}

/** Validate an untrusted backup (v1 or v2). Throws a BackupError. */
export function parseBackup(json: unknown): Backup {
  return parseBackupData(json).data;
}

/** Replace everything with the backup's contents, atomically. */
export async function restoreBackup(backup: Backup): Promise<void> {
  await useData.getState().replaceAll({ ...backup, attachments: backup.attachments.map(decode) });
}

export async function eraseEverything(): Promise<void> {
  await useData.getState().eraseAll();
}
