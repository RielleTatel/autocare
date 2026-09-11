The field app's trust device — a navy bar above everything else whenever work is queued offline.

```jsx
<SyncBanner pendingCount={3} onClick={openQueue} />
```

Renders `null` at zero, so it can sit unconditionally at the top of every field screen. Copy is the count and the state, nothing else: "3 items waiting to sync". Do not use it in the member app or the web console.
