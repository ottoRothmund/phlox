import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AuthMenu } from "@/components/auth-menu";

vi.mock("next/navigation", () => ({
  usePathname: () => "/explore",
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

describe("auth menu", () => {
  it("shows a sign-in button with GitHub and Google options", async () => {
    const user = userEvent.setup();
    render(<AuthMenu user={null} />);

    const trigger = screen.getByRole("button", { name: /sign in/i });
    await user.click(trigger);

    expect(screen.getByRole("link", { name: /github/i })).toHaveAttribute(
      "href",
      "/api/auth/signin/github?next=%2Fexplore",
    );
    expect(screen.getByRole("link", { name: /google/i })).toHaveAttribute(
      "href",
      "/api/auth/signin/google?next=%2Fexplore",
    );
  });

  it("shows the signed-in user and a sign-out control", async () => {
    const user = userEvent.setup();
    render(
      <AuthMenu
        user={{
          id: "8f2c1b90-1111-4222-8333-444455556666",
          name: "octocat",
          email: "dev@example.com",
          avatarUrl: "",
          provider: "github",
        }}
      />,
    );

    const trigger = screen.getByRole("button", { name: /octocat/i });
    await user.click(trigger);

    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
    expect(screen.getByText("dev@example.com")).toBeInTheDocument();
  });
});
