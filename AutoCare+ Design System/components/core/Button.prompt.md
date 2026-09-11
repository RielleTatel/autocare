The single action control for every AutoCare+ surface — use it for anything a user taps to make something happen.

```jsx
<Button variant="primary" onClick={book}>Book a service</Button>
<Button variant="secondary">View history</Button>
<Button variant="danger">Cancel subscription</Button>
<Button variant="primary" size="field" block>Save &amp; next</Button>
<Button disabled>Continue</Button>
```

Variants: `primary` (Gauge Blue, one per screen), `secondary` (outlined, 1.5px), `deep` (navy — used for "Book a service" on the member home), `danger` (destructive, always paired with a confirm), `ghost` (inline action inside a card).

`size="field"` is the field app default: 56dp height, 18px label. Never mix sizes within one screen. Labels are the verb of the outcome — "Approve work", not "Submit".
