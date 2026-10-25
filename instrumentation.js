import { getRuntimeMode } from './lib/setup.js';

// An unconfigured install serves its setup screen instead of failing every request.
// The proxy blocks all backend calls until core configuration is valid; server actions
// additionally check the mode and session in requireSession(). No credentials are logged.
export function register() {
  if (getRuntimeMode() !== 'live') {
    console.info('[mailcheap] Setup pending: backend access is disabled until configuration is complete.');
  }
}
