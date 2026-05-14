import { describe, expect, it } from "vitest";

import { buildMarkdownSummary, calculateLatencyStats } from "../api-smoke-and-stress-test.mjs";

describe("API smoke and stress test helpers", () => {
	it("calculates latency statistics", () => {
		expect(calculateLatencyStats([40, 10, 30, 20])).toEqual({
			averageMs: 25,
			maxMs: 40,
			minMs: 10,
			p95Ms: 40,
		});
	});

	it("builds a markdown summary with stress metrics", () => {
		const summary = buildMarkdownSummary({
			baseUrl: "http://127.0.0.1:8090",
			smokeResult: {
				input: 144,
				result: 12,
			},
			stressResult: {
				durationMs: 1000,
				failedRequests: 1,
				latency: {
					averageMs: 20,
					maxMs: 40,
					minMs: 10,
					p95Ms: 35,
				},
				requestsPerSecond: 9,
				successfulRequests: 9,
				totalRequests: 10,
			},
			stressSettings: {
				concurrency: 3,
				totalRequests: 10,
			},
		});

		expect(summary).toContain("## API smoke and stress test");
		expect(summary).toContain("| Total requests | 10 |");
		expect(summary).toContain("| Successful requests | 9 |");
		expect(summary).toContain("| Failed requests | 1 |");
		expect(summary).toContain("| p95 latency | 35 ms |");
		expect(summary).toContain("sqrt(144) = 12");
	});
});
