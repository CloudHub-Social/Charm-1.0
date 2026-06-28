import { describe, expect, it } from 'vitest';
import type { TUploadItem } from '$state/room/roomInputDrafts';
import { applyAttachmentSendPlan, createAttachmentSendPlan } from './attachmentSendPlan';

const makeUpload = (overrides: Partial<TUploadItem> = {}): TUploadItem =>
  ({
    file: { name: 'file.png', size: 1, type: 'image/png' } as TUploadItem['file'],
    originalFile: { name: 'file.png', size: 1, type: 'image/png' } as TUploadItem['originalFile'],
    metadata: { markedAsSpoiler: false },
    encInfo: undefined,
    ...overrides,
  }) as TUploadItem;

describe('createAttachmentSendPlan', () => {
  it('returns no caption plan when there are no attachments', () => {
    expect(createAttachmentSendPlan([], { body: 'hello' })).toEqual([]);
  });

  it('applies composer text to a single attachment', () => {
    expect(
      createAttachmentSendPlan([makeUpload()], { body: 'hello', formattedBody: '<p>hello</p>' })
    ).toEqual([{ body: 'hello', formattedBody: '<p>hello</p>' }]);
  });

  it('applies composer text only to the first attachment in a multi-upload batch', () => {
    expect(createAttachmentSendPlan([makeUpload(), makeUpload()], { body: 'hello' })).toEqual([
      { body: 'hello' },
      undefined,
    ]);
  });

  it('does not override an attachment-specific description on the first item', () => {
    expect(
      createAttachmentSendPlan([makeUpload({ body: 'custom' }), makeUpload()], { body: 'hello' })
    ).toEqual([undefined, undefined]);
  });

  it('treats empty composer text as no shared caption', () => {
    expect(createAttachmentSendPlan([makeUpload()], { body: '   ' })).toEqual([undefined]);
  });
});

describe('applyAttachmentSendPlan', () => {
  it('copies the shared composer caption onto the first attachment', () => {
    const planned = applyAttachmentSendPlan([makeUpload(), makeUpload()], {
      body: 'caption',
      formattedBody: '<p>caption</p>',
    });

    expect(planned[0]).toMatchObject({
      body: 'caption',
      formatted_body: '<p>caption</p>',
    });
    expect(planned[1]).not.toHaveProperty('body');
  });

  it('preserves an attachment-specific caption over the shared composer caption', () => {
    const planned = applyAttachmentSendPlan(
      [makeUpload({ body: 'upload caption', formatted_body: '<p>upload caption</p>' })],
      {
        body: 'composer caption',
        formattedBody: '<p>composer caption</p>',
      }
    );

    expect(planned[0]).toMatchObject({
      body: 'upload caption',
      formatted_body: '<p>upload caption</p>',
    });
  });
});
