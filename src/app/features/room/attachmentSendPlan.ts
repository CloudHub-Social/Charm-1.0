import type { TUploadItem } from '$state/room/roomInputDrafts';

export type ComposerAttachmentCaption = {
  body: string;
  formattedBody?: string;
};

const hasOwnCaption = (item: Pick<TUploadItem, 'body' | 'formatted_body'>): boolean =>
  (typeof item.body === 'string' && item.body.trim().length > 0) ||
  (typeof item.formatted_body === 'string' && item.formatted_body.trim().length > 0);

export function createAttachmentSendPlan(
  items: Array<Pick<TUploadItem, 'body' | 'formatted_body'>>,
  composerCaption?: ComposerAttachmentCaption
): Array<ComposerAttachmentCaption | undefined> {
  if (items.length === 0) return [];
  if (!composerCaption || composerCaption.body.trim().length === 0) {
    return items.map(() => undefined);
  }

  return items.map((item, index) => {
    if (index !== 0 || hasOwnCaption(item)) return undefined;
    return composerCaption;
  });
}

export function applyAttachmentSendPlan(
  items: TUploadItem[],
  composerCaption?: ComposerAttachmentCaption
): TUploadItem[] {
  const plan = createAttachmentSendPlan(items, composerCaption);

  return items.map((item, index) => {
    const caption = plan[index];
    if (!caption) return item;

    return {
      ...item,
      body: caption.body,
      formatted_body: caption.formattedBody,
    };
  });
}
