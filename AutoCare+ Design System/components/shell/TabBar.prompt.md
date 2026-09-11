The member app's only navigation chrome.

```jsx
<TabBar active="home" onChange={setTab} tabs={[
  { key: "home", label: "Home", icon: <Icon name="house" /> },
  { key: "vehicles", label: "Vehicles", icon: <Icon name="car-front" /> },
  { key: "bookings", label: "Bookings", icon: <Icon name="calendar-days" /> },
  { key: "account", label: "Account", icon: <Icon name="user" /> },
]} />
```

Four tabs maximum. Labels are nouns. Active tint is `--ac-primary`; inactive is `--ac-ink-muted`. The field app has no tab bar — it is a single task queue.
