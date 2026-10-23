import { supabase } from '../supabase.js';

export function listCustomers() {
	return supabase
		.from('customers')
		.select('*, courses(course_code)')
		.order('customer_name');
}

export function addCustomer(customer) {
	return supabase.from('customers').insert(customer);
}
