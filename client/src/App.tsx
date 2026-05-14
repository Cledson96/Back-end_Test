import { useEffect, useMemo, useState, type FormEvent } from "react";
import type {
	ApiServiceResponse,
	SqrtCalculationRequest,
	SqrtCalculationResponse,
	SqrtClearHistoryResponse,
	SqrtHistoryImportResponse,
	SqrtHistoryResponse,
} from "@shared/types";
import "./App.css";

const HISTORY_LIMIT = 5;
const apiBaseUrl = import.meta.env.VITE_API_URL ?? "";

function App() {
	const [inputValue, setInputValue] = useState("");
	const [latestCalculation, setLatestCalculation] = useState<SqrtCalculationResponse | null>(null);
	const [historyItems, setHistoryItems] = useState<SqrtCalculationResponse[]>([]);
	const [nextCursor, setNextCursor] = useState<string | undefined>();
	const [pageCursors, setPageCursors] = useState<Array<string | undefined>>([undefined]);
	const [pageIndex, setPageIndex] = useState(0);
	const [formError, setFormError] = useState("");
	const [importError, setImportError] = useState("");
	const [requestError, setRequestError] = useState("");
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [importSummary, setImportSummary] = useState<SqrtHistoryImportResponse | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isHistoryLoading, setIsHistoryLoading] = useState(false);
	const [isClearing, setIsClearing] = useState(false);
	const [isImporting, setIsImporting] = useState(false);
	const [isExporting, setIsExporting] = useState(false);

	const canSubmit = useMemo(() => inputValue.trim().length > 0 && !isSubmitting, [inputValue, isSubmitting]);

	useEffect(() => {
		let isMounted = true;

		const loadInitialHistory = async () => {
			setIsHistoryLoading(true);
			setRequestError("");

			try {
				const history = await fetchHistory();

				if (isMounted) {
					setHistoryItems(history.items);
					setNextCursor(history.nextCursor);
					setPageCursors([undefined]);
					setPageIndex(0);
				}
			} catch (error) {
				if (isMounted) {
					setRequestError(getErrorMessage(error));
				}
			} finally {
				if (isMounted) {
					setIsHistoryLoading(false);
				}
			}
		};

		void loadInitialHistory();

		return () => {
			isMounted = false;
		};
	}, []);

	const loadHistory = async ({ cursor, page }: { cursor?: string; page: number }) => {
		setIsHistoryLoading(true);
		setRequestError("");

		try {
			const history = await fetchHistory(cursor);

			setHistoryItems(history.items);
			setNextCursor(history.nextCursor);
			setPageIndex(page);
			setPageCursors((currentCursors) => {
				const nextCursors = currentCursors.slice(0, page + 1);

				nextCursors[page] = cursor;

				if (history.nextCursor) {
					nextCursors[page + 1] = history.nextCursor;
				}

				return nextCursors;
			});
		} catch (error) {
			setRequestError(getErrorMessage(error));
		} finally {
			setIsHistoryLoading(false);
		}
	};

	const refreshHistory = () => loadHistory({ cursor: pageCursors[pageIndex], page: pageIndex });

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setFormError("");
		setRequestError("");

		const parsedInput = Number(inputValue);

		if (!Number.isFinite(parsedInput) || parsedInput < 0) {
			setFormError("Enter a finite number greater than or equal to zero.");
			return;
		}

		setIsSubmitting(true);

		try {
			const requestBody: SqrtCalculationRequest = { input: parsedInput };
			const calculation = await requestApi<SqrtCalculationResponse>("/square-root/calculate", {
				method: "POST",
				body: JSON.stringify(requestBody),
			});

			setLatestCalculation(calculation);
			setHistoryItems((currentItems) => [calculation, ...currentItems.filter((item) => item.id !== calculation.id)]);
			setPageCursors([undefined]);
			setPageIndex(0);
			setInputValue("");
		} catch (error) {
			setRequestError(getErrorMessage(error));
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleClearHistory = async () => {
		const previousHistoryItems = historyItems;
		const previousNextCursor = nextCursor;
		const previousLatestCalculation = latestCalculation;

		setIsClearing(true);
		setRequestError("");
		setHistoryItems([]);
		setNextCursor(undefined);
		setPageCursors([undefined]);
		setPageIndex(0);
		setLatestCalculation(null);
		setImportSummary(null);

		try {
			await requestApi<SqrtClearHistoryResponse>("/square-root/history", { method: "DELETE" });
		} catch (error) {
			setHistoryItems(previousHistoryItems);
			setNextCursor(previousNextCursor);
			setLatestCalculation(previousLatestCalculation);
			setRequestError(getErrorMessage(error));
		} finally {
			setIsClearing(false);
		}
	};

	const handleImport = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setImportError("");
		setRequestError("");

		if (!selectedFile) {
			setImportError("Choose an .xlsx spreadsheet before importing.");
			return;
		}

		const formData = new FormData();
		formData.append("file", selectedFile);
		setIsImporting(true);

		try {
			const result = await requestApi<SqrtHistoryImportResponse>("/square-root/history/import", {
				method: "POST",
				body: formData,
			});

			setImportSummary(result);
			setSelectedFile(null);
			setPageCursors([undefined]);
			setPageIndex(0);

			const history = await fetchHistory();
			setHistoryItems(history.items);
			setNextCursor(history.nextCursor);
		} catch (error) {
			setRequestError(getErrorMessage(error));
		} finally {
			setIsImporting(false);
		}
	};

	const handleExport = async () => {
		setIsExporting(true);
		setRequestError("");

		try {
			await downloadHistoryExport();
		} catch (error) {
			setRequestError(getErrorMessage(error));
		} finally {
			setIsExporting(false);
		}
	};

	return (
		<main className="app">
			<section className="calculator-panel" aria-labelledby="calculator-title">
				<div className="panel-heading">
					<div>
						<p className="eyebrow">Newton-Raphson</p>
						<h1 id="calculator-title">Square root calculator</h1>
					</div>
					<a className="docs-link" href={`${apiBaseUrl}/docs`} target="_blank" rel="noreferrer">
						API docs
					</a>
				</div>

				<form className="calculator-form" onSubmit={handleSubmit}>
					<label htmlFor="number-input">Number</label>
					<div className="input-row">
						<input
							id="number-input"
							inputMode="decimal"
							min="0"
							placeholder="Example: 144"
							type="number"
							value={inputValue}
							onChange={(event) => setInputValue(event.target.value)}
						/>
						<button type="submit" disabled={!canSubmit}>
							{isSubmitting ? "Calculating" : "Calculate"}
						</button>
					</div>
					{formError ? <p className="field-error">{formError}</p> : null}
				</form>

				{requestError ? <p className="request-error">{requestError}</p> : null}

				<section className="result-band" aria-live="polite">
					<span>Latest result</span>
					<strong>{latestCalculation ? formatNumber(latestCalculation.result) : "No calculation yet"}</strong>
					{latestCalculation ? <small>Input: {formatNumber(latestCalculation.input)}</small> : null}
				</section>

				<section className="spreadsheet-tools" aria-labelledby="spreadsheet-title">
					<div>
						<h2 id="spreadsheet-title">Spreadsheet import</h2>
					</div>
					<form className="import-form" onSubmit={handleImport}>
						<input
							accept=".xlsx"
							aria-label="Spreadsheet file"
							type="file"
							onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
						/>
						<button type="submit" disabled={isImporting}>
							{isImporting ? "Importing" : "Upload spreadsheet"}
						</button>
					</form>
					{importError ? <p className="field-error">{importError}</p> : null}
					{importSummary ? (
						<div className="import-summary" aria-live="polite">
							<strong>{importSummary.fileName}</strong>
							<span>
								{importSummary.createdCount} saved, {importSummary.failedCount} failed from{" "}
								{importSummary.totalRows} rows.
							</span>
							{importSummary.errors.length > 0 ? (
								<ul>
									{importSummary.errors.slice(0, 5).map((error) => (
										<li key={`${error.rowNumber}-${error.value ?? error.message}`}>
											Row {error.rowNumber}: {error.message}
										</li>
									))}
								</ul>
							) : null}
						</div>
					) : null}
				</section>
			</section>

			<section className="history-section" aria-labelledby="history-title">
				<div className="section-heading">
					<h2 id="history-title">Calculation history</h2>
					<div className="header-actions">
						<button type="button" className="secondary-button" onClick={handleExport} disabled={isExporting}>
							{isExporting ? "Exporting" : "Export history"}
						</button>
						<button type="button" className="secondary-button" onClick={handleClearHistory} disabled={isClearing}>
							{isClearing ? "Clearing" : "Clear history"}
						</button>
					</div>
				</div>

				<div className="table-shell">
					<table>
						<thead>
							<tr>
								<th>Input</th>
								<th>Result</th>
								<th>Created</th>
								<th>Source</th>
							</tr>
						</thead>
						<tbody>
							{historyItems.map((item) => (
								<tr key={item.id}>
									<td>{formatNumber(item.input)}</td>
									<td>{formatNumber(item.result)}</td>
									<td>{formatDate(item.createdAt)}</td>
									<td>{renderSource(item)}</td>
								</tr>
							))}
							{historyItems.length === 0 ? (
								<tr>
									<td colSpan={4} className="empty-state">
										No saved calculations.
									</td>
								</tr>
							) : null}
						</tbody>
					</table>
				</div>

				<div className="history-actions">
					<button
						type="button"
						className="secondary-button"
						onClick={() => void loadHistory({ cursor: pageCursors[pageIndex - 1], page: pageIndex - 1 })}
						disabled={pageIndex === 0 || isHistoryLoading}
					>
						Previous
					</button>
					<span className="page-indicator">Page {pageIndex + 1}</span>
					<button
						type="button"
						className="secondary-button"
						onClick={() => void loadHistory({ cursor: nextCursor, page: pageIndex + 1 })}
						disabled={!nextCursor || isHistoryLoading}
					>
						{isHistoryLoading ? "Loading" : "Next"}
					</button>
					<button
						type="button"
						className="ghost-button"
						onClick={() => void refreshHistory()}
						disabled={isHistoryLoading}
					>
						Refresh
					</button>
				</div>
			</section>
		</main>
	);
}

const requestApi = async <T,>(path: string, options?: RequestInit): Promise<T> => {
	const { headers, ...requestOptions } = options ?? {};
	const requestHeaders =
		requestOptions.body instanceof FormData
			? headers
			: {
					"Content-Type": "application/json",
					...headers,
				};
	const response = await fetch(`${apiBaseUrl}${path}`, {
		headers: requestHeaders,
		...requestOptions,
	});
	const payload = await readServiceResponse<T>(response);

	if (!response.ok || !payload.success) {
		throw new Error(payload.message || "Request failed.");
	}

	return payload.responseObject;
};

const readServiceResponse = async <T,>(response: Response): Promise<ApiServiceResponse<T>> => {
	const contentType = response.headers.get("content-type") ?? "";

	if (!contentType.includes("application/json")) {
		throw new Error(`Request failed with status ${response.status}.`);
	}

	return (await response.json()) as ApiServiceResponse<T>;
};

const fetchHistory = (cursor?: string) =>
	requestApi<SqrtHistoryResponse>(
		`/square-root/history?limit=${HISTORY_LIMIT}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
	);

const downloadHistoryExport = async () => {
	const response = await fetch(`${apiBaseUrl}/square-root/history/export`);

	if (!response.ok) {
		throw new Error(`Export failed with status ${response.status}.`);
	}

	const blob = await response.blob();
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");

	link.href = url;
	link.download = "square-root-history.xlsx";
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
};

const renderSource = (item: SqrtCalculationResponse) => {
	if (!item.sourceFileId || !item.sourceFileName) {
		return "Manual";
	}

	return (
		<a href={`${apiBaseUrl}/square-root/imports/${item.sourceFileId}/download`} className="source-link">
			{item.sourceFileName}
			{item.sourceRowNumber ? ` row ${item.sourceRowNumber}` : ""}
		</a>
	);
};

const formatNumber = (value: number) =>
	new Intl.NumberFormat("en", {
		maximumFractionDigits: 10,
	}).format(value);

const formatDate = (value: string) =>
	new Intl.DateTimeFormat("en", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : "Unexpected error.");

export default App;
