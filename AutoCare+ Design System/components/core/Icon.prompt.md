Wrapper for the substituted Lucide icon set. **The AutoCare+ codebase ships no icon assets** — read the ICONOGRAPHY section of readme.md before relying on this.

```jsx
<Icon name="triangle-alert" size={20} color="var(--ac-sev-critical)" />
<Icon name="car-front" size={22} />
```

Working vocabulary in the UI kits: `house`, `car-front`, `calendar-days`, `user`, `gauge`, `triangle-alert`, `wrench`, `camera`, `refresh-cw`, `chevron-right`, `share-2`, `shield-check`, `circle-alert`, `clock`, `map-pin`, `phone`.

Icons are always decorative here (`aria-hidden`) — every icon in AutoCare+ sits beside its own label. Never use an icon as the only signal for a status; the status word carries it.
