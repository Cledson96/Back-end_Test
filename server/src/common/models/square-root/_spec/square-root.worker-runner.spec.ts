import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { resolveSquareRootWorkerPath } from "../square-root.worker-runner";

const tempDirectories: string[] = [];

afterEach(() => {
	for (const directory of tempDirectories) {
		rmSync(directory, { recursive: true, force: true });
	}

	tempDirectories.length = 0;
});

describe("Square root worker runner", () => {
	it("resolves the worker next to the runner during local development", () => {
		const runtimeDirectory = createTempDirectory();
		const workerPath = path.join(runtimeDirectory, "square-root.worker.ts");
		writeFileSync(workerPath, "");

		expect(
			resolveSquareRootWorkerPath(runtimeDirectory, path.join(runtimeDirectory, "square-root.worker-runner.ts")),
		).toBe(workerPath);
	});

	it("resolves the emitted worker from a bundled production server", () => {
		const runtimeDirectory = createTempDirectory();
		const workerPath = path.join(runtimeDirectory, "common", "models", "square-root", "square-root.worker.js");
		mkdirSync(path.dirname(workerPath), { recursive: true });
		writeFileSync(workerPath, "");

		expect(resolveSquareRootWorkerPath(runtimeDirectory, path.join(runtimeDirectory, "server.js"))).toBe(workerPath);
	});
});

const createTempDirectory = () => {
	const directory = mkdtempSync(path.join(os.tmpdir(), "sqrt-worker-"));
	tempDirectories.push(directory);

	return directory;
};
