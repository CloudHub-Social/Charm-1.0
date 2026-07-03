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
});
