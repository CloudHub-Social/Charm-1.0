import { Suspense } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BugReportModalRenderer } from './BugReportModal';

vi.mock('$state/hooks/bugReportModal', () => ({
  useBugReportModalOpen: vi.fn<() => boolean>(() => false),
  useCloseBugReportModal: vi.fn<() => () => void>(() => () => {}),
}));

describe('BugReportModalRenderer', () => {
  it('renders nothing when the modal is closed', () => {
    const { container } = render(
      <Suspense fallback={null}>
        <BugReportModalRenderer />
      </Suspense>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the modal is closed (snapshot)', () => {
    const { container } = render(
      <Suspense fallback={null}>
        <BugReportModalRenderer />
      </Suspense>
    );
    expect(container).toMatchSnapshot();
  });
});
