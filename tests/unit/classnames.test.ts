import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("shadcn class utility", () => {
  it("combines conditional classes", () => {
    expect(cn("flex", false, null, { "items-center": true })).toBe(
      "flex items-center",
    );
  });

  it("lets the last conflicting Tailwind utility win", () => {
    expect(cn("px-4 text-sm", "px-6")).toBe("text-sm px-6");
  });
});
