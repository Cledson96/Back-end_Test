#!/usr/bin/env node

import { appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const DEFAULT_TOTAL_REQUESTS = 50;
const DEFAULT_CONCURRENCY = 10;
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_WAIT_TIMEOUT_MS = 30_000;
const DEFAULT_API_BASE_URL = "http://127.0.0.1:8090";

export const calculateLatencyStats = (latenciesMs) => {
	if (latenciesMs.length === 0) {
		return {
			averageMs: 0,
			maxMs: 0,
			minMs: 0,
			p95Ms: 0,
		};
	}

	const sortedLatencies = [...latenciesMs].sort((left, right) => left - right);
	const totalLatency = sortedLatencies.reduce((total, latency) => total + latency, 0);
	const p95Index = Math.ceil(sortedLatencies.length * 0.95) - 1;

	return {
		averageMs: Math.round(totalLatency / sortedLatencies.length),
		maxMs: sortedLatencies.at(-1),
		minMs: sortedLatencies[0],
		p95Ms: sortedLatencies[Math.max(0, p95Index)],
	};
};

export const buildMarkdownSummary = ({
	baseUrl,
	smokeResult,
	stressResult,
	stressSettings,
}) => `## API smoke and stress test

**Target:** \`${baseUrl}\`

### Smoke test

- OpenAPI document responded successfully.
- Calculation result: \`sqrt(${smokeResult.input}) = ${smokeResult.result}\`
- History endpoint returned the calculated value.

### Stress test

| Metric | Value |
| --- | ---: |
| Total requests | ${stressResult.totalRequests} |
| Successful requests | ${stressResult.successfulRequests} |
| Failed requests | ${stressResult.failedRequests} |
| Concurrency | ${stressSettings.concurrency} |
| Duration | ${stressResult.durationMs} ms |
| Requests per second | ${stressResult.requestsPerSecond} |
| Average latency | ${stressResult.latency.averageMs} ms |
| p95 latency | ${stressResult.latency.p95Ms} ms |
| Min latency | ${stressResult.latency.minMs} ms |
| Max latency | ${stressResult.latency.maxMs} ms |
`;

export const runStressTest = async ({ baseUrl, concurrency, requestTimeoutMs, totalRequests }) => {
	const startedAt = performance.now();
	const results = [];
	let nextRequestIndex = 0;

	const runWorker = async () => {
		while (nextRequestIndex < totalRequests) {
			const requestIndex = nextRequestIndex;
			nextRequestIndex += 1;
			const input = (requestIndex % 1_000) + 1;

			try {
				const calculation = await calculateSquareRoot({ baseUrl, input, requestTimeoutMs });
				results.push({
					durationMs: calculation.durationMs,
					ok: true,
				});
			} catch (error) {
				results.push({
					durationMs: 0,
					error: getErrorMessage(error),
					ok: false,
				});
			}
		}
	};

	await Promise.all(Array.from({ length: Math.min(concurrency, totalRequests) }, runWorker));

	const durationMs = Math.max(1, Math.round(performance.now() - startedAt));
	const successfulResults = results.filter((result) => result.ok);
	const failedResults = results.filter((result) => !result.ok);

	return {
		durationMs,
		errors: failedResults.map((result) => result.error).slice(0, 5),
		failedRequests: failedResults.length,
		latency: calculateLatencyStats(successfulResults.map((result) => result.durationMs)),
		requestsPerSecond: Number((results.length / (durationMs / 1_000)).toFixed(2)),
		successfulRequests: successfulResults.length,
		totalRequests: results.length,
	};
};

export const runApiSmokeAndStressTest = async (environment = process.env) => {
	const settings = readSettings(environment);

	await waitForApi(settings);
	await clearHistory(settings);

	const smokeResult = await runSmokeTest(settings);
	const stressResult = await runStressTest(settings);

	await clearHistory(settings);

	const summary = buildMarkdownSummary({
		baseUrl: settings.baseUrl,
		smokeResult,
		stressResult,
		stressSettings: settings,
	});

	console.log(summary);
	await appendGitHubStepSummary(environment.GITHUB_STEP_SUMMARY, summary);

	if (stressResult.failedRequests > 0) {
		throw new Error(`Stress test failed with ${stressResult.failedRequests} failed request(s).`);
	}

	return {
		smokeResult,
		stressResult,
	};
};

const runSmokeTest = async (settings) => {
	const calculation = await calculateSquareRoot({
		baseUrl: settings.baseUrl,
		input: 144,
		requestTimeoutMs: settings.requestTimeoutMs,
	});

	const historyPayload = await requestServiceResponse({
		method: "GET",
		requestTimeoutMs: settings.requestTimeoutMs,
		url: `${settings.baseUrl}/square-root/history?limit=1`,
	});
	const firstHistoryItem = historyPayload.responseObject.items.at(0);

	if (!firstHistoryItem || firstHistoryItem.input !== 144 || Math.abs(firstHistoryItem.result - 12) > 1e-9) {
		throw new Error("History endpoint did not return the smoke test calculation.");
	}

	return {
		input: calculation.input,
		result: calculation.result,
	};
};

const calculateSquareRoot = async ({ baseUrl, input, requestTimeoutMs }) => {
	const startedAt = performance.now();
	const payload = await requestServiceResponse({
		body: JSON.stringify({ input }),
		method: "POST",
		requestTimeoutMs,
		url: `${baseUrl}/square-root/calculate`,
	});
	const responseObject = payload.responseObject;
	const expectedResult = Math.sqrt(input);

	if (Math.abs(responseObject.result - expectedResult) > 1e-7) {
		throw new Error(`Expected sqrt(${input}) to be ${expectedResult}, received ${responseObject.result}.`);
	}

	return {
		durationMs: Math.max(1, Math.round(performance.now() - startedAt)),
		input,
		result: responseObject.result,
	};
};

const clearHistory = (settings) =>
	requestServiceResponse({
		method: "DELETE",
		requestTimeoutMs: settings.requestTimeoutMs,
		url: `${settings.baseUrl}/square-root/history`,
	});

const waitForApi = async ({ baseUrl, requestTimeoutMs, waitTimeoutMs }) => {
	const deadline = Date.now() + waitTimeoutMs;
	let lastError;

	while (Date.now() < deadline) {
		try {
			const payload = await requestJson({
				requestTimeoutMs,
				url: `${baseUrl}/docs/openapi.json`,
			});

			if (payload.openapi) {
				return;
			}
		} catch (error) {
			lastError = error;
		}

		await sleep(500);
	}

	throw new Error(`API did not become ready within ${waitTimeoutMs} ms. Last error: ${getErrorMessage(lastError)}`);
};

const requestServiceResponse = async ({ body, method, requestTimeoutMs, url }) => {
	const payload = await requestJson({
		body,
		headers: {
			"Content-Type": "application/json",
		},
		method,
		requestTimeoutMs,
		url,
	});

	if (!payload.success) {
		throw new Error(payload.message || `Request failed for ${url}.`);
	}

	return payload;
};

const requestJson = async ({ body, headers, method = "GET", requestTimeoutMs, url }) => {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

	try {
		const response = await fetch(url, {
			body,
			headers,
			method,
			signal: controller.signal,
		});
		const text = await response.text();
		const contentType = response.headers.get("content-type") ?? "";

		if (!contentType.includes("application/json")) {
			throw new Error(`Expected JSON from ${url}, received ${contentType || "unknown content type"}.`);
		}

		const payload = JSON.parse(text);

		if (!response.ok) {
			throw new Error(payload.message || `Request failed with status ${response.status}.`);
		}

		return payload;
	} finally {
		clearTimeout(timeout);
	}
};

const readSettings = (environment) => ({
	baseUrl: trimTrailingSlash(environment.API_BASE_URL || DEFAULT_API_BASE_URL),
	concurrency: readPositiveInteger(environment.STRESS_CONCURRENCY, DEFAULT_CONCURRENCY, "STRESS_CONCURRENCY"),
	requestTimeoutMs: readPositiveInteger(
		environment.STRESS_REQUEST_TIMEOUT_MS,
		DEFAULT_REQUEST_TIMEOUT_MS,
		"STRESS_REQUEST_TIMEOUT_MS",
	),
	totalRequests: readPositiveInteger(
		environment.STRESS_TOTAL_REQUESTS,
		DEFAULT_TOTAL_REQUESTS,
		"STRESS_TOTAL_REQUESTS",
	),
	waitTimeoutMs: readPositiveInteger(
		environment.STRESS_WAIT_TIMEOUT_MS,
		DEFAULT_WAIT_TIMEOUT_MS,
		"STRESS_WAIT_TIMEOUT_MS",
	),
});

const readPositiveInteger = (value, fallback, name) => {
	if (value === undefined || value === "") {
		return fallback;
	}

	const parsedValue = Number(value);

	if (!Number.isInteger(parsedValue) || parsedValue < 1) {
		throw new Error(`${name} must be a positive integer.`);
	}

	return parsedValue;
};

const trimTrailingSlash = (value) => value.replace(/\/$/, "");

const appendGitHubStepSummary = async (summaryPath, summary) => {
	if (summaryPath) {
		await appendFile(summaryPath, `${summary}\n`);
	}
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getErrorMessage = (error) => (error instanceof Error ? error.message : String(error));

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	runApiSmokeAndStressTest().catch((error) => {
		console.error(getErrorMessage(error));
		process.exitCode = 1;
	});
}
