import { z } from "zod"
import { Result } from "./result.ts"

/**
 * Custom error encoder are called by the default error decoder when encountering a
 * non-default (EvalError, RangeError, ReferenceError, SyntaxError, URIError, Error)
 * error name.
 * @param message Error message
 * @param additionalProps Raw plain error object
 * @returns Instance of an error class
 */
export interface ErrorTypeDecoder<Props extends Record<string, unknown> = Record<string, unknown>> {
	(message: string, additionalProps: Props): Error
}

const registeredErrorTypes: Record<string, ErrorTypeDecoder<never>> = {}

/**
 * Registers a custom decoder for the given error type name, which is used by the default
 * error decoder.
 * @param name Name of the custom error
 * @param decoder Decoder for said error
 */
export const registerErrorType = <Props extends Record<string, unknown> = Record<string, unknown>>(
	name: string,
	decoder: ErrorTypeDecoder<Props>,
) => {
	registeredErrorTypes[name] = decoder
}

/**
 * Registers custom decoders for the given error type names, which are used by the default
 * error decoder.
 * @param errors Object containing error type names and their decoders
 */
export const registerErrorTypes = <Props extends Record<string, unknown> = Record<string, unknown>>(
	errors: Record<string, ErrorTypeDecoder<Props>>,
) => {
	Object.entries(errors).forEach(([name, decoder]) => {
		registeredErrorTypes[name] = decoder
	})
}

/**
 * The error encoder is called when encoding a Failure to JSON. This function
 * is necessary since errors cannot be encoded to JSON by default.
 * @param err Error that should be encoded
 * @returns Plain object representing the error
 */
export interface ErrorEncoder {
	(err: Error): Record<string, unknown>
}

/**
 * The error decoder is called when decoding a Failure from JSON. This function
 * is necessary to decode the wrapped error.
 * @param name Name of the error type
 * @param message Error message
 * @param additionalProps Raw plain error object
 * @returns Instance of an error class
 */
export interface ErrorDecoder {
	(name: string, message: string, additionalProps: Record<string, unknown>): Error
}

/**
 * A function that transforms the results of JSON.parse. The function is called for each member
 * of the object. If a member contains nested objects, the nested objects are transformed before
 * the parent object is.
 */
export interface JSONReviver {
	(key: string, value: unknown): unknown
}

/**
 * This is the default implementation of a error encoder. It encodes all error
 * properties except for the stack into a plain object which can then be stringified.
 * @param err Error that should be encoded
 * @returns Plain object representing the error
 */
export const defaultErrorEncoder: ErrorEncoder = (err) =>
	Object.getOwnPropertyNames(err)
		.filter((x) => x !== "stack")
		.reduce((res, key) => ({
			...res,
			[key]: (err as unknown as Record<string, unknown>)[key],
		}), { name: err.name, message: err.message })

/**
 * This is the default implementation of a error decoder. It can decode the
 * following error types (EvalError, RangeError, ReferenceError, SyntaxError,
 * URIError). All other error types use the default Error class with the name
 * parameter set to the error name. Additional properties in the plain
 * object representation are added to the error instance as properties.
 * @param name Name of the error type
 * @param message Error message
 * @param additionalProps Object containing additional properties
 * @returns Instance of an error class
 */
export const defaultErrorDecoder: ErrorDecoder = (name, message, additionalProps) => {
	if (Object.hasOwn(registeredErrorTypes, name)) {
		return registeredErrorTypes[name](message, additionalProps as never)
	}

	const err = (() => {
		switch (name) {
			case "EvalError":
				return new EvalError(message)
			case "RangeError":
				return new RangeError(message)
			case "ReferenceError":
				return new ReferenceError(message)
			case "SyntaxError":
				return new SyntaxError(message)
			case "URIError":
				return new URIError(message)
			default:
				return Object.defineProperty(new Error(message), "name", {
					value: name,
				})
		}
	})()

	Object.keys(additionalProps)
		.forEach((key) =>
			Object.defineProperty(err, key, {
				value: additionalProps[key],
			})
		)

	return Object.defineProperty(err, "stack", { value: "" })
}

/**
 * Creates a new object which omits the specified keys
 * @param obj Original object
 * @param keys Keys which should be omitted from the object
 * @returns New object without the specified keys
 */
const omitKeys = (obj: Record<string, unknown>, keys: string[]): Record<string, unknown> =>
	Object.keys(obj)
		.filter((x) => !keys.includes(x))
		.reduce((res, key) => ({ ...res, [key]: obj[key] }), {})

/**
 * Zod model for parsing an plain object into an Error
 */
const errorModel = z.looseInterface({
	name: z.string(),
	message: z.string(),
}).transform((x) =>
	Result.errorDecoder(
		x.name,
		x.message,
		omitKeys(x, ["name", "message"]),
	)
)

/**
 * Zod model for validating a plain object represents and result object
 */
const jsonModel = z.discriminatedUnion([
	z.strictInterface({
		status: z.literal("success"),
		value: z.any(),
	}),
	z.strictInterface({
		status: z.literal("failure"),
		error: errorModel,
	}),
])

/**
 * Whenever a JSON is parsed that may contain result type, you need to specify this
 * function when calling JSON.parse e.g. `JSON.parse(jsonStr, Result.JSONReviver).
 * Parsing a JSON without it results in a plain object instead of result instances.
 */
export const resultJSONReviver: JSONReviver = (_key, value) => {
	const res = jsonModel.safeParse(value)
	if (res.success) {
		if (res.data.status === "success") {
			return Result.success(res.data.value)
		} else if (res.data.status === "failure") {
			return Result.failure(res.data.error)
		}
	}

	return value
}

/**
 * Parses a JSON string into a result type and optionally parses the contained value using
 * a Zod model. If no Zod model is specified the contained value remains a plain object.
 * This function does not panic. In case an error occurs it returns a failure result.
 * @param str JSON string
 * @param model Optional Zod model for the contained value
 * @returns Parsed result
 */
export const fromJson = <T>(str: string, model?: z.ZodType<T>): Result<T> => {
	let res: unknown = undefined

	try {
		res = JSON.parse(str, Result.JSONReviver)
	} catch (e) {
		return Result.failure(e as Error)
	}

	if (res instanceof Result) {
		if (res.isSuccess()) {
			res = res.value
		} else {
			return res
		}
	}

	if (!model) {
		return Result.success(res as T)
	}

	const v = model.safeParse(res)

	if (v.success) {
		return Result.success(v.data)
	} else {
		return Result.failure(v.error)
	}
}
