import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { ShareCertificateScreen } from "./ShareCertificateScreen";

const cert = { id: "cert-1", publicToken: "tok_abc", verificationCode: "7K2M9QX4", url: "/c/tok_abc" };

describe("ShareCertificateScreen (M-16)", () => {
  it("generates a certificate then reveals sharing controls", async () => {
    const createCertificate = jest.fn().mockResolvedValue(cert);
    const setVisibility = jest.fn().mockResolvedValue({});
    render(<ShareCertificateScreen createCertificate={createCertificate} setVisibility={setVisibility} share={jest.fn()} />);

    fireEvent.press(screen.getByLabelText("Generate certificate"));
    await waitFor(() => expect(screen.getByText("7K2M9QX4")).toBeTruthy());
    expect(screen.getByLabelText("Private")).toBeTruthy();
    expect(screen.getByLabelText("Anyone with link")).toBeTruthy();
  });

  it("sharing flips visibility to LINK and shares the certificate URL", async () => {
    const createCertificate = jest.fn().mockResolvedValue(cert);
    const setVisibility = jest.fn().mockResolvedValue({});
    const share = jest.fn().mockResolvedValue(undefined);
    render(<ShareCertificateScreen createCertificate={createCertificate} setVisibility={setVisibility} share={share} />);

    fireEvent.press(screen.getByLabelText("Generate certificate"));
    await waitFor(() => screen.getByText("7K2M9QX4"));
    fireEvent.press(screen.getByLabelText("Share link"));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(setVisibility).toHaveBeenCalledWith("cert-1", "LINK");
    expect(share.mock.calls[0][0]).toContain("/c/tok_abc");
  });

  it("revoke requires confirmation before calling the API", async () => {
    const createCertificate = jest.fn().mockResolvedValue(cert);
    const setVisibility = jest.fn().mockResolvedValue({});
    render(<ShareCertificateScreen createCertificate={createCertificate} setVisibility={setVisibility} share={jest.fn()} />);

    fireEvent.press(screen.getByLabelText("Generate certificate"));
    await waitFor(() => screen.getByText("7K2M9QX4"));
    fireEvent.press(screen.getByLabelText("Revoke certificate"));
    expect(setVisibility).not.toHaveBeenCalledWith("cert-1", "REVOKED");
    fireEvent.press(screen.getByLabelText("Confirm revoke"));
    await waitFor(() => expect(setVisibility).toHaveBeenCalledWith("cert-1", "REVOKED"));
  });
});
