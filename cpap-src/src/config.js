// Public configuration (safe to ship in the frontend bundle — no secrets here).
export const API_BASE =
  import.meta.env.VITE_API_BASE ||
  'https://k7mcmkpvlf.execute-api.us-east-1.amazonaws.com';

export const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '1045950533778-bn7kdf45a9un2a68s9p9j5e8cjfo40oo.apps.googleusercontent.com';

export const VAPID_PUBLIC_KEY =
  import.meta.env.VITE_VAPID_PUBLIC_KEY ||
  'BAnlDri51LvQuEqfGDF4baX_81kUQPFCRpPmv4JSQZPIwduYj5UyhGcO3o4hS5G9tV7gz8Gc8nFo9sfXyBZwmqw';

// Local-only visual dev mode: run `vite dev` and open with ?mock=1 to preview the
// signed-in UI without a real Google login. Compiled builds never enable this
// unless explicitly opened that way in a dev server.
export const DEV_MOCK =
  import.meta.env.DEV &&
  typeof location !== 'undefined' &&
  new URLSearchParams(location.search).has('mock');

export const CATEGORIES = ['Maintenance', 'Replacement', 'Orders'];

export const CATEGORY_META = {
  Maintenance: { label: 'Maintenance', blurb: 'Clean or maintain a part', icon: '🧼' },
  Replacement: { label: 'Replacement', blurb: 'Replace a worn part', icon: '🔁' },
  Orders: { label: 'Orders', blurb: 'Order new supplies', icon: '📦' },
};
