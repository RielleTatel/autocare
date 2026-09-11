The row of the full attention list. Severity-ordered, grouped by vehicle when the member has more than one.

```jsx
<AttentionItemRow severity="CRITICAL" title="Front brake pads at 3.0 mm"
  body="Replace within 1,000 km. Book a service to have this done." plate="ABC 1234" showPlate
  onClick={() => open(item)} />
```

Severities map onto band colours: `CRITICAL` → critical red, `ATTENTION` → attention orange, `MONITOR` → fair amber, `INFO` → Gauge Blue. The colour is always accompanied by the severity word at the foot of the row.
