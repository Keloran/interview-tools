import {afterEach, describe, expect, it, vi} from "vitest";
import {act, render, screen} from "@testing-library/react";
import {userEvent} from "@testing-library/user-event";
import {renderToString} from "react-dom/server";
import {hydrateRoot} from "react-dom/client";
import AppStoreLink, {APP_STORE_URL, PLAY_STORE_URL} from "@/components/AppStoreLink";
import {TooltipProvider} from "@/components/ui/tooltip";

function platform(userAgent: string, maxTouchPoints = 0) {
  vi.stubGlobal("navigator", {userAgent, maxTouchPoints});
}
const component = () => <TooltipProvider><AppStoreLink /></TooltipProvider>;
afterEach(() => vi.unstubAllGlobals());

describe("header app store link", () => {
  it.each([
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", 5],
    ["Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)", 5],
    ["Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X)", 5],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15", 5],
  ])("links Apple mobile devices directly to the supplied App Store URL", (agent, touchPoints) => {
    platform(agent, touchPoints);
    render(component());
    expect(screen.getByRole("link", {name: "Get the app on the App Store"})).toHaveAttribute("href", APP_STORE_URL);
    expect(screen.queryByRole("button", {name: "Get the app"})).not.toBeInTheDocument();
  });

  it("links Android directly to the supplied Google Play URL", () => {
    platform("Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36", 5);
    render(component());
    expect(screen.getByRole("link", {name: "Get the app on Google Play"})).toHaveAttribute("href", PLAY_STORE_URL);
  });

  it.each(["Mozilla/5.0 (X11; Linux x86_64)", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", "Unrecognised device"])("offers both stores for desktop and unknown platforms", async (agent) => {
    const user = userEvent.setup();
    platform(agent);
    render(component());
    await user.click(screen.getByRole("button", {name: "Get the app"}));
    expect(screen.getByRole("menuitem", {name: "App Store for iPhone and iPad"})).toHaveAttribute("href", APP_STORE_URL);
    expect(screen.getByRole("menuitem", {name: "Google Play for Android"})).toHaveAttribute("href", PLAY_STORE_URL);
  });

  it("supports keyboard navigation, dismissal and focus restoration", async () => {
    const user = userEvent.setup();
    platform("Desktop");
    render(component());
    const trigger = screen.getByRole("button", {name: "Get the app"});
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("menuitem", {name: "App Store for iPhone and iPad"})).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", {name: "Google Play for Android"})).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("hydrates a server-rendered header on mobile without a mismatch", async () => {
    platform("iPhone", 5);
    const container = document.createElement("div");
    container.innerHTML = renderToString(component());
    document.body.append(container);
    expect(container.querySelector("button")).toHaveAttribute("aria-label", "Get the app");
    const onRecoverableError = vi.fn();
    let root: ReturnType<typeof hydrateRoot>;
    await act(async () => {root = hydrateRoot(container, component(), {onRecoverableError});});
    try {
      expect(screen.getByRole("link", {name: "Get the app on the App Store"})).toHaveAttribute("href", APP_STORE_URL);
      expect(onRecoverableError).not.toHaveBeenCalled();
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});
