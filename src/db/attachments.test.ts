// @vitest-environment node
// Node's Blob is structured-cloneable, so IndexedDB (fake-indexeddb) can store it, as browsers do.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import * as actions from '@/state/actions';
import { useData } from '@/state/data';
import { task } from '@/test/builders';
import { base64ToBlob, blobToBase64, eraseEverything, exportBackup, parseBackup, restoreBackup } from './backup';
import { db } from './db';

const photo = () => new Blob([new Uint8Array([0, 1, 2, 250, 255])], { type: 'image/jpeg' });

beforeEach(async () => {
  await eraseEverything();
});

async function withAttachment() {
  actions.saveTask(task({ id: 'hw', due: '2026-10-05', attachmentIds: ['f1'] }));
  await db.attachments.put({ id: 'f1', taskId: 'hw', name: 'sheet.jpg', mime: 'image/jpeg', kind: 'image', size: 5, blob: photo(), thumb: photo(), createdAt: 1, updatedAt: 1 });
}

describe('attachments', () => {
  it('convert between Blobs and base64 losslessly, large ones too', async () => {
    expect(await blobToBase64(photo())).toBe('AAEC+v8=');
    const big = new Uint8Array(200_000).map((_, i) => i % 256);
    const back = new Uint8Array(await base64ToBlob(await blobToBase64(new Blob([big])), 'application/pdf').arrayBuffer());
    expect(back).toEqual(big);
  });

  it('round-trip through a backup, inlined (F-12, N-5)', async () => {
    await withAttachment();
    const file = JSON.parse(JSON.stringify(await exportBackup()));
    expect(file.attachments[0]).toMatchObject({ id: 'f1', data: 'AAEC+v8=', thumb: 'AAEC+v8=' });
    await eraseEverything();
    expect(await db.attachments.count()).toBe(0);
    await restoreBackup(parseBackup(file));
    const restored = await db.attachments.get('f1');
    expect(new Uint8Array(await (restored?.blob as Blob).arrayBuffer())).toEqual(new Uint8Array([0, 1, 2, 250, 255]));
    expect(restored?.blob.type).toBe('image/jpeg');
    expect(useData.getState().tasks[0]?.attachmentIds).toEqual(['f1']);
  });

  it('go with their task and come back with undo (invariant 7)', async () => {
    await withAttachment();
    const removed = await actions.deleteTask('hw');
    expect(await db.attachments.count()).toBe(0);
    await actions.undo(removed as actions.Undo);
    expect(await db.attachments.get('f1')).toMatchObject({ taskId: 'hw', name: 'sheet.jpg' });
  });
});
