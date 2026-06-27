import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScreenSize, ScreenSizeProvider } from '$hooks/useScreenSize';
import { PageNavHeader, PageHeader } from './Page';
import * as css from './style.css';

describe('PageNavHeader', () => {
  it('renders with the default recipe class applied', () => {
    render(
      <ScreenSizeProvider value={ScreenSize.Mobile}>
        <PageNavHeader>Settings</PageNavHeader>
      </ScreenSizeProvider>
    );
    expect(screen.getByText('Settings').closest('header')).toHaveClass(css.PageNavHeader({}));
  });

  it('applies the outlined variant class by default', () => {
    render(
      <ScreenSizeProvider value={ScreenSize.Mobile}>
        <PageNavHeader>Settings</PageNavHeader>
      </ScreenSizeProvider>
    );
    expect(screen.getByText('Settings').closest('header')).toHaveClass(
      css.PageNavHeader({ outlined: true })
    );
  });

  it('matches snapshot (guards position:relative and ::before safe-area extension)', () => {
    const { container } = render(
      <ScreenSizeProvider value={ScreenSize.Mobile}>
        <PageNavHeader>Settings</PageNavHeader>
      </ScreenSizeProvider>
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});

describe('PageHeader', () => {
  it('renders with the default recipe class applied', () => {
    render(
      <ScreenSizeProvider value={ScreenSize.Mobile}>
        <PageHeader>Devices</PageHeader>
      </ScreenSizeProvider>
    );
    expect(screen.getByText('Devices').closest('header')).toHaveClass(css.PageHeader({}));
  });

  it('applies the outlined variant class by default', () => {
    render(
      <ScreenSizeProvider value={ScreenSize.Mobile}>
        <PageHeader>Devices</PageHeader>
      </ScreenSizeProvider>
    );
    expect(screen.getByText('Devices').closest('header')).toHaveClass(
      css.PageHeader({ outlined: true })
    );
  });

  it('applies the balance variant class when balance prop is set', () => {
    render(
      <ScreenSizeProvider value={ScreenSize.Mobile}>
        <PageHeader balance>Devices</PageHeader>
      </ScreenSizeProvider>
    );
    expect(screen.getByText('Devices').closest('header')).toHaveClass(
      css.PageHeader({ balance: true })
    );
  });

  it('matches snapshot (guards position:relative and ::before safe-area extension)', () => {
    const { container } = render(
      <ScreenSizeProvider value={ScreenSize.Mobile}>
        <PageHeader>Devices</PageHeader>
      </ScreenSizeProvider>
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
