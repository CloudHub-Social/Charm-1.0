import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { ClientConfigProvider } from '$hooks/useClientConfig';
import { ScreenSize, ScreenSizeProvider } from '$hooks/useScreenSize';
import { SettingsLinkProvider } from '$features/settings/SettingsLinkContext';
import { SettingTile } from './SettingTile';
import {
  settingTileSettingLinkActionDesktopHidden,
  settingTileSettingLinkActionMobileVisible,
  settingTileSettingLinkActionTransparentBackground,
} from './SettingTile.css';

const writeText = vi.fn<() => Promise<void>>();

function CustomSelect({ disabled }: { disabled?: boolean }) {
  return <button type="button">{disabled ? 'Disabled' : 'Enabled'}</button>;
}

function renderTile(
  screenSize: ScreenSize,
  focusId?: string,
  options?: Partial<React.ComponentProps<typeof SettingTile>>
) {
  return render(
    <ClientConfigProvider value={{}}>
      <ScreenSizeProvider value={screenSize}>
        <SettingsLinkProvider
          value={{ section: 'appearance', baseUrl: 'https://settings.example' }}
        >
          <SettingTile focusId={focusId} title="Appearance" {...options} />
        </SettingsLinkProvider>
      </ScreenSizeProvider>
    </ClientConfigProvider>
  );
}

beforeEach(() => {
  writeText.mockReset();
  vi.stubGlobal('navigator', { clipboard: { writeText } } as unknown as Navigator);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SettingTile', () => {
  it('copies the real settings link when a focus id is present', async () => {
    writeText.mockResolvedValueOnce(undefined);

    renderTile(ScreenSize.Desktop, 'message-link-preview');

    fireEvent.click(screen.getByRole('button', { name: /copy settings link/i }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        'https://settings.example/settings/appearance?focus=message-link-preview&moe.sable.client.action=settings'
      );
    });
    expect(screen.getByRole('button', { name: /copied settings link/i })).toBeInTheDocument();
  });

  it('keeps the copy state unchanged when clipboard write fails', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'));

    renderTile(ScreenSize.Desktop, 'message-link-preview');

    fireEvent.click(screen.getByRole('button', { name: /copy settings link/i }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        'https://settings.example/settings/appearance?focus=message-link-preview&moe.sable.client.action=settings'
      );
    });
    expect(screen.getByRole('button', { name: /copy settings link/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /copied settings link/i })).not.toBeInTheDocument();
  });

  it('does not render a copy button without a focus id', () => {
    renderTile(ScreenSize.Desktop);

    expect(screen.queryByRole('button', { name: /copy settings link/i })).not.toBeInTheDocument();
  });

  it('does not render a copy button when setting link actions are disabled', () => {
    renderTile(ScreenSize.Desktop, 'message-link-preview', {
      showSettingLinkAction: false,
    });

    expect(screen.queryByRole('button', { name: /copy settings link/i })).not.toBeInTheDocument();
  });

  it('uses the desktop hidden-until-hover class for the setting link action', () => {
    renderTile(ScreenSize.Desktop, 'message-link-preview');

    expect(screen.getByText('Appearance').parentElement).toContainElement(
      screen.getByRole('button', { name: /copy settings link/i })
    );
    expect(screen.getByRole('button', { name: /copy settings link/i })).toHaveClass(
      settingTileSettingLinkActionTransparentBackground,
      {
        exact: false,
      }
    );
    expect(screen.getByRole('button', { name: /copy settings link/i })).toHaveClass(
      settingTileSettingLinkActionDesktopHidden
    );
  });

  it('uses the mobile always-visible class for the setting link action', () => {
    renderTile(ScreenSize.Mobile, 'message-link-preview');

    expect(screen.getByRole('button', { name: /copy settings link/i })).toHaveClass(
      settingTileSettingLinkActionMobileVisible
    );
  });

  it('labels a trailing switch with the tile title via aria-labelledby', () => {
    renderTile(ScreenSize.Desktop, 'system-theme', {
      title: 'System Theme',
      // SettingTile injects the label at runtime; this control has none of its own.
      // oxlint-disable-next-line jsx-a11y/control-has-associated-label
      after: <button type="button" role="switch" aria-checked={false} />,
    });

    const titleEl = screen.getByText('System Theme');
    const switchEl = screen.getByRole('switch');

    expect(titleEl.id).toBeTruthy();
    expect(switchEl).toHaveAttribute('aria-labelledby', titleEl.id);
    expect(screen.getByRole('switch', { name: 'System Theme' })).toBeInTheDocument();
  });

  it('does not override an after element that already declares its own accessible name', () => {
    renderTile(ScreenSize.Desktop, 'reduced-motion', {
      title: 'Reduced Motion',
      after: <button type="button" role="switch" aria-checked={false} aria-label="Custom label" />,
    });

    const switchEl = screen.getByRole('switch');
    expect(switchEl).toHaveAttribute('aria-label', 'Custom label');
    expect(switchEl).not.toHaveAttribute('aria-labelledby');
  });

  it('does not crash when after is not a single valid element', () => {
    expect(() =>
      renderTile(ScreenSize.Desktop, 'multi-after', {
        title: 'Multiple Controls',
        after: (
          <>
            <button type="button">One</button>
            <button type="button">Two</button>
          </>
        ),
      })
    ).not.toThrow();
  });

  it('does not override an after element that already has its own text-content label', () => {
    renderTile(ScreenSize.Desktop, 'reset-all-push-notifications', {
      title: 'Reset All Push Notifications',
      after: <button type="button">Reset All</button>,
    });

    const button = screen.getByRole('button', { name: 'Reset All' });
    expect(button).not.toHaveAttribute('aria-labelledby');
  });

  it('does not warn or crash when after is a custom component with no children of its own', () => {
    expect(() =>
      renderTile(ScreenSize.Desktop, 'custom-select', {
        title: 'Custom Select',
        after: <CustomSelect disabled={false} />,
      })
    ).not.toThrow();

    expect(screen.getByRole('button', { name: 'Enabled' })).toBeInTheDocument();
  });

  it('does not add aria-labelledby when the tile has no title', () => {
    renderTile(ScreenSize.Desktop, undefined, {
      title: undefined,
      // SettingTile must not inject a label here; this control has none of its own.
      // oxlint-disable-next-line jsx-a11y/control-has-associated-label
      after: <button type="button" role="switch" aria-checked={false} />,
    });

    expect(screen.getByRole('switch')).not.toHaveAttribute('aria-labelledby');
  });
});
