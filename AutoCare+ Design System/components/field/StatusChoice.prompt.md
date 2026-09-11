The inspection point-entry control: one giant target per status, stacked, so a mechanic in gloves can hit it without looking.

```jsx
{["GOOD","MONITOR","ATTENTION","CRITICAL","NOT_APPLICABLE"].map(s => (
  <StatusChoice key={s} status={s} selected={effective === s} disabled={derived && derived !== s}
    onClick={() => pick(s)} />
))}
<StatusChip status={derived} />
```

For measured points the status is derived from the value and the other choices go to 40% opacity — the mechanic sees the threshold doing its job rather than overriding it. Adverse findings (`ATTENTION`, `CRITICAL`) trigger the required-photo affordance in the screen above this control.
