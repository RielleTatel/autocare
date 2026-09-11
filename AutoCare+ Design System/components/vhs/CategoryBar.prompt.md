One row per inspection category on the breakdown screen and the public certificate.

```jsx
<CategoryBar label="Brakes" score={75.8} weight={22} points={9} onClick={explain} />
<CategoryBar label="Tyres" score={64} compact />
```

The bar track is `--ac-chassis`, the fill is the band colour, and the weight/points footnote is what makes the score auditable — include it on the member breakdown. Pass `onClick` to open the explain sheet; every category is tappable, healthy ones included.
