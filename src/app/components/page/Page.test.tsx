import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScreenSize, ScreenSizeProvider } from '$hooks/useScreenSize';
import { PageNavHeader, PageHeader } from './Page';
import * as css from './style.css';

describe('PageNavHeader', () => {
  it('renders with position:relative class for safe-area ::before support', () => {
    const { container } = render(
      <ScreenSizeProvider value={ScreenSize.Mobile}>
        <PageNavHeader>Settings</PageNavHeader>
      </ScreenSizeProvider>
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('applies the PageNavHeader recipe class', () => {
    const { getByText } = render(
      <ScreenSizeProvider value={ScreenSize.Mobile}>
        <PageNavHeader>Settings</PageNavHeader>
      </ScreenSizeProvider>
    );
    expect(getByText('Settings').closest('header')).toHaveClass(css.PageNavHeader({}));
  });

  it('applies the outlined variant class by default', () => {
    const { getByText } = render(
      <ScreenSizeProvider value={ScreenSize.Mobile}>
        <PageNavHeader>Settings</PageNavHeader>
      </ScreenSizeProvider>
    );
    expect(getByText('Settings').closest('header')).toHaveClass(css.PageNavHeader({ outlined: true }));
  });
});

describe('PageHeader', () => {
  it('renders with position:relative class for safe-area ::before support', () => {
    const { container } = render(
      <ScreenSizeProvider value={ScreenSize.Mobile}>
        <PageHeader>Devices</PageHeader>
      </ScreenSizeProvider>
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('applies the PageHeader recipe class', () => {
    const { getByText } = render(
      <ScreenSizeProvider value={ScreenSize.Mobile}>
        <PageHeader>Devices</PageHeader>
      </ScreenSizeProvider>
    );
    expect(getByText('Devices').closest('header')).toHaveClass(css.PageHeader({}));
  });

  it('applies the outlined variant class by default', () => {
    const { getByText } = render(
      <ScreenSizeProvider value={ScreenSize.Mobile}>
        <PageHeader>Devices</PageHeader>
      </ScreenSizeProvider>
    );
    expect(getByText('Devices').closest('header')).toHaveClass(css.PageHeader({ outlined: true }));
  });

  it('applies the balance variant class when balance prop is set', () => {
    const { getByText } = render(
      <ScreenSizeProvider value={ScreenSize.Mobile}>
        <PageHeader balance>Devices</PageHeader>
      </ScreenSizeProvider>
    );
    expect(getByText('Devices').closest('header')).toHaveClass(css.PageHeader({ balance: true }));
  });
});
