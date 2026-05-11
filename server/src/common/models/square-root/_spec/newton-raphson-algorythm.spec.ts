import { beforeEach, describe, expect, it } from "vitest";
import { NewtonRaphsonAlgorithm } from "../newton-raphson-algorythm.class";

describe("NewtonRaphsonAlgorithm", () => {
	let algorithm: NewtonRaphsonAlgorithm;

	beforeEach(() => {
		algorithm = new NewtonRaphsonAlgorithm();
	});

	it("should calculate the square root of a positive number correctly", () => {
		const testCases = [
			{ input: 4, expected: 2 },
			{ input: 9, expected: 3 },
			{ input: 2, expected: 1.4142135623730951 },
			{ input: 16, expected: 4 },
			{ input: 25, expected: 5 },
		];

		testCases.forEach(({ input, expected }) => {
			algorithm.setTarget(input);
			const result = algorithm.process();
			expect(result).toBeCloseTo(expected, 7);
		});
	});

	it("should return 0 for 0 input", () => {
		algorithm.setTarget(0);
		expect(algorithm.process()).toBe(0);
	});

	it("should return 0 for negative input", () => {
		algorithm.setTarget(-4);
		expect(algorithm.process()).toBe(0);
	});

	it("should converge within the iteration limit", () => {
		// Test for a large number that might require many iterations
		algorithm.setTarget(10000000);
		const result = algorithm.process();
		expect(result).toBeCloseTo(3162.2776601683795, 7);
	});
});
