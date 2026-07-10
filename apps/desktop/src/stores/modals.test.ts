import { describe, expect, it, vi } from "vitest";
import { closeTopModal, modalOpen, pushModal } from "./modals";

describe("modal stack", () => {
  it("closes the topmost dialog first (LIFO)", () => {
    const a = vi.fn();
    const b = vi.fn();
    const unA = pushModal(a);
    const unB = pushModal(b);
    expect(modalOpen()).toBe(true);

    expect(closeTopModal()).toBe(true);
    expect(b).toHaveBeenCalledOnce();
    expect(a).not.toHaveBeenCalled();

    unB(); // the dialog unmounts after closing
    expect(closeTopModal()).toBe(true);
    expect(a).toHaveBeenCalledOnce();
    unA();
    expect(modalOpen()).toBe(false);
    expect(closeTopModal()).toBe(false);
  });

  it("unregisters cleanly even out of order", () => {
    const a = vi.fn();
    const b = vi.fn();
    const unA = pushModal(a);
    const unB = pushModal(b);
    unA(); // lower dialog unmounts first
    expect(closeTopModal()).toBe(true);
    expect(b).toHaveBeenCalledOnce();
    unB();
    expect(modalOpen()).toBe(false);
  });
});
