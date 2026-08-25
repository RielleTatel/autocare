The plain-language face of the score, for members who don't want a number.

```jsx
<StarRating score={92} />              {/* 5 filled, excellent green */}
<StarRating band="FAIR" size={16} />   {/* 3 filled, amber */}
```

It is a *display transform over the band*, not a second scoring system: 5 Excellent, 4 Good, 3 Fair, 2 Needs attention, 1 Critical. Empty stars are outlined in the same band colour, never grey. Always pair with the word or the number somewhere in the same block.
