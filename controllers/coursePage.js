import { listCourses, addCourse, updateCourse, deleteCourse } from '../models/courses.js';
import { listEnrollments, addEnrollment } from '../models/enrollments.js';

const form = document.querySelector('[data-course-form]');
const rows = document.querySelector('[data-course-rows]');
const message = document.querySelector('[data-course-message]');
const formTitle = document.querySelector('[data-form-title]');
const idInput = document.querySelector('[name="course_id"]');
const codeInput = document.querySelector('[name="course_code"]');
const nameInput = document.querySelector('[name="course_name"]');
const enrollmentForm = document.querySelector('[data-enrollment-form]');
const enrollmentRows = document.querySelector('[data-enrollment-rows]');
const enrollmentMessage = document.querySelector('[data-enrollment-message]');
const enrollmentCourseSelect = document.querySelector('[data-enrollment-course]');
const enrollmentDateInput = document.querySelector('[data-enrollment-date]');
let courses = [];

function showMessage(text) {
  message.textContent = text;
}

function resetForm() {
  form.reset();
  idInput.value = '';
  formTitle.textContent = 'Add course';
}

function todayAsDateInputValue() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function populateEnrollmentCourses() {
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Select a course';
  enrollmentCourseSelect.replaceChildren(placeholder);

  for (const course of courses) {
    const option = document.createElement('option');
    option.value = course.course_id;
    option.textContent = `${course.course_code} - ${course.course_name}`;
    enrollmentCourseSelect.append(option);
  }
}

async function loadCourses() {
  rows.replaceChildren();
  const { data, error } = await listCourses();
  if (error) {
    showMessage(`Could not load courses: ${error.message}`);
    return;
  }

  courses = data ?? [];
  populateEnrollmentCourses();
  if (!courses.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 3;
    cell.textContent = 'No courses yet.';
    row.append(cell);
    rows.append(row);
    return;
  }

  for (const course of courses) {
    const row = document.createElement('tr');
    const codeCell = document.createElement('td');
    const nameCell = document.createElement('td');
    const actionsCell = document.createElement('td');
    const editButton = document.createElement('button');
    const deleteButton = document.createElement('button');

    codeCell.textContent = course.course_code;
    nameCell.textContent = course.course_name;
    editButton.type = 'button';
    editButton.className = 'button button-secondary';
    editButton.dataset.editCourse = course.course_id;
    editButton.textContent = 'Edit';
    deleteButton.type = 'button';
    deleteButton.className = 'button button-secondary';
    deleteButton.dataset.deleteCourse = course.course_id;
    deleteButton.textContent = 'Delete';
    actionsCell.append(editButton, deleteButton);
    row.append(codeCell, nameCell, actionsCell);
    rows.append(row);
  }
}

async function loadEnrollments() {
  enrollmentRows.replaceChildren();
  const { data, error } = await listEnrollments();
  if (error) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.textContent = `Could not load enrollments: ${error.message}`;
    row.append(cell);
    enrollmentRows.append(row);
    return;
  }

  if (!data?.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.textContent = 'No students enrolled yet.';
    row.append(cell);
    enrollmentRows.append(row);
    return;
  }

  for (const enrollment of data) {
    const row = document.createElement('tr');
    for (const value of [
      enrollment.student_name,
      enrollment.college_id,
      enrollment.courses?.course_code ?? '—',
      enrollment.enrollment_date
    ]) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    enrollmentRows.append(row);
  }
}

enrollmentDateInput.value = todayAsDateInputValue();

enrollmentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(enrollmentForm);
  const enrollment = {
    student_name: String(formData.get('student_name')).trim(),
    college_id: String(formData.get('college_id')).trim(),
    course_id: Number(formData.get('course_id')),
    enrollment_date: String(formData.get('enrollment_date'))
  };

  const submitButton = enrollmentForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  enrollmentMessage.textContent = 'Saving enrollment…';
  const { error } = await addEnrollment(enrollment);
  submitButton.disabled = false;
  if (error) {
    enrollmentMessage.textContent = error.code === '23505'
      ? 'That College ID is already enrolled.'
      : error.code === '42501'
        ? 'Sign in with an authorized account to manage student enrollments.'
        : `Could not save enrollment: ${error.message}`;
    return;
  }

  enrollmentMessage.textContent = 'Student enrolled.';
  enrollmentForm.reset();
  enrollmentDateInput.value = todayAsDateInputValue();
  await loadEnrollments();
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = idInput.value;
  const course = {
    course_code: codeInput.value.trim().toUpperCase(),
    course_name: nameInput.value.trim()
  };
  if (!course.course_code || !course.course_name) {
    showMessage('Enter both a course code and course name.');
    return;
  }

  const submitButton = form.querySelector('[type="submit"]');
  submitButton.disabled = true;
  showMessage('Saving course…');
  const { error } = id ? await updateCourse(id, course) : await addCourse(course);
  submitButton.disabled = false;
  if (error) {
    showMessage(error.code === '23505' ? 'That course code already exists.' : `Could not save course: ${error.message}`);
    return;
  }

  showMessage(id ? 'Course updated.' : 'Course added.');
  resetForm();
  await loadCourses();
});

rows.addEventListener('click', async (event) => {
  const editId = event.target.dataset.editCourse;
  const deleteId = event.target.dataset.deleteCourse;

  if (editId) {
    const course = courses.find((item) => String(item.course_id) === editId);
    if (!course) return;
    idInput.value = course.course_id;
    codeInput.value = course.course_code;
    nameInput.value = course.course_name;
    formTitle.textContent = 'Edit course';
    codeInput.focus();
  }

  if (deleteId && window.confirm('Delete this course?')) {
    const { error } = await deleteCourse(deleteId);
    if (error) {
      showMessage(error.code === '23503' ? 'This course is assigned to a customer and cannot be deleted.' : `Could not delete course: ${error.message}`);
      return;
    }
    showMessage('Course deleted.');
    await loadCourses();
  }
});

document.querySelector('[data-cancel-course]').addEventListener('click', resetForm);
enrollmentDateInput.value = todayAsDateInputValue();
loadCourses();
loadEnrollments();
