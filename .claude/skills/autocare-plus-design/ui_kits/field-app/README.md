# Field app UI kit (React Native — mechanics & drivers)

Recreation of the AutoCare+ field app, built from `apps/field/src` in the source repo.

## Screens

| In this kit | Source screen | Source files |
|---|---|---|
| Today's task list | F-02 | `features/home/StaffHomeScreen.tsx` |
| Inspection category navigator | F-05 | `features/inspection/CategoryNavScreen.tsx` |
| Point entry (measured, derived status) | F-06 | `features/inspection/PointEntryScreen.tsx` |
| Review & submit | F-08 | `features/inspection/ReviewSubmitScreen.tsx` |
| Score result & recommendations | F-09 | `features/inspection/ScoreResultScreen.tsx` |
| Sync queue | F-03 | `features/sync/SyncQueueScreen.tsx`, `shared/SyncBanner.tsx` |

## What is interactive

The sync banner is pinned and opens the queue. "Start inspection" → category navigator → any category opens point entry. On point entry, typing a value derives the status live and locks the other choices; an adverse value blocks "Save & next" until a photo is attached. Review → submit → score result.

## Field rules this kit demonstrates

Every target is 56dp. Every type role is one step larger than the member app (×1.125). The sync banner is unconditional. Measured points derive their status from the threshold rather than letting the mechanic pick, and adverse findings require a photo before they can be saved.

## Not built

Driver screens (F-11 to F-17: trips, pre-trip capture, hand-over signature, COD collection, cash shift) exist in the screen inventory but not in the source repo, so they are omitted rather than invented.
