The product's progressive-disclosure mechanism. Any component — a category, a checklist point, a healthy part — can be tapped to open its explanation here.

```jsx
<BottomSheet open={!!target} title="Battery" onClose={close}>
  <StarRating score={80} size={22} />
  <p>Battery capacity is within range but should be monitored at the next inspection.</p>
  <MeasuredRow>Measured 12.3 V · good ≥ 12.4 V</MeasuredRow>
</BottomSheet>
```

Order inside the sheet: rating, plain-language sentence, measured value vs threshold, photo, then the dismissing action. The parent must be `position: relative` — the sheet fills its nearest positioned ancestor, which in the UI kits is the phone frame.
