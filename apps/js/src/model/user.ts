export type UserRole = "customer" | "admin";

export type Gender = "M" | "F" | "X";

export type UsersMe = {
	id: number;
	email: string;
	created_at: Date;
	updated_at: Date;
	name?: string;
	phone?: string;
	// a DATE, rendered by the view so no timezone can shift the day
	birthdate?: string;
	gender?: Gender;
	avatar?: string;
	roles: UserRole[];
};

export type UsersAddressShipping = {
	id: number;
	name: string;
	phone: string;
	email: string;
	address: string;
};

export type UsersPaymentsActive = {
	id: number;
	created_at: Date;
	id_payment: number;
	type: string;
	is_default: boolean;
	data: Record<string, unknown>;
};
