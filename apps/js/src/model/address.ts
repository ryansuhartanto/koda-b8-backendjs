export type Address = {
	id: number;
	label: string;
	name: string;
	phone: string;
	address: string;
	city: string;
	province: string;
	postal_code: string;
	is_default: boolean;
};

export type AddressRequest = {
	label: string;
	name: string;
	phone: string;
	address: string;
	city: string;
	province: string;
	postal_code: string;
	is_default: boolean;
};
