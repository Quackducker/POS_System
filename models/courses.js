import { supabase } from '../supabase.js';

export function listCourses() {
  return supabase.from('courses').select('*').order('course_code');
}

export function addCourse(course) {
  return supabase.from('courses').insert(course);
}

export function updateCourse(id, course) {
  return supabase.from('courses').update(course).eq('course_id', id);
}

export function deleteCourse(id) {
  return supabase.from('courses').delete().eq('course_id', id);
}
