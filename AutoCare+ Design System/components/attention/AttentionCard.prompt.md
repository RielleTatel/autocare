The first thing a member sees. It answers "what do I do next?" in one card: counts by severity, the single most severe item spelled out, and a link to the rest.

```jsx
<AttentionCard items={items} onSeeAll={goToList} onPressItem={openItem} />
<AttentionCard items={[]} />   {/* "Nothing needs attention right now" */}
```

Pass items already sorted most-severe-first; the card shows `items[0]` verbatim. Never hide the card when the list is empty — the empty state is the reassurance the feature exists to give.
