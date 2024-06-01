import { assert, describe, it } from "vitest";
import { myTestedComponent } from "../src/myTestedComponent"; // Replace with the correct path to your function

describe("My Function", () => {
  it("should return the correct result", () => {
    const input = "Hello World";
    const expectedResult = {
      result: 3,
      echo: input,
    };
    const actualResult = myTestedComponent(1, 2, input);
    assert.deepStrictEqual(actualResult, expectedResult);
  });
});
