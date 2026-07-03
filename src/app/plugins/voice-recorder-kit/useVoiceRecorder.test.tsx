import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { primeAudioContext, useVoiceRecorder } from './useVoiceRecorder';

type MockTrack = MediaStreamTrack & { stop: ReturnType<typeof vi.fn> };
type MockStream = MediaStream & { getTracks: () => MockTrack[] };

type MockNode = {
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

type MockAnalyserNode = MockNode & {
  fftSize: number;
  smoothingTimeConstant: number;
  frequencyBinCount: number;
  getByteFrequencyData: (data: Uint8Array) => void;
};

type MockAudioContextInstance = {
  state: AudioContextState;
  destination: MockNode;
  close: () => Promise<void>;
  resume: () => Promise<void>;
  suspend: () => Promise<void>;
  createMediaStreamSource: () => MockNode;
  createAnalyser: () => MockAnalyserNode;
  createMediaStreamDestination: () => { stream: { getTracks: () => MockTrack[] } };
  createMediaElementSource: () => MockNode;
};

const nativeAudioContext = globalThis.AudioContext;
const nativeMediaRecorder = globalThis.MediaRecorder;
const nativeRequestAnimationFrame = globalThis.requestAnimationFrame;
const nativeCancelAnimationFrame = globalThis.cancelAnimationFrame;
const nativeMediaDevices = navigator.mediaDevices;

let inputTrack: MockTrack;
let inputStream: MockStream;
let destinationTrack: MockTrack;
let createdAudioContexts: MockAudioContextInstance[];

function createMockTrack(): MockTrack {
  return {
    stop: vi.fn<() => void>(),
  } as unknown as MockTrack;
}

function createMockNode(): MockNode {
  return {
    connect: vi.fn<() => void>(),
    disconnect: vi.fn<() => void>(),
  };
}

function createMockAnalyserNode(): MockAnalyserNode {
  return {
    ...createMockNode(),
    fftSize: 0,
    smoothingTimeConstant: 0,
    frequencyBinCount: 16,
    getByteFrequencyData: vi.fn<(data: Uint8Array) => void>((data: Uint8Array) => data.fill(0)),
  };
}

class MockMediaRecorder {
  public static isTypeSupported = vi.fn<() => boolean>(() => true);

  public state: RecordingState = 'inactive';

  public ondataavailable: ((event: BlobEvent) => void) | null = null;

  public onstop: (() => void) | null = null;

  constructor(public readonly stream: MediaStream) {}

  start() {
    this.state = 'recording';
  }

  stop() {
    if (this.state === 'inactive') return;
    this.state = 'inactive';
    this.onstop?.();
  }

  public requestData = vi.fn<() => void>();

  pause() {
    this.state = 'paused';
  }
}

function createMockAudioContext(): MockAudioContextInstance {
  const context: MockAudioContextInstance = {
    state: 'running',
    destination: createMockNode(),
    close: vi.fn<() => Promise<void>>(async () => {
      context.state = 'closed';
    }),
    resume: vi.fn<() => Promise<void>>(async () => {
      context.state = 'running';
    }),
    suspend: vi.fn<() => Promise<void>>(async () => {
      context.state = 'suspended';
    }),
    createMediaStreamSource: vi.fn<() => MockNode>(() => createMockNode()),
    createAnalyser: vi.fn<() => MockAnalyserNode>(() => createMockAnalyserNode()),
    createMediaStreamDestination: vi.fn<() => { stream: { getTracks: () => MockTrack[] } }>(() => ({
      ...createMockNode(),
      stream: {
        getTracks: () => [destinationTrack],
      },
    })),
    createMediaElementSource: vi.fn<() => MockNode>(() => createMockNode()),
  };
  createdAudioContexts.push(context);
  return context;
}

function MockAudioContext(): MockAudioContextInstance {
  return createMockAudioContext();
}

beforeEach(() => {
  inputTrack = createMockTrack();
  inputStream = {
    getTracks: () => [inputTrack],
  } as unknown as MockStream;
  destinationTrack = createMockTrack();
  createdAudioContexts = [];

  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi.fn<() => Promise<MockStream>>(async () => inputStream),
    },
  });

  globalThis.requestAnimationFrame = vi.fn<() => number>(() => 1);
  globalThis.cancelAnimationFrame = vi.fn<() => void>();

  globalThis.AudioContext = MockAudioContext as unknown as typeof AudioContext;

  globalThis.MediaRecorder = MockMediaRecorder as unknown as typeof MediaRecorder;
});

afterEach(() => {
  globalThis.AudioContext = nativeAudioContext;
  globalThis.MediaRecorder = nativeMediaRecorder;
  globalThis.requestAnimationFrame = nativeRequestAnimationFrame;
  globalThis.cancelAnimationFrame = nativeCancelAnimationFrame;
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: nativeMediaDevices,
  });
});

describe('useVoiceRecorder', () => {
  it('fully tears down the recording graph when recording stops', async () => {
    const { result } = renderHook(() => useVoiceRecorder({ autoStart: false }));

    act(() => {
      result.current.start();
    });

    await waitFor(() => {
      expect(result.current.isRecording).toBe(true);
    });

    const recordingContext = createdAudioContexts[0];
    expect(recordingContext).toBeDefined();

    act(() => {
      result.current.handleStop();
    });

    await waitFor(() => {
      expect(result.current.isRecording).toBe(false);
    });

    expect(inputTrack.stop).toHaveBeenCalledTimes(1);
    expect(destinationTrack.stop).toHaveBeenCalledTimes(1);
    expect(recordingContext?.close).toHaveBeenCalledTimes(1);
  });

  it('reuses a primed AudioContext instead of creating a new one, and consumes it', async () => {
    act(() => {
      primeAudioContext();
    });
    expect(createdAudioContexts).toHaveLength(1);
    const primedContext = createdAudioContexts[0];

    const { result } = renderHook(() => useVoiceRecorder({ autoStart: false }));

    act(() => {
      result.current.start();
    });

    await waitFor(() => {
      expect(result.current.isRecording).toBe(true);
    });

    // setupAudioGraph() should have reused the primed context rather than
    // creating a second one.
    expect(createdAudioContexts).toHaveLength(1);
    expect(createdAudioContexts[0]).toBe(primedContext);

    act(() => {
      result.current.handleStop();
    });

    await waitFor(() => {
      expect(result.current.isRecording).toBe(false);
    });

    // A subsequent prime should create a fresh context — the previous one was
    // consumed, not left around to be reused indefinitely.
    act(() => {
      primeAudioContext();
    });
    expect(createdAudioContexts).toHaveLength(2);

    // Drain this trailing prime so it doesn't bleed into the next test — the
    // module-level primedAudioContext isn't reset between tests, and a later
    // primeAudioContext() call would otherwise silently reuse this (running,
    // unconsumed) context instead of constructing a fresh mock.
    const trailingPrimedContext = createdAudioContexts[1];
    await act(async () => {
      await trailingPrimedContext?.close();
    });
  });

  it('closes an unconsumed primed AudioContext if starting fails before the audio graph is built', async () => {
    act(() => {
      primeAudioContext();
    });
    const primedContext = createdAudioContexts[0];
    expect(primedContext?.close).not.toHaveBeenCalled();

    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(
      new Error('Permission denied')
    );

    const { result } = renderHook(() => useVoiceRecorder({ autoStart: false }));

    act(() => {
      result.current.start();
    });

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    // The primed context was never handed to setupAudioGraph(), so
    // cleanupAudioContext() must close it directly to avoid an indefinitely
    // running AudioContext.
    expect(primedContext?.close).toHaveBeenCalledTimes(1);
  });

  it('does not let a delayed resume() rejection from a superseded context discard a newer one', async () => {
    // The module-level primed-context state isn't reset between tests, so a
    // previous test can leave a context primed. Drain it via a full
    // start/stop cycle so this test starts from a known (unprimed) baseline.
    act(() => {
      primeAudioContext();
    });
    const { result: warmup } = renderHook(() => useVoiceRecorder({ autoStart: false }));
    act(() => {
      warmup.current.start();
    });
    await waitFor(() => {
      expect(warmup.current.isRecording).toBe(true);
    });
    act(() => {
      warmup.current.handleStop();
    });
    await waitFor(() => {
      expect(warmup.current.isRecording).toBe(false);
    });
    createdAudioContexts = [];

    // Make the first primed context's resume() controllable so we can reject
    // it after it has already been consumed by an active recording.
    let rejectFirstResume: ((reason?: unknown) => void) | undefined;
    // Must be a regular function, not an arrow function, so it can be
    // invoked with `new` — an arrow function throws when constructed, which
    // primeAudioContext()'s try/catch would otherwise swallow silently.
    globalThis.AudioContext = function AudioContextWithControllableResume() {
      const context = createMockAudioContext();
      context.resume = vi.fn<() => Promise<void>>(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectFirstResume = reject;
          })
      );
      return context;
    } as unknown as typeof AudioContext;

    act(() => {
      primeAudioContext();
    });
    const firstContext = createdAudioContexts[0];

    // Restore normal (resolving) resume() behavior for subsequent contexts.
    globalThis.AudioContext = MockAudioContext as unknown as typeof AudioContext;

    // The first primed context gets consumed by a recording that starts and
    // fully finishes — matching the real UI, which never re-primes while a
    // recording is already showing.
    const { result } = renderHook(() => useVoiceRecorder({ autoStart: false }));
    act(() => {
      result.current.start();
    });
    await waitFor(() => {
      expect(result.current.isRecording).toBe(true);
    });
    expect(createdAudioContexts).toHaveLength(1);

    act(() => {
      result.current.handleStop();
    });
    await waitFor(() => {
      expect(result.current.isRecording).toBe(false);
    });
    // handleStop() closes the (now-live) first context as part of normal
    // recording teardown.
    expect(firstContext?.close).toHaveBeenCalledTimes(1);

    // A second, unrelated prime for the next recording attempt.
    act(() => {
      primeAudioContext();
    });
    const secondContext = createdAudioContexts[1];
    expect(secondContext).not.toBe(firstContext);

    // The first context's resume() finally rejects, long after that context
    // was consumed, torn down, and superseded by the second primed context.
    act(() => {
      rejectFirstResume?.(new Error('resume failed'));
    });
    await waitFor(() => {
      // Flushed microtasks; nothing to assert on directly, just letting the
      // rejection handler run.
      expect(true).toBe(true);
    });

    // The stale rejection handler must not touch the second (current)
    // primed context or clear the shared primed-context reference out from
    // under it.
    expect(secondContext?.close).not.toHaveBeenCalled();

    const { result: nextAttempt } = renderHook(() => useVoiceRecorder({ autoStart: false }));
    act(() => {
      nextAttempt.current.start();
    });
    await waitFor(() => {
      expect(nextAttempt.current.isRecording).toBe(true);
    });

    // setupAudioGraph() should still find the second context primed and
    // reuse it rather than creating a third one.
    expect(createdAudioContexts).toHaveLength(2);
  });

  it('does not let an unrelated cleanupAudioContext() call discard a context primed for the next attempt', async () => {
    // Prime a context for an upcoming recording attempt.
    act(() => {
      primeAudioContext();
    });
    const primedContext = createdAudioContexts[0];
    expect(primedContext?.close).not.toHaveBeenCalled();

    // A separate hook instance's cleanupAudioContext() runs for an unrelated
    // reason (e.g. playback teardown, or tearing down an idle recorder) with
    // no primed context of its own to consume. This must not reach into the
    // shared primedAudioContext and discard the one above.
    const { result: unrelated } = renderHook(() => useVoiceRecorder({ autoStart: false }));
    act(() => {
      unrelated.current.handleDelete();
    });

    expect(primedContext?.close).not.toHaveBeenCalled();

    // The primed context must still be available for the real next attempt.
    const { result } = renderHook(() => useVoiceRecorder({ autoStart: false }));
    act(() => {
      result.current.start();
    });
    await waitFor(() => {
      expect(result.current.isRecording).toBe(true);
    });
    expect(createdAudioContexts).toHaveLength(1);
    expect(createdAudioContexts[0]).toBe(primedContext);
  });

  it('does not let an unmounting instance discard a context primed for a different, still-pending instance', async () => {
    // An unrelated instance — e.g. the thread drawer's composer — that never
    // primes or starts anything of its own.
    const { unmount: unmountOther } = renderHook(() => useVoiceRecorder({ autoStart: false }));

    act(() => {
      primeAudioContext();
    });
    const primedContext = createdAudioContexts[0];
    expect(primedContext?.close).not.toHaveBeenCalled();

    // Hold getUserMedia pending so this instance's start() has snapshotted
    // the primed context but not yet consumed it via setupAudioGraph() when
    // the unrelated instance unmounts.
    let resolveGetUserMedia: ((stream: MockStream) => void) | undefined;
    vi.mocked(navigator.mediaDevices.getUserMedia).mockImplementationOnce(
      () =>
        new Promise<MockStream>((resolve) => {
          resolveGetUserMedia = resolve;
        })
    );

    const { result } = renderHook(() => useVoiceRecorder({ autoStart: false }));
    act(() => {
      result.current.start();
    });

    // The unrelated instance unmounts while our attempt is still awaiting
    // getUserMedia — it must not discard the context primed for this attempt.
    act(() => {
      unmountOther();
    });
    expect(primedContext?.close).not.toHaveBeenCalled();

    await act(async () => {
      resolveGetUserMedia?.(inputStream);
    });

    await waitFor(() => {
      expect(result.current.isRecording).toBe(true);
    });

    // setupAudioGraph() should still have reused the primed context.
    expect(createdAudioContexts).toHaveLength(1);
    expect(createdAudioContexts[0]).toBe(primedContext);
  });

  it('discards an unconsumed primed AudioContext if handleResume fails before the audio graph is built', async () => {
    act(() => {
      primeAudioContext();
    });
    const primedContext = createdAudioContexts[0];
    expect(primedContext?.close).not.toHaveBeenCalled();

    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(
      new Error('Permission denied')
    );

    const { result } = renderHook(() => useVoiceRecorder({ autoStart: false }));

    act(() => {
      result.current.handleResume();
    });

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    // The primed context was never handed to setupAudioGraph(), so
    // handleResume's catch block must close it directly to avoid an
    // indefinitely running AudioContext — matching internalStartRecording's
    // catch block.
    expect(primedContext?.close).toHaveBeenCalledTimes(1);
  });
});
