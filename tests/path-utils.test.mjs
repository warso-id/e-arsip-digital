import test from 'node:test';
import assert from 'node:assert/strict';
import { getAppBasePath, resolveAppPath } from '../js/path-utils.js';

test('getAppBasePath returns repository subfolder when running from GitHub Pages', () => {
  const original = globalThis.location;
  Object.defineProperty(globalThis, 'location', {
    value: { pathname: '/arsip-surat-digital-enterprise/dashboard/admin/' },
    configurable: true
  });

  try {
    assert.equal(getAppBasePath(), '/arsip-surat-digital-enterprise/');
  } finally {
    Object.defineProperty(globalThis, 'location', {
      value: original,
      configurable: true
    });
  }
});

test('resolveAppPath prefixes internal routes with the app base path', () => {
  const original = globalThis.location;
  Object.defineProperty(globalThis, 'location', {
    value: { pathname: '/arsip-surat-digital-enterprise/surat-masuk/list.html' },
    configurable: true
  });

  try {
    assert.equal(resolveAppPath('/dashboard/'), '/arsip-surat-digital-enterprise/dashboard/');
    assert.equal(resolveAppPath('/login.html'), '/arsip-surat-digital-enterprise/login.html');
  } finally {
    Object.defineProperty(globalThis, 'location', {
      value: original,
      configurable: true
    });
  }
});
