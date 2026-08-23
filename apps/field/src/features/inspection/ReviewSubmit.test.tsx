import { fireEvent, render, screen } from "@testing-library/react-native";
import { ReviewSubmitScreen } from "./ReviewSubmitScreen";
import type { CachedChecklist } from "./draft";

const checklist: CachedChecklist = {
  id: "version-1", versionLabel: "v1.0", weightVersion: "w1.0",
  categories: [{
    code: "BRAKES", label: "Brakes", weight: 100,
    points: [
      { code: "PAD", label: "Front pads", weightInCategory: 50, isSafetyCritical: true, inputType: "MEASURED", unit: "mm", thresholds: { direction: "HIGHER_BETTER", good: 7, monitor: 4, attention: 2 }, recommendation: "replace", requiresPhotoOnAdverse: true },
      { code: "DISC", label: "Discs", weightInCategory: 50, isSafetyCritical: true, inputType: "STATUS", recommendation: "machine" },
    ],
  }],
};

describe("ReviewSubmitScreen (F-08)", () => {
  it("blocks submit while incomplete and jumps to a missing point on tap", () => {
    const onJump = jest.fn();
    const onSubmit = jest.fn();
    render(
      <ReviewSubmitScreen
        checklist={checklist}
        results={[{ pointCode: "PAD", measuredValue: 8, status: "GOOD", photoUris: [] }]}
        check={{ complete: false, missingPoints: ["DISC"], missingPhotos: [] }}
        overall={{ answered: 1, total: 2 }}
        onJumpToPoint={onJump}
        onSubmit={onSubmit}
      />,
    );
    const submit = screen.getByLabelText("Submit inspection");
    expect(submit.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(submit);
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText("Complete Discs"));
    expect(onJump).toHaveBeenCalledWith("DISC");
  });

  it("summarises adverse findings and enables submit when complete", () => {
    const onSubmit = jest.fn();
    render(
      <ReviewSubmitScreen
        checklist={checklist}
        results={[
          { pointCode: "PAD", measuredValue: 3, status: "ATTENTION", photoUris: ["file://x.jpg"] },
          { pointCode: "DISC", status: "GOOD", photoUris: [] },
        ]}
        check={{ complete: true, missingPoints: [], missingPhotos: [] }}
        overall={{ answered: 2, total: 2 }}
        onJumpToPoint={() => undefined}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByText(/Front pads — Needs attention/)).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Submit inspection"));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("after offline submit shows the pending-score note", () => {
    render(
      <ReviewSubmitScreen
        checklist={checklist}
        results={[]}
        check={{ complete: true, missingPoints: [], missingPhotos: [] }}
        overall={{ answered: 2, total: 2 }}
        submitted
        isOffline
        onJumpToPoint={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    expect(screen.getByText(/Score will appear when synced/)).toBeTruthy();
  });
});
