Plan comparison on the member app (M-08) and plan change (M-29).

```jsx
<PlanCard name="Care Plus" price="₱1,499" interval="MONTHLY" lockInMonths={6}
  inclusions={["2 inspections/cycle", "1 pick-up & delivery/cycle", "2 roadside call-outs/cycle"]}
  onSelect={choose} />
```

Every inclusion is listed in full and the lock-in is always stated, including "No lock-in" — the pricing card is a commitment disclosure, not a sales panel. Price strings arrive pre-formatted in pesos.
