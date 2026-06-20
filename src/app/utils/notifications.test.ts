import { describe, expect, it, vi } from 'vitest';
import { EventType, ReceiptType } from '$types/matrix-sdk';
import type { MatrixClient, MatrixEvent, Room } from '$types/matrix-sdk';
import { markAsRead } from './notifications';

const USER_ID = '@alice:example.com';

function makeEvent(eventId: string): MatrixEvent {
  return {
    getId: () => eventId,
    isSending: () => false,
  } as unknown as MatrixEvent;
}

function makeRoom(options: {
  receiptEventId?: string;
  fullyReadEventId?: string;
  events: MatrixEvent[];
  setRoomReadMarkers?: ReturnType<typeof vi.fn>;
  sendReadReceipt?: ReturnType<typeof vi.fn>;
}): { room: Room; mx: MatrixClient } {
  const setRoomReadMarkers =
    options.setRoomReadMarkers ?? vi.fn<() => Promise<undefined>>().mockResolvedValue(undefined);
  const sendReadReceipt =
    options.sendReadReceipt ?? vi.fn<() => Promise<undefined>>().mockResolvedValue(undefined);

  const room = {
    roomId: '!room:example.com',
    getEventReadUpTo: () => options.receiptEventId,
    getAccountData: (eventType: string) =>
      eventType === EventType.FullyRead && options.fullyReadEventId
        ? ({
            getContent: () => ({ event_id: options.fullyReadEventId }),
          } as unknown as MatrixEvent)
        : undefined,
    getLiveTimeline: () => ({
      getEvents: () => options.events,
    }),
  } as unknown as Room;

  const mx = {
    getUserId: () => USER_ID,
    getRoom: () => room,
    setRoomReadMarkers,
    sendReadReceipt,
  } as unknown as MatrixClient;

  return { room, mx };
}

describe('markAsRead', () => {
  it('still advances m.fully_read when the receipt is already at the latest event', async () => {
    const latestEvent = makeEvent('$latest');
    const setRoomReadMarkers = vi.fn<() => Promise<undefined>>().mockResolvedValue(undefined);
    const sendReadReceipt = vi.fn<() => Promise<undefined>>().mockResolvedValue(undefined);
    const { mx } = makeRoom({
      receiptEventId: '$latest',
      fullyReadEventId: '$older',
      events: [makeEvent('$older'), latestEvent],
      setRoomReadMarkers,
      sendReadReceipt,
    });

    await markAsRead(mx, '!room:example.com', false);

    expect(setRoomReadMarkers).toHaveBeenCalledWith('!room:example.com', '$latest', latestEvent);
    expect(sendReadReceipt).toHaveBeenCalledWith(latestEvent, ReceiptType.Read);
  });

  it('no-ops once both the receipt and fully-read marker already point at the latest event', async () => {
    const latestEvent = makeEvent('$latest');
    const setRoomReadMarkers = vi.fn<() => Promise<undefined>>().mockResolvedValue(undefined);
    const sendReadReceipt = vi.fn<() => Promise<undefined>>().mockResolvedValue(undefined);
    const { mx } = makeRoom({
      receiptEventId: '$latest',
      fullyReadEventId: '$latest',
      events: [latestEvent],
      setRoomReadMarkers,
      sendReadReceipt,
    });

    await markAsRead(mx, '!room:example.com', false);

    expect(setRoomReadMarkers).not.toHaveBeenCalled();
    expect(sendReadReceipt).not.toHaveBeenCalled();
  });
});
