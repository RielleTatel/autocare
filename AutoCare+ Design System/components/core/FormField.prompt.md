Every text input in the product. The label is uppercase 13px muted; the field is sunken (chassis fill on a white card).

```jsx
<FormField id="plate" label="Plate number" value="ABC 1234" mono
  error="This plate is already registered to another account. Check the number, or contact us if this is your vehicle." />
```

Error copy is a sentence that names the problem and the next step. Set `mono` for plates, VINs and codes. `size="field"` raises the height to 56dp for the field app.
