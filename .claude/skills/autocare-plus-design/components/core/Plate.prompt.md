Anything a machine assigned — plate numbers, VINs, verification codes, invoice numbers — renders through Plate, never as body text.

```jsx
<Plate>ABC 1234</Plate>                       {/* bordered specimen */}
<Plate variant="chip">ABC 1234</Plate>        {/* navy chip on the vehicle card */}
<Plate variant="plain">7QK4-92MB</Plate>      {/* inline, in a table or field */}
```
