import { listCourses, addCourse, updateCourse, deleteCourse } from '../models/courses.js';

const form = document.querySelector('[data-course-form]');
const rows = document.querySelector('[data-course-rows]');
const message = document.querySelector('[data-course-message]');
const formTitle = document.querySelector('[data-form-title]');
const idInput = document.querySelector('[name="course_id"]');
const codeInput = document.querySelector('[name="course_code"]');
const nameInput = document.querySelector('[name="course_name"]');
let courses = [];

function showMessage(text) {
  message.textContent = text;
}

function resetForm() {
  form.reset();
  idInput.value = '';
  formTitle.textContent = 'Add course';
}

async function loadCourses() {
  rows.replaceChildren();
  const { data, error } = await listCourses();
  if (error) {
    showMessage(`Could not load courses: ${error.message}`);
    return;
  }

  courses = data ?? [];
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
loadCourses();
