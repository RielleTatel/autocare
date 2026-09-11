The one bold element on any screen that shows it — the member Health Score screen (M-13), the mechanic's score result (F-09), and the public certificate (P-01) all use the same geometry.

```jsx
<ScoreGauge score={69} confidence="MEDIUM" />
<ScoreGauge score={84} variant="field" size={260} />
<ScoreGauge score={51} isStale daysSinceInspection={128} />
```

Rules carried over from the product: the gauge always shows the **capped** score, in the band colour, with the top detractors directly beneath it — the UI must answer "why?". A stale score (>90 days) renders entirely in `--ac-ink-muted` so it can't be mistaken for current. Never place a second bold element beside it.
