/** Same-tab navigation survives browser popup policies. The configured provider
 * return URL opens the authenticated invoice route, which reads settlement anew. */
export function openCheckout(url: string): Promise<{ type: string; url?: string }> {
  window.location.assign(url);
  return new Promise(() => undefined);
}
