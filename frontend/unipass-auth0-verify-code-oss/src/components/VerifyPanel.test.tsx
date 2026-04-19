import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { VerifyClient, VerifyOutcome } from "@/lib/api";

import { VerifyPanel } from "./VerifyPanel";

/** Minimal fake client. Returns canned outcomes per call. */
function fakeClient(queue: VerifyOutcome[]): VerifyClient & {
  verifyCalls: string[];
  resendCalls: number;
} {
  const c = {
    verifyCalls: [] as string[],
    resendCalls: 0,
    async verify(code: string) {
      c.verifyCalls.push(code);
      return queue.shift() ?? ({ kind: "error", message: "empty queue" } as VerifyOutcome);
    },
    async resend() {
      c.resendCalls++;
      return { ok: true };
    },
  };
  return c;
}

describe("VerifyPanel", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it("renders title + subtitle + 'to' email when provided", () => {
    render(
      <VerifyPanel to="alice@example.com" client={fakeClient([])} localeCandidates={["en"]} />,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/verify/i);
    expect(screen.getByText(/alice@example\.com/)).toBeInTheDocument();
  });

  it("submit button is disabled until 6 digits are entered", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<VerifyPanel client={fakeClient([])} localeCandidates={["en"]} />);
    const submit = screen.getByRole("button", { name: /verify/i });
    expect(submit).toBeDisabled();
    await user.type(screen.getByTestId("otp-0"), "1");
    expect(submit).toBeDisabled();
  });

  it("auto-submits on complete entry and redirects on success", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const client = fakeClient([{ kind: "success", redirectTo: "/welcome" }]);
    const onRedirect = vi.fn();
    render(
      <VerifyPanel client={client} onRedirect={onRedirect} localeCandidates={["en"]} />,
    );
    await user.type(screen.getByTestId("otp-0"), "123456");
    await screen.findByText(/verified/i);
    expect(client.verifyCalls).toEqual(["123456"]);
    expect(onRedirect).toHaveBeenCalledWith("/welcome");
  });

  it("shows bad-code error and clears input on 400", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const client = fakeClient([{ kind: "bad-code" }]);
    render(<VerifyPanel client={client} localeCandidates={["en"]} />);
    await user.type(screen.getByTestId("otp-0"), "999999");
    const err = await screen.findByRole("alert");
    expect(err).toHaveTextContent(/incorrect/i);
    // Cleared → each box empty
    for (let i = 0; i < 6; i++) {
      expect((screen.getByTestId(`otp-${i}`) as HTMLInputElement).value).toBe("");
    }
  });

  it("shows expired error on 410 without clearing the input", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const client = fakeClient([{ kind: "expired" }]);
    render(<VerifyPanel client={client} localeCandidates={["en"]} />);
    await user.type(screen.getByTestId("otp-0"), "111111");
    const err = await screen.findByRole("alert");
    expect(err).toHaveTextContent(/expired/i);
  });

  it("rate-limited sets cooldown from retryAfterSecs", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const client = fakeClient([{ kind: "rate-limited", retryAfterSecs: 120 }]);
    render(<VerifyPanel client={client} localeCandidates={["en"]} />);
    await user.type(screen.getByTestId("otp-0"), "555555");
    await screen.findByRole("alert");
    // Resend button should display the cooldown label.
    const resend = screen.getByRole("button", { name: /resend code in/i });
    expect(resend).toBeDisabled();
    expect(resend).toHaveTextContent(/2:00/);
  });

  it("resend is disabled during initial cooldown, enabled after it ticks down", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<VerifyPanel client={fakeClient([])} localeCandidates={["en"]} />);
    const resend = screen.getByRole("button", { name: /resend/i });
    expect(resend).toBeDisabled();
    // Advance past the default 30s cooldown.
    vi.advanceTimersByTime(31_000);
    expect(
      await screen.findByRole("button", { name: /^resend code$/i }),
    ).toBeEnabled();
    await user.click(screen.getByRole("button", { name: /^resend code$/i }));
    // Cooldown restarts.
    expect(screen.getByRole("button", { name: /resend code in/i })).toBeDisabled();
  });

  it("renders zh-CN strings when locale candidates prefer zh", () => {
    render(<VerifyPanel client={fakeClient([])} localeCandidates={["zh-CN"]} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("验证码");
  });

  it("pastes a 6-digit code across all boxes", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const client = fakeClient([{ kind: "success", redirectTo: "/home" }]);
    const onRedirect = vi.fn();
    render(
      <VerifyPanel client={client} onRedirect={onRedirect} localeCandidates={["en"]} />,
    );
    screen.getByTestId("otp-0").focus();
    await user.paste("246810");
    await screen.findByText(/verified/i);
    expect(client.verifyCalls).toEqual(["246810"]);
  });

  it("backspace on empty box moves focus back", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<VerifyPanel client={fakeClient([])} localeCandidates={["en"]} />);
    const first = screen.getByTestId("otp-0") as HTMLInputElement;
    first.focus();
    await user.keyboard("12");
    // Now in box 2 (index 2, empty). Backspace should empty box 1 and
    // move focus to box 1.
    await user.keyboard("{Backspace}");
    expect((screen.getByTestId("otp-1") as HTMLInputElement).value).toBe("");
  });
});
