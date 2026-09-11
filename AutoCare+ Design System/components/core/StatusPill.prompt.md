Every lifecycle state in the product renders as a mono-type pill — work orders, invoices, trips, roadside, appointments.

```jsx
<StatusPill>DRAFT</StatusPill>
<StatusPill tone="info">AWAITING APPROVAL</StatusPill>
<StatusPill tone="warn">PAST DUE</StatusPill>
<StatusPill tone="success">PAID</StatusPill>
<StatusPill tone="danger">SUSPENDED</StatusPill>
```

Grammar: blue = moving, green = settled, amber = needs someone, red = stopped, grey = not started. Labels are the enum value with underscores replaced by spaces, upper case. Never use a VHS band colour here — bands mean scores only.
