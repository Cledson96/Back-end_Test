import { beforeEach, describe, expect, it, vi } from "vitest";
import { SqrtAlgorithm } from "../sqrt-algorythm.a-class";
import { SqrtCalculator } from "../sqrt-calculator.class";

// Mock implementation of SqrtAlgorithm for testing
class MockSqrtAlgorithm extends SqrtAlgorithm {
	protected approximateGuess(): number {
		// Simple mock implementation that returns the square root
		return Math.sqrt(this.number);
	}
}

describe("SqrtCalculator", () => {
	let mockAlgorithm: SqrtAlgorithm;
	let calculator: SqrtCalculator;

	beforeEach(() => {
		mockAlgorithm = new MockSqrtAlgorithm();
	});

	it("should calculate and return the square root using the provided algorithm", () => {
		const testCases = [
			{ input: 4, expected: 2 },
			{ input: 9, expected: 3 },
			{ input: 16, expected: 4 },
		];

		testCases.forEach(({ input, expected }) => {
			calculator = new SqrtCalculator(input, mockAlgorithm);
			const result = calculator.calculate();
			expect(result).toBe(expected);
		});
	});

	it("should delegate the calculation to the algorithm", () => {
		const number = 4;
		calculator = new SqrtCalculator(number, mockAlgorithm);

		const processSpy = vi.spyOn(mockAlgorithm, "process");
		calculator.calculate();

		expect(processSpy).toHaveBeenCalled();
	});
});
