// This file is a fork of `@storybook/addon-docs`' `DocsRenderer`, copied from
// `dist/_browser-chunks/chunk-OATZR77O.js` (source: `src/DocsRenderer.tsx`) at
// version 10.5.0. It replicates the docs renderer so we can override a single
// detail: the `ErrorBoundary` must NOT get a `key={Math.random()}` (see below).
//
// RISK: this is a copy of addon-docs internals, not its public API. When
// `@storybook/addon-docs` is upgraded, the upstream `DocsRenderer` can change
// (new blocks, different component tree, changed lifecycle) and this fork will
// silently drift, breaking the docs page. On every addon-docs bump, re-verify
// this file against the upstream source and port any relevant changes.
import { AnchorMdx, CodeOrSourceMdx, Docs, HeadersMdx } from '@storybook/addon-docs/blocks';
import { renderElement, unmountElement } from '@storybook/react-dom-shim';
import { Component, createElement } from 'react';

import type { ReactNode } from 'react';
import type { DocsContextProps } from 'storybook/internal/types';

const defaultComponents = {
  code: CodeOrSourceMdx,
  a: AnchorMdx,
  ...HeadersMdx
};

// Replicates the docs renderer from `@storybook/addon-docs`, except that the
// ErrorBoundary does NOT get a `key={Math.random()}`. That random key made React
// unmount and remount the entire docs page on every re-render (e.g. when globals
// change), which destroyed the inline story canvases and caused the addon to
// reboot the Ember app. With a stable root the docs page reconciles in place and
// the canvases stay alive.
//
// TRADE-OFF: the upstream key also reset the boundary's `hasError` state on
// every render. Without it, a transient render error leaves the docs page
// permanently blank (hasError is never reset) until the app is reloaded.
class ErrorBoundary extends Component<
  { showException: (error: unknown) => void; children?: ReactNode },
  { hasError: boolean }
> {
  override state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override componentDidCatch(error: Error) {
    this.props.showException(error);
  }

  override render() {
    return this.state.hasError ? undefined : this.props.children;
  }
}

export class DocsRenderer {
  render = async (
    context: DocsContextProps,
    docsParameter: { components?: Record<string, unknown> },
    element: HTMLElement
  ) => {
    const { MDXProvider } = await import('@mdx-js/react');

    const components = {
      ...defaultComponents,
      ...docsParameter.components
    } as never;

    const page = createElement(Docs, { context, docsParameter });
    const provided = createElement(MDXProvider, { components }, page);

    const { promise: renderFailed, reject } = Promise.withResolvers<never>();

    const showException = (error: unknown) => {
      reject(error);
    };

    const boundary = createElement(ErrorBoundary, { showException }, provided);

    await Promise.race([renderElement(boundary, element), renderFailed]);
  };

  unmount = (element: HTMLElement) => {
    unmountElement(element);
  };
}
