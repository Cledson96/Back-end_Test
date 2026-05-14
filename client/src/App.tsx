import { useEffect, useMemo, useState, type FormEvent } from "react";
import type {
	ApiServiceResponse,
	SqrtCalculationRequest,
	SqrtCalculationResponse,
	SqrtClearHistoryResponse,
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
	const [formError, setFormError] = useState("");
	const [requestError, setRequestError] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isHistoryLoading, setIsHistoryLoading] = useState(false);
	const [isClearing, setIsClearing] = useState(false);

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

	const loadHistory = async ({ reset }: { reset: boolean }) => {
		setIsHistoryLoading(true);
		setRequestError("");

		try {
			const history = await fetchHistory(reset ? undefined : nextCursor);

			setHistoryItems((currentItems) => (reset ? history.items : [...currentItems, ...history.items]));
			setNextCursor(history.nextCursor);
		} catch (error) {
			setRequestError(getErrorMessage(error));
		} finally {
			setIsHistoryLoading(false);
		}
	};

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
			setHistoryItems((currentItems) => [
				calculation,
				...currentItems.filter((item) => item.id !== calculation.id),
			]);
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
		setLatestCalculation(null);

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
			</section>

			<section className="history-section" aria-labelledby="history-title">
				<div className="section-heading">
					<h2 id="history-title">Calculation history</h2>
					<button type="button" className="secondary-button" onClick={handleClearHistory} disabled={isClearing}>
						{isClearing ? "Clearing" : "Clear history"}
					</button>
				</div>

				<div className="table-shell">
					<table>
						<thead>
							<tr>
								<th>Input</th>
								<th>Result</th>
								<th>Created</th>
							</tr>
						</thead>
						<tbody>
							{historyItems.map((item) => (
								<tr key={item.id}>
									<td>{formatNumber(item.input)}</td>
									<td>{formatNumber(item.result)}</td>
									<td>{formatDate(item.createdAt)}</td>
								</tr>
							))}
							{historyItems.length === 0 ? (
								<tr>
									<td colSpan={3} className="empty-state">
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
						onClick={() => void loadHistory({ reset: false })}
						disabled={!nextCursor || isHistoryLoading}
					>
						{isHistoryLoading ? "Loading" : "Load more"}
					</button>
					<button
						type="button"
						className="ghost-button"
						onClick={() => void loadHistory({ reset: true })}
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
	const response = await fetch(`${apiBaseUrl}${path}`, {
		headers: {
			"Content-Type": "application/json",
			...options?.headers,
		},
		...options,
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
