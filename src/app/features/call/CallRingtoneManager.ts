import * as Sentry from '@sentry/react';
import { callRingtoneVolumeToGain } from './callRingtone';
import { resolveCallToneSources } from './callToneSources';
import type { Settings, CallRingtoneId } from '$state/settings';

export type PreviewTone = 'incoming' | 'outgoing';

class CallRingtoneManager {
  private incomingAudio: HTMLAudioElement;
  private outgoingAudio: HTMLAudioElement;
  private previewAudio: HTMLAudioElement;
  private revokeToneUrls: (() => void) | undefined;
  private currentPreviewUrl: string | null = null;
  private syncGeneration = 0;

  constructor() {
    this.incomingAudio = new Audio();
    this.incomingAudio.loop = true;

    this.outgoingAudio = new Audio();
    this.outgoingAudio.loop = true;

    this.previewAudio = new Audio();
    this.previewAudio.loop = true;
  }

  public async syncSources(
    callRingtoneId: CallRingtoneId,
    callRingbackTone: CallRingtoneId,
    callRingtoneVolume: number
  ) {
    // Rapid settings changes (e.g. clicking through the ringtone dropdown) fire this
    // repeatedly without awaiting the previous call. resolveCallToneSources can read
    // custom tones from IndexedDB, so calls can resolve out of order — without this
    // guard, an older call finishing last would apply stale URLs and could revoke the
    // newer call's already-applied blob URLs out from under the <audio> elements.
    const generation = ++this.syncGeneration;
    const resolved = await resolveCallToneSources({ callRingtoneId, callRingbackTone });
    if (generation !== this.syncGeneration) {
      resolved.revoke();
      return;
    }

    this.revokeToneUrls?.();
    this.revokeToneUrls = resolved.revoke;

    const gain = callRingtoneVolumeToGain(callRingtoneVolume);

    if (resolved.incomingUrl) {
      this.incomingAudio.src = resolved.incomingUrl;
    } else {
      this.incomingAudio.removeAttribute('src');
    }

    if (resolved.outgoingUrl) {
      this.outgoingAudio.src = resolved.outgoingUrl;
    } else {
      this.outgoingAudio.removeAttribute('src');
    }

    this.incomingAudio.volume = gain;
    this.outgoingAudio.volume = gain;
  }

  public playIncoming(): Promise<void> {
    if (!this.incomingAudio.src) return Promise.resolve();
    return this.incomingAudio.play().catch((err) => {
      if (err.name === 'AbortError') return;
      Sentry.metrics.count('sable.call.ringtone.blocked', 1);
      throw err;
    });
  }

  public stopIncoming() {
    this.incomingAudio.pause();
    this.incomingAudio.currentTime = 0;
  }

  public playOutgoing() {
    if (!this.outgoingAudio.src) return;
    this.outgoingAudio.play().catch((err) => {
      if (err.name === 'AbortError') return;
      Sentry.metrics.count('sable.call.ringback.blocked', 1);
    });
  }

  public stopOutgoing() {
    this.outgoingAudio.pause();
    this.outgoingAudio.currentTime = 0;
  }

  public async playPreview(
    tone: PreviewTone,
    settings: Pick<Settings, 'callRingtoneId' | 'callRingbackTone' | 'callRingtoneVolume'>
  ) {
    this.stopPreview();

    const resolved = await resolveCallToneSources({
      callRingtoneId: settings.callRingtoneId,
      callRingbackTone: settings.callRingbackTone,
    });
    const source = tone === 'incoming' ? resolved.incomingUrl : resolved.outgoingUrl;

    // When ringtone and ringback are both set to the same custom file, incomingUrl and
    // outgoingUrl are the same blob URL — don't revoke it as "the other tone's unused
    // URL" when it's actually the one we're about to play as `source`.
    if (tone === 'incoming' && resolved.outgoingUrl?.startsWith('blob:') && resolved.outgoingUrl !== source) {
      URL.revokeObjectURL(resolved.outgoingUrl);
    } else if (
      tone === 'outgoing' &&
      resolved.incomingUrl?.startsWith('blob:') &&
      resolved.incomingUrl !== source
    ) {
      URL.revokeObjectURL(resolved.incomingUrl);
    }

    if (!source) return;

    this.currentPreviewUrl = source;
    this.previewAudio.src = source;
    this.previewAudio.volume = callRingtoneVolumeToGain(settings.callRingtoneVolume);

    await this.previewAudio.play();
  }

  public stopPreview() {
    this.previewAudio.pause();
    this.previewAudio.currentTime = 0;
    this.previewAudio.removeAttribute('src');

    if (this.currentPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(this.currentPreviewUrl);
    }
    this.currentPreviewUrl = null;
  }
}

export const ringtoneManager = new CallRingtoneManager();
