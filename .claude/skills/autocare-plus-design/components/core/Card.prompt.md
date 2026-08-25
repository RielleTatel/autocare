Every grouped piece of content sits in a Card — white surface, hairline border, radius 12, over the `--ac-chassis` app background.

```jsx
<Card><h2>Brakes — 75.8</h2></Card>
<Card pad="lg" accent="var(--ac-sev-critical)" interactive onClick={open}>…</Card>
```

Do not add a shadow: the hairline against the chassis grey is the elevation system. `accent` is reserved for status — only pass a band or severity token, never a decorative colour.
