import { supabase } from '../supabase.js';

export function listEnrollments() {
  return supabase
    .from('enrollments')
    .select('enrollment_id, student_name, college_id, course_id, enrollment_date, courses(course_code)')
    .order('enrollment_date', { ascending: false });
}

export function addEnrollment(enrollment) {
  return supabase.from('enrollments').insert(enrollment);
}

export function updateEnrollment(id, enrollment) {
  return supabase
    .from('enrollments')
    .update(enrollment)
    .eq('enrollment_id', id)
    .select('enrollment_id');
}

export function deleteEnrollment(id) {
  return supabase.from('enrollments').delete().eq('enrollment_id', id);
}
