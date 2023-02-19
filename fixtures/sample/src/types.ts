export type PrimeNumber = number;
export type Tuple<T, U> = [T, U];

export type GUID = string;

export type AddressGuid = GUID;

export interface EntityBase<T extends string> {
    guid: GUID;
    type: T;
}

export interface Entity {
    guid: GUID;
    type: string;
}

export interface Address extends EntityBase<'Address'> {
    guid: AddressGuid;
    name: string;
    street: string;
    city: string;
    postalCode: string;
    country: string;
    state?: string;
    provence?: string;
    annotations?: Annotation[];
}

export type PhoneNumberGuid = GUID;

export interface PhoneNumber extends EntityBase<'PhoneNumber'> {
    guid: PhoneNumberGuid;
    name: string;
    number: string;
    annotations?: Annotation[];
}

export type PersonGuid = GUID;

export interface Person extends EntityBase<'Person'> {
    guid: PersonGuid;
    name: string;
    aliases?: string[];
    dob?: string;
    addresses?: Address[];
    notes?: Annotation[];
}

export interface Annotation extends EntityBase<'Annotation'> {
    note: string;
    madeBy: PersonGuid;
}
