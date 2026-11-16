import { render, fireEvent, screen } from "@testing-library/react-native";
import { CategoryNavScreen } from "./CategoryNavScreen";

const perCategory = [
  { code: "BRK", label: "Brakes", labelFil: "Preno", answered: 3, total: 4, worst: "ATTENTION" as const },
  { code: "TYR", label: "Tyres & wheels", labelFil: "Gulong", answered: 6, total: 6, worst: "GOOD" as const },
];

describe("CategoryNavScreen", () => {
  it("shows overall progress in words, not just a bar", () => {
    render(<CategoryNavScreen perCategory={perCategory} overall={{ answered: 9, total: 10 }} onOpenCategory={jest.fn()} onReview={jest.fn()} />);
    expect(screen.getByText("9 of 10 points recorded")).toBeTruthy();
  });

  it("carries the Filipino label alongside the English one", () => {
    render(<CategoryNavScreen perCategory={perCategory} overall={{ answered: 9, total: 10 }} onOpenCategory={jest.fn()} onReview={jest.fn()} />);
    expect(screen.getByText("Preno")).toBeTruthy();
  });

  it("opens a category", () => {
    const onOpenCategory = jest.fn();
    render(<CategoryNavScreen perCategory={perCategory} overall={{ answered: 9, total: 10 }} onOpenCategory={onOpenCategory} onReview={jest.fn()} />);
    fireEvent.press(screen.getByLabelText("Brakes: 3 of 4 done"));
    expect(onOpenCategory).toHaveBeenCalledWith("BRK");
  });

  it("shows saved findings in an expanded category and opens any point directly", () => {
    const open = jest.fn();
    const checklist = { id: "v1", versionLabel: "v1", weightVersion: "w1", categories: [{ code: "BRK", label: "Brakes", weight: 100, points: [{ code: "DISC", label: "Brake discs", inputType: "STATUS" as const, weightInCategory: 100, isSafetyCritical: true, recommendation: "Inspect" }] }] };
    render(<CategoryNavScreen perCategory={perCategory} overall={{ answered: 9, total: 10 }} checklist={checklist} results={[{ pointCode: "DISC", status: "CRITICAL", notes: "Cracked", photoUris: [] }]} onOpenCategory={jest.fn()} onOpenPoint={open} onReview={jest.fn()} />);
    expect(screen.getByText("Cracked")).toBeTruthy();
    expect(screen.getByText("Critical")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Edit Brake discs"));
    expect(open).toHaveBeenCalledWith("DISC");
  });
});
