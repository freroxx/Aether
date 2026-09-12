import { GenericInterface } from "./types";

export interface Kid extends GenericInterface {
	id: string,
	firstName: string,
	lastName: string,
	class: string,
	dateOfBirth: Date,
	/** Id interne pronotepy ClientInfo.id (stable par session, utile au debug). */
	externalId?: string | null,
	ref?: unknown
}