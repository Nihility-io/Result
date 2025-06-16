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

/**
 * Custom decodable error type.
 */
export interface DecodableErrorType {
	name: string
	fromResultFailure: (message: string, params: Record<string, unknown>) => Error
}

/**
 * Creates a new object which omits the specified keys
 * @param obj Original object
 * @param keys Keys which should be omitted from the object
 * @returns New object without the specified keys
 */
function omitKeys(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> {
	return Object.keys(obj)
		.filter((x) => !keys.includes(x))
		.reduce((res, key) => ({ ...res, [key]: obj[key] }), {})
}

/**
 * Zod model for parsing an plain object into an Error
 */
export const errorModel = z.looseObject({
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
export const jsonModel = z.discriminatedUnion("status", [
	z.strictObject({ status: z.literal("success"), value: z.unknown() }),
	z.strictObject({ status: z.literal("failure"), error: errorModel }),
])
