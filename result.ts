import {
	defaultErrorDecoder,
	defaultErrorEncoder,
	ErrorDecoder,
	ErrorEncoder,
	fromJson,
	JSONReviver,
	resultJSONReviver,
} from "./coding.ts"

/**
 * Helper object for Result.match
 */
export interface ResultMatcher<T, R> {
	success: (value: T) => R
	failure: (error: Error) => R
}

/**
 * Object which be can returned by a function or API which either contains a value (Success) or an
 * error (Failure).
 */
export abstract class Result<T> {
	/*******************************************************************************
	 * Static Methods                                                              *
	 *******************************************************************************/

	/**
	 * Checks if a result is a success
	 */
	public static readonly isSuccess = <T>(res: Result<T>): res is Success<T> => res instanceof Success

	/**
	 * Checks if a result is a failure
	 */
	public static readonly isFailure = <T>(res: Result<T>): res is Failure<T> => res instanceof Failure

	/**
	 * Creates a new success result
	 * @param value Value that should be wrapped
	 * @returns Result that wraps the given value
	 */
	public static readonly success = <T>(value: T): Result<T> => Success.of(value)

	/**
	 * Creates a new failure result
	 * @param err Error that should be wrapped
	 * @returns Result that wraps the given error
	 */
	public static readonly failure = <T>(err: Error): Result<T> => Failure.of(err)

	/**
	 * If the result is a success its value is returned, If the result is a failure the
	 * provided default value is returned instead. If no default is given the function
	 * throws the wrapped error.
	 * @param defaultVault Optional default value
	 * @returns The wrapped value or the default value
	 * @throws The failure' wrapped error if no default is given
	 */
	public static readonly unwrap = <T>(defaultVault?: T) => (res: Result<T>): T => res.unwrap(defaultVault)

	/**
	 * If the result type is success, map calls the provided function with the wrapped
	 * value as an parameter. Said function should return either a new value or a new result.
	 * If the result type is failure, map simply returns the current result.
	 * @param f Function that transforms the wrapped value of the result
	 * @returns New result
	 */
	public static readonly map = <T, R>(f: (value: T) => R | Result<R>) => (res: Result<T>): Result<R> => res.map(f)

	/**
	 * Takes a `success` and `failure` function which are called when the result is a success
	 * and a failure respectively. The result of the called function is then returned
	 * @param m Object containing a `success` and `failure` function
	 * @returns Result returned by the matcher
	 */
	public static readonly match = <T, R>(m: ResultMatcher<T, R>) => (res: Result<T>): R => res.match(m)

	/**
	 * Takes a list of results and returns a list of all success values
	 * @param a List of results
	 * @returns List of wrapped values
	 */
	public static readonly filter = <T>(a: Result<T>[]): T[] =>
		a.filter((x) => x instanceof Success).map((x) => (x as Success<T>).value)

	/**
	 * Takes a list of results and returns a result containing all success values.
	 * If a failure is encountered it returns that failure instead.
	 * @param a List of results
	 * @returns Result with the list of wrapped values
	 */
	public static readonly combine = <T>(a: Result<T>[]): Result<T[]> => {
		const res = [] as T[]
		for (const e of a) {
			if (e instanceof Failure) {
				return e as Result<T[]>
			}
			res.push(e.unwrap())
		}
		return Result.success(res)
	}

	/**
	 * The error encoder is called when encoding a Failure to JSON. This function
	 * is necessary since errors cannot be encoded to JSON by default.
	 * The default implementation of this functions encodes all error properties except
	 * for the stack into a plain object which can then be stringified.
	 * @param err Error that should be encoded
	 * @returns Plain object representing the error
	 */
	public static errorEncoder: ErrorEncoder = defaultErrorEncoder

	/**
	 * The error decoder is called when decoding a Failure from JSON. This function
	 * is necessary to decode the wrapped error.
	 * The default implementation of this functions can decode the following default
	 * error types (EvalError, RangeError, ReferenceError, SyntaxError, URIError).
	 * All other error types use the default Error class with the name parameter set
	 * to the error name. Additional properties in the plain object representation
	 * are added to the error instance as properties.
	 * @param name Name of the error type
	 * @param message Error message
	 * @param obj Object containing additional properties
	 * @returns Instance of an error class
	 */
	public static errorDecoder: ErrorDecoder = defaultErrorDecoder

	/**
	 * Whenever a JSON is parsed that may contain result type, you need to specify this
	 * function when calling JSON.parse e.g. `JSON.parse(jsonStr, Result.JSONReviver).
	 * Parsing a JSON without it results in a plain object instead of result instances.
	 */
	public static readonly JSONReviver: JSONReviver = resultJSONReviver

	/**
	 * Parses a JSON string into a result type and optionally parses the contained value using
	 * a Zod model. If no Zod model is specified the contained value remains a plain object.
	 * This function does not panic. In case an error occurs it returns a failure result.
	 * @param str JSON string
	 * @param model Optional Zod model for the contained value
	 * @returns Parsed result
	 */
	public static readonly fromJson = fromJson

	/**
	 * Takes a promise and turns it into a promise result. If the promises is resolved it
	 * returns a success result if the promise is rejected it returns a failure result with
	 * the caught error.
	 * @param p Promise
	 * @returns Promise result
	 */
	public static readonly fromPromise = <T>(p: Promise<T>): Promise<Result<T>> =>
		p.then((x) => Result.success<T>(x)).catch((e) => Result.failure<T>(e))

	/**
	 * Takes a function which can throw an error and turns it into a result. If the
	 * function does not throw it returns a success result if the function throws
	 * it returns a failure result with the caught error.
	 * @param f Function that throws
	 * @returns Result
	 */
	public static readonly fromTry = <T>(f: () => T): Result<T> => {
		try {
			return Result.success(f())
		} catch (e) {
			return Result.failure(e as Error)
		}
	}

	/*******************************************************************************
	 * Abstract Methods                                                            *
	 *******************************************************************************/

	/**
	 * Determines the type of the result
	 */
	public abstract status: "success" | "failure"

	/**
	 * If the result is a success its value is returned, If the result is a failure the
	 * provided default value is returned instead. If no default is given the function
	 * throws the wrapped error.
	 * @param defaultVault Optional default value
	 * @returns The wrapped value or the default value
	 * @throws The failure' wrapped error if no default is given
	 */
	public abstract unwrap(defaultVault?: T): T

	/**
	 * If the result type is success, map calls the provided function with the wrapped
	 * value as an parameter. Said function should return either a new value or a new result.
	 * If the result type is failure, map simply returns the current result.
	 * @param f Function that transforms the wrapped value of the result
	 * @returns New result
	 */
	public abstract map<R>(f: (value: T) => R | Result<R>): Result<R>

	/**
	 * Takes a `success` and `failure` function which are called when the result is a success
	 * and a failure respectively. The result of the called function is then returned
	 * @param m Object containing a `success` and `failure` function
	 * @returns Result returned by the matcher
	 */
	public abstract match<R>(m: ResultMatcher<T, R>): R

	/**
	 * Turns the result into a plain object in order for JSON.stringify to work.
	 * @returns Plain object
	 */
	abstract toJSON(): unknown

	/*******************************************************************************
	 * Methods                                                                     *
	 *******************************************************************************/

	/**
	 * Checks if a result is a success
	 */
	public isSuccess(): this is Success<T> {
		return this instanceof Success
	}

	/**
	 * Checks if a result is a failure
	 */
	public isFailure(): this is Failure<T> {
		return this instanceof Failure
	}

	/**
	 * Constructor which only allows subclassing by Success and Failure
	 */
	protected constructor() {
		if (new.target !== Result && (new.target as unknown) !== Success && (new.target as unknown) !== Failure) {
			throw new Error("Subclassing is not allowed")
		}
	}
}

/**
 * Success contains a wrapped value
 */
export class Success<T> extends Result<T> {
	/**
	 * Determines the type of the result
	 */
	status: "success"
	value: T

	/**
	 * Creates a new success result
	 * @param value Value that should be wrapped
	 * @returns Result that wraps the given value
	 */
	public static of<T>(value: T): Result<T> {
		return new Success(value)
	}

	private constructor(value: T) {
		super()
		if (new.target !== Success) {
			throw new Error("Subclassing is not allowed")
		}
		this.status = "success"
		this.value = value
	}

	/**
	 * If the result is a success its value is returned, If the result is a failure the
	 * provided default value is returned instead. If no default is given the function
	 * throws the wrapped error.
	 * @param defaultVault Optional default value
	 * @returns The wrapped value or the default value
	 * @throws The failure' wrapped error if no default is given
	 */
	public unwrap(_defaultVault?: T): T {
		return this.value
	}

	/**
	 * If the result type is success, map calls the provided function with the wrapped
	 * value as an parameter. Said function should return either a new value or a new result.
	 * If the result type is failure, map simply returns the current result.
	 * @param f Function that transforms the wrapped value of the result
	 * @returns New result
	 */
	public map<R>(f: (value: T) => R | Result<R>): Result<R> {
		const res = f(this.value)
		if (res instanceof Result) {
			return res
		}

		return Result.success(res)
	}

	/**
	 * Takes a `success` and `failure` function which are called when the result is a success
	 * and a failure respectively. The result of the called function is then returned
	 * @param m Object containing a `success` and `failure` function
	 * @returns Result returned by the matcher
	 */
	public match<R>(m: ResultMatcher<T, R>): R {
		return m.success(this.value)
	}

	/**
	 * Turns the result into a plain object in order for JSON.stringify to work.
	 * @returns Plain object
	 */
	toJSON(): unknown {
		return { status: this.status, value: this.value }
	}
}

/**
 * Failure contains an error
 */
export class Failure<T> extends Result<T> {
	/**
	 * Determines the type of the result
	 */
	status: "failure"
	error: Error

	/**
	 * Creates a new failure result
	 * @param err Error that should be wrapped
	 * @returns Result that wraps the given error
	 */
	public static of<T>(err: Error): Result<T> {
		return new Failure(err)
	}

	private constructor(err: Error) {
		super()
		if (new.target !== Failure) {
			throw new Error("Subclassing is not allowed")
		}
		this.status = "failure"
		this.error = err
	}

	/**
	 * If the result is a success its value is returned, If the result is a failure the
	 * provided default value is returned instead. If no default is given the function
	 * throws the wrapped error.
	 * @param defaultVault Optional default value
	 * @returns The wrapped value or the default value
	 * @throws The failure' wrapped error if no default is given
	 */
	public unwrap(defaultVault?: T): T {
		if (defaultVault) {
			return defaultVault
		}
		throw this.error
	}

	/**
	 * If the result type is success, map calls the provided function with the wrapped
	 * value as an parameter. Said function should return either a new value or a new result.
	 * If the result type is failure, map simply returns the current result.
	 * @param f Function that transforms the wrapped value of the result
	 * @returns New result
	 */
	public map<R>(_f: (value: T) => R | Result<R>): Result<R> {
		return Result.failure(this.error)
	}

	/**
	 * Takes a `success` and `failure` function which are called when the result is a success
	 * and a failure respectively. The result of the called function is then returned.
	 * @param m Object containing a `success` and `failure` function
	 * @returns Result returned by the matcher
	 */
	public match<R>(m: ResultMatcher<T, R>): R {
		return m.failure(this.error)
	}

	/**
	 * Turns the result into a plain object in order for JSON.stringify to work.
	 * @returns Plain object
	 */
	toJSON(): unknown {
		return { status: this.status, error: Result.errorEncoder(this.error) }
	}
}
