import { supabase } from '../supabase.js';

export function listProducts() {
  return supabase.from('products').select('*').order('product_name');
}

export function addProduct(product) {
  return supabase.from('products').insert(product).select('*').single();
}

export function updateProduct(id, product) {
  return supabase.from('products').update(product).eq('product_id', id).select('*').single();
}

export function deleteProduct(id) {
  return supabase.from('products').update({ status: 'Inactive' }).eq('product_id', id);
}
