Use for any list or panel with nothing in it, still loading, or failed. The card is always rendered — never collapsed to nothing.

```jsx
<EmptyState title="Nothing needs attention right now" body="Your vehicles are up to date." />
<EmptyState tone="loading" title="Loading plans…" />
<EmptyState tone="error" title="Couldn't load plans" body="Check your connection and try again."
  action={<Button variant="secondary">Retry</Button>} />
```

Empty copy is positive and specific to the surface. Error copy names the recovery, never the status code.
