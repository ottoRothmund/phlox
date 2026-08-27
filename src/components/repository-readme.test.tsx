import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RepositoryReadme } from "@/components/repository-readme";

const readme = {
  content: [
    "# Forge",
    "",
    "A terminal tool with **fast search**.",
    "",
    "![Interface](docs/interface.png)",
    "",
    '<p align="center"><img src="ignored.png" alt="Raw HTML"></p>',
    "",
    "[Install guide](https://example.com/install)",
    "",
    "https://github.com/northstar/forge/assets/123/very-long-unbroken-address",
  ].join("\n"),
  path: "README.md",
  htmlUrl: "https://github.com/northstar/forge/blob/main/README.md",
  screenshotUrls: [
    "https://raw.githubusercontent.com/northstar/forge/HEAD/docs/interface.png",
  ],
};

describe("repository README", () => {
  it("renders GitHub Markdown and a screenshot gallery", () => {
    render(
      <RepositoryReadme
        readme={readme}
        owner="northstar"
        name="forge"
      />,
    );

    expect(screen.getByRole("heading", { name: "Forge" })).toBeInTheDocument();
    expect(screen.getByText("fast search")).toHaveStyle({ fontWeight: "600" });
    expect(screen.getByRole("link", { name: "Install guide" })).toHaveAttribute(
      "href",
      "https://example.com/install",
    );
    expect(screen.getAllByRole("img", { name: "Interface" })[0]).toHaveAttribute(
      "src",
      "https://raw.githubusercontent.com/northstar/forge/HEAD/docs/interface.png",
    );
    expect(screen.getByRole("heading", { name: "Screenshots" })).toBeInTheDocument();
    expect(screen.queryByText(/<p align=/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /very-long-unbroken-address/ }),
    ).toHaveClass("break-all");
  });
});
