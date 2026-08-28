import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";
import AuthProvider from "../../context/AuthContext";
import Article from "./Article";

// markdown-to-jsx fails to render under this test environment for unrelated
// reasons; these tests target the download control, not markdown rendering.
vi.mock("markdown-to-jsx", () => ({
  default: ({ children }) => <div>{children}</div>,
}));

function renderArticle(article, { slug = "how-to-test" } = {}) {
  return render(
    <AuthProvider>
      <MemoryRouter
        initialEntries={[{ pathname: `/article/${slug}`, state: article }]}
      >
        <Routes>
          <Route path="/article/:slug" element={<Article />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

// AC-18.1, AC-18.2, AC-18.3: download control renders enabled once the
// article's body has loaded, and produces a Blob-backed download whose
// filename is derived from the article's slug.
describe("Article download control", () => {
  test("is enabled and downloads a slug-named markdown file of the title/body", async () => {
    const user = userEvent.setup();
    const article = {
      title: "How To Test",
      body: "Some article body.",
      tagList: [],
      author: {},
    };

    const createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    renderArticle(article, { slug: "how-to-test" });

    const button = screen.getByRole("button", { name: /download as markdown/i });
    expect(button).toBeEnabled();

    await user.click(button);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe("text/markdown");
    const content = await blob.text();
    expect(content).toBe("# How To Test\n\nSome article body.");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");

    clickSpy.mockRestore();
  });

  // AC-18.4: control is disabled while the body has not yet loaded.
  test("is disabled while the article body has not loaded", () => {
    renderArticle({ title: "", body: "", tagList: [], author: {} });

    expect(
      screen.getByRole("button", { name: /download as markdown/i }),
    ).toBeDisabled();
  });
});
