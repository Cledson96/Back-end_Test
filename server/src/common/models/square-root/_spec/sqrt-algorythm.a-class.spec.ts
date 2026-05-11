import { beforeEach, describe, expect, it } from "vitest";
import { SqrtAlgorithm } from "../sqrt-algorythm.a-class";

// Concrete implementation of SqrtAlgorithm for testing
class TestSqrtAlgorithm extends SqrtAlgorithm {
	public lastGuess = 0;

	protected approximateGuess(): number {
		// For testing - simple implementation that converges quickly
		this.lastGuess =
			this.lastGuess === 0
				? this.number / 2 // Initial guess
				: 0.5 * (this.lastGuess + this.number / this.lastGuess); // Newton-Raphson step

		return this.lastGuess;
	}

	// Expose protected methods for testing
	public testIsProcessable(num: number): boolean {
		this.number = num;
		return super["isProcessable"]();
	}

	public testShouldContinue(): boolean {
		return super["shouldContinue"]();
	}

	public setIteration(value: number): void {
		this.iteration = value;
	}

	public testIsIterationLimitReached(): boolean {
		return super["isIterationLimitReached"]();
	}

	public setResult(value: number): void {
		this.result = value;
	}

	public testIsToleranceReached(): boolean {
		return super["isToleranceReached"]();
	}
}

describe("SqrtAlgorithm", () => {
	let algorithm: TestSqrtAlgorithm;

	beforeEach(() => {
		algorithm = new TestSqrtAlgorithm();
	});

	it("should set the target number correctly", () => {
		const number = 16;
		algorithm.setTarget(number);
		expect(algorithm["number"]).toBe(number);
	});

	it("should correctly determine if a number is processable", () => {
		// Positive numbers should be processable
		expect(algorithm.testIsProcessable(4)).toBe(true);

		// Zero and negative numbers should not be processable
		expect(algorithm.testIsProcessable(0)).toBe(false);
		expect(algorithm.testIsProcessable(-4)).toBe(false);
	});

	it("should correctly check iteration limit", () => {
		// Below the limit
		algorithm.setIteration(500);
		expect(algorithm.testIsIterationLimitReached()).toBe(false);

		// At the limit
		algorithm.setIteration(1000);
		expect(algorithm.testIsIterationLimitReached()).toBe(false);

		// Above the limit
		algorithm.setIteration(1001);
		expect(algorithm.testIsIterationLimitReached()).toBe(true);
	});

	it("should correctly check tolerance", () => {
		const number = 4;
		algorithm.setTarget(number);

		// Within tolerance - result squared is close to the number
		// For number=4, a result of 2 should be within tolerance
		algorithm.setResult(2);
		expect(algorithm.testIsToleranceReached()).toBe(true);

		// Outside tolerance
		algorithm.setResult(1.8); // 1.8^2 = 3.24, which is more than tolerance away from 4
		expect(algorithm.testIsToleranceReached()).toBe(false);
	});

	it("should process the square root calculation correctly", () => {
		const testCases = [
			{ input: 4, expected: 2 },
			{ input: 9, expected: 3 },
			{ input: 16, expected: 4 },
		];

		testCases.forEach(({ input, expected }) => {
			algorithm = new TestSqrtAlgorithm(); // Reset for each test
			algorithm.setTarget(input);
			const result = algorithm.process();
			expect(result).toBeCloseTo(expected, 7);
		});
	});

	it("should return 0 for non-processable numbers", () => {
		algorithm.setTarget(0);
		expect(algorithm.process()).toBe(0);

		algorithm.setTarget(-4);
		expect(algorithm.process()).toBe(0);
	});
});
